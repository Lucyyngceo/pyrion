// PYRION as a Model Context Protocol (MCP) server, over Streamable HTTP (JSON-RPC 2.0 in a POST, one JSON response).
// Read-only and deterministic: every tool is the same code the site runs (the applicability engine, the extracted records,
// the NASA library). No language model is called here, so any AI assistant that connects gets the engine's answer, never ours.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { TOOL_DEFS, runTool, truncateResult, validateArgs, type ToolContext } from "@/lib/copilot-tools";
import { serverData } from "@/lib/server-eval";
import { PRESET_VIEWS } from "@/lib/presets";
import { loadLibrary } from "@/lib/expert/library";
import { compareConditionSet, toTarget, type ConditionInput } from "@/lib/expert/compare";
import { evidenceGaps } from "@/lib/gaps";
import { runCalculator } from "@/lib/expert/calculators";
import { report as plannerReport } from "@/lib/planner/data";
import { PRESETS } from "../../../../engine/src/index.ts";

export const dynamic = "force-dynamic";

const PROTOCOL = "2025-06-18";
const SERVER = { name: "pyrion", title: "PYRION Ω — NASA PSI fire evidence", version: "1.0.0" };
const DERIVED = path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "data", "derived");
const INSTRUCTIONS =
  "PYRION checks a cabin atmosphere (oxygen, pressure, gravity, fuel) against the condition records extracted from NASA's Physical Sciences Informatics (PSI) combustion investigations. " +
  "Verdicts come from fixed rules in code, never from a model; quote them as PYRION's verdict and cite the DOI each tool returns. " +
  "'Insufficient evidence' and 'not comparable' are real answers: do not turn them into a prediction. PYRION never calls a condition safe. " +
  "Give quantities as text with their units (\"30 %\", \"10.2 psia\", \"Moon\", \"Mars\", \"0.38 g\", \"microgravity\", \"Earth\"); the engine converts units. " +
  "Works for any condition: the ISS, the Moon, Mars, a lunar or Martian habitat, or Earth. Use list_presets for the named NASA atmospheres (including Mars), compare_conditions to put several side by side, and evidence_gaps to see what PSI would need to state.";

const readOpt = (f: string) => readFile(path.join(DERIVED, f), "utf8").catch(() => null);

let ctxCache: Promise<ToolContext> | null = null;
function context(): Promise<ToolContext> {
  ctxCache ??= (async () => {
    const [{ records, investigations }, emb, bass, flex] = await Promise.all([serverData(), readOpt("text_similarity.json"), readOpt("bass2_flow_steps.csv"), readOpt("flex_model.json")]);
    return {
      records,
      investigations,
      embedding: emb ? JSON.parse(emb) : undefined,
      presets: PRESET_VIEWS.map((v) => ({ id: v.preset.id, label: v.preset.label })),
      bassCsv: bass,
      flex: flex ? JSON.parse(flex) : undefined,
      sha256: async (text: string) => createHash("sha256").update(text).digest("hex"),
    };
  })();
  return ctxCache;
}

type Tool = { name: string; title: string; description: string; inputSchema: Record<string, unknown> };

const EXTRA: Tool[] = [
  {
    name: "oxygen_partial_pressure",
    title: "Oxygen partial pressure",
    description: "Oxygen partial pressure of an atmosphere, in kPa and psia, computed by code with its formula. Give oxygen and total pressure with units (\"34 %\", \"8.2 psia\"). Gauge pressure is refused.",
    inputSchema: { type: "object", properties: { o2: { type: "string" }, pressure: { type: "string" } }, required: ["o2", "pressure"], additionalProperties: false },
  },
  {
    name: "compare_two_atmospheres",
    title: "Two atmospheres, by the numbers",
    description: "Two atmospheres side by side: oxygen partial pressure, total pressure and oxygen fraction of each, and the second relative to the first. Arithmetic only, no verdict.",
    inputSchema: { type: "object", properties: { a: { type: "object", properties: { name: { type: "string" }, o2: { type: "string" }, pressure: { type: "string" } }, required: ["o2", "pressure"] }, b: { type: "object", properties: { name: { type: "string" }, o2: { type: "string" }, pressure: { type: "string" } }, required: ["o2", "pressure"] } }, required: ["a", "b"], additionalProperties: false },
  },
  {
    name: "convert_units",
    title: "Convert pressure or temperature",
    description: "Convert a pressure (kPa, Pa, atm, bar, mbar, psi, psia, mmHg, torr) or a temperature (K, C, F), with the factor used.",
    inputSchema: { type: "object", properties: { value: { type: "number" }, from: { type: "string" }, to: { type: "string" } }, required: ["value", "from", "to"], additionalProperties: false },
  },
  {
    name: "gravity_value",
    title: "Gravity level with its source",
    description: "Gravity of a body or regime with its NASA source: Mars 0.38 g, Earth 1 g; microgravity is a regime, not a number. PYRION's lunar verdict preset uses 0.16 g (NTRS 20210020446, PDF p.3), while FM2 calculations use 0.165 g (NTRS 20260001966); current verdicts compare the partial-gravity regime, not these numerical gravity levels.",
    inputSchema: { type: "object", properties: { name: { type: "string", description: "Moon, Mars, Earth, microgravity" } }, required: ["name"], additionalProperties: false },
  },
  {
    name: "compare_conditions",
    title: "Compare atmospheres",
    description: "Put 1 to 8 conditions side by side (preset ids or your own oxygen, pressure and gravity: ISS, Moon, Mars, habitats). For each: oxygen partial pressure, verdict counts, best solid-fuel verdict, nearest evidence with DOI, and a fingerprint; then a ranking with its rule stated.",
    inputSchema: { type: "object", properties: { conditions: { type: "array", minItems: 1, maxItems: 8, items: { oneOf: [{ type: "string", description: "a preset id from list_presets" }, { type: "object", properties: { name: { type: "string" }, o2: { type: "string", description: '"30 %"' }, pressure: { type: "string", description: '"10.2 psia", "70 kPa"' }, gravity_regime: { enum: ["microgravity", "partial_gravity", "normal_gravity"] }, gravity_level: { type: "number", description: "in g, e.g. 0.16 Moon, 0.38 Mars" } }, additionalProperties: false }] } } }, required: ["conditions"], additionalProperties: false },
  },
  {
    name: "evidence_gaps",
    title: "Evidence gaps for a condition",
    description: "For one condition (a preset id or your own values), every value PSI does not state that blocks a comparison, and the range that value would need for the investigation to become comparable. Nothing is assumed or predicted.",
    inputSchema: { type: "object", properties: { condition: { oneOf: [{ type: "string", description: "a preset id from list_presets" }, { type: "object", properties: { name: { type: "string" }, o2: { type: "string", description: '"30 %"' }, pressure: { type: "string", description: '"10.2 psia", "70 kPa"' }, gravity_regime: { enum: ["microgravity", "partial_gravity", "normal_gravity"] }, gravity_level: { type: "number", description: "in g, e.g. 0.16 Moon, 0.38 Mars" } }, additionalProperties: false }] } }, required: ["condition"], additionalProperties: false },
  },
  {
    name: "moon_base_test_plan",
    title: "Moon Base test plan (Mission Planner)",
    description: "The Mission Planner's cited gap report for the Moon Base band (PYRION's frame from NASA exploration atmospheres): PSI coverage, what NASA's planned FM2 would cover, and the test points still missing. Evidence coverage, not a prediction.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_investigation",
    title: "One PSI investigation",
    description: "Everything PYRION extracted for one PSI investigation (e.g. PSI-25): DOI, hardware, variables with ranges, test count, publications, PSI links and quoted summary sentences.",
    inputSchema: { type: "object", properties: { accession: { type: "string", description: '"PSI-25"' } }, required: ["accession"], additionalProperties: false },
  },
  {
    name: "list_presets",
    title: "Named cabin atmospheres",
    description: "The named conditions PYRION knows (ISS cabin air, the challenge's Moon Base, NASA exploration atmospheres), each with its values and the source it cites.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_investigations",
    title: "PSI combustion investigations",
    description: "The 24 NASA PSI combustion investigations: accession, acronym, title, DOI and license.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_nasa_library",
    title: "Search NASA documents",
    description: "BM25 search over the page-by-page text of the NASA documents PYRION reads (PSI reports, NTRS papers, NASA standards). Returns passages with document, page and link, to quote verbatim.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, top: { type: "integer", minimum: 1, maximum: 10 } }, required: ["query"], additionalProperties: false },
  },
];

// ---------- Prompts: the "skills" an assistant can pick, each a short recipe over the tools above ----------
type Prompt = { name: string; title: string; description: string; arguments?: { name: string; description: string; required?: boolean }[]; text: (a: Record<string, string>) => string };
const RULES =
  "Rules: verdicts are PYRION's (fixed rules in code); quote them as such with each investigation's DOI. 'Insufficient evidence' and 'not comparable' are answers, not failures. Never call a condition safe or unsafe and never predict flame behaviour. Say 'in PSI', not 'no data exists'. Every number you write must come from a tool result.";
const PROMPTS: Prompt[] = [
  {
    name: "assess_habitat_atmosphere",
    title: "Check a cabin or habitat atmosphere",
    description: "Any atmosphere (ISS, Moon, Mars, a rover, Earth): verdicts, oxygen partial pressure, nearest evidence and what PSI is missing.",
    arguments: [
      { name: "o2", description: 'oxygen, e.g. "30 %"', required: true },
      { name: "pressure", description: 'total pressure with unit, e.g. "10.2 psia"', required: true },
      { name: "gravity", description: 'e.g. "Moon", "Mars", "microgravity", "Earth"', required: true },
      { name: "fuel_phase", description: "solid, liquid or gas (optional; cabin materials are solid)" },
    ],
    text: (a) =>
      `Use the PYRION tools to assess this atmosphere: oxygen ${a.o2}, pressure ${a.pressure}, gravity ${a.gravity}${a.fuel_phase ? `, fuel ${a.fuel_phase}` : ""}.\n` +
      "1. evaluate_target with those values. 2. oxygen_partial_pressure. 3. evidence_gaps for the same condition. 4. get_investigation for the nearest investigation it names. " +
      "Answer in four short parts: what PSI has tested near it (with DOIs), the oxygen partial pressure, what is missing in PSI, and what test would close the gap.\n" + RULES,
  },
  {
    name: "moon_base_brief",
    title: "NASA Moon Base fire-evidence brief",
    description: "The challenge's Moon Base (30 % O2 or more, 10.2 psi or less, lunar gravity): what PSI holds, the nearest evidence, and what planned FM2 would and would not cover.",
    text: () =>
      "Brief me on fire evidence for NASA's Moon Base using PYRION: evaluate_target with the Moon Base values from list_presets (challenge-lunar-base), compare_conditions with challenge-lunar-base and iss-cabin-air, then moon_base_test_plan. " +
      "Report the verdict counts, the nearest solid-fuel evidence with DOI and how far it is in oxygen, PSI coverage of the band (PYRION's frame, not NASA's), what FM2 as planned covers, and the test points still missing.\n" + RULES,
  },
  {
    name: "mars_habitat_check",
    title: "Mars habitat atmosphere",
    description: "A Martian habitat condition (0.38 g) against PSI, next to the same atmosphere on the Moon and in microgravity.",
    arguments: [
      { name: "o2", description: 'e.g. "34 %"', required: true },
      { name: "pressure", description: 'e.g. "8.2 psia"', required: true },
    ],
    text: (a) =>
      `Check ${a.o2} oxygen at ${a.pressure} on Mars with PYRION. Call gravity_value for Mars, then compare_conditions with three rows of the same oxygen and pressure: gravity_level 0.38 (partial_gravity), gravity_level 0.16 (partial_gravity), and microgravity. ` +
      "Explain what changes between the three rows and why (regime barriers), with DOIs, and give the oxygen partial pressure.\n" + RULES,
  },
  {
    name: "find_nasa_evidence",
    title: "Find NASA evidence on a topic",
    description: "Search the NASA documents PYRION reads and the extracted PSI records for a topic, and quote NASA word for word.",
    arguments: [{ name: "topic", description: "e.g. flame spread over fabrics in opposed flow", required: true }],
    text: (a) =>
      `Find NASA evidence about: ${a.topic}. Use search_nasa_library (quote passages word for word, with document, page and link), text_search to find related PSI investigations, then get_investigation for the best match. ` +
      "Separate what NASA wrote (quoted) from your own summary, and label the summary as yours.\n" + RULES,
  },
  {
    name: "explain_a_verdict",
    title: "Why does an investigation apply or not?",
    description: "For one PSI investigation and one condition: the verdict, the reason the engine gives, and the source of the values involved.",
    arguments: [
      { name: "accession", description: 'e.g. "PSI-25"', required: true },
      { name: "condition", description: 'e.g. "30 % oxygen at 10.2 psia on the Moon"', required: true },
    ],
    text: (a) =>
      `Explain PYRION's verdict for ${a.accession} at ${a.condition}. Call evaluate_target, find the row for ${a.accession}, then find_evidence and get_receipt for the values its reason mentions. ` +
      "Give the verdict, the engine's reason in plain words, and the NASA source of each value.\n" + RULES,
  },
];

// ---------- Resources: short reference texts an assistant can read before answering ----------
const RESOURCES: { uri: string; name: string; title: string; description: string; text: string }[] = [
  {
    uri: "pyrion://method",
    name: "method",
    title: "How PYRION decides",
    description: "The applicability method in one page.",
    text:
      "PYRION compares a target condition with condition records extracted from NASA PSI combustion investigations. Gravity regime, fuel phase, diluent and flame type are regime barriers: crossing one gives 'not comparable', never a distance. " +
      "Oxygen, pressure and the other continuous axes are compared with the region spanned by tested points, with a stated tolerance and extrapolation levels. The verdict is computed by code: the same condition always gives the same verdict and SHA-256 fingerprint. " +
      "No language model decides anything. Full method: https://pyrion.us/method",
  },
  {
    uri: "pyrion://verdicts",
    name: "verdicts",
    title: "The four verdicts",
    description: "What each verdict means and how to say it.",
    text:
      "APPLICABLE: the condition lies inside the region of measured test points (within tolerance); no test was necessarily run at that exact point. " +
      "EXTRAPOLATION: just outside the tested data; the level says how far. INSUFFICIENT_EVIDENCE: the records do not state a value needed to compare (a real answer; see evidence_gaps). " +
      "REGIME_BARRIER: different gravity, fuel or atmosphere; not comparable. None of these is a safety statement.",
  },
  {
    uri: "pyrion://citing",
    name: "citing",
    title: "How to cite PYRION results",
    description: "Citation rules for answers built on these tools.",
    text:
      "Cite each PSI investigation by its DOI (https://doi.org/...), NASA documents by title, page and link as search_nasa_library returns them, and PYRION itself as https://pyrion.us (code: https://github.com/Lucyyngceo/pyrion, Apache-2.0). " +
      "Quote NASA word for word. Say 'in PSI' rather than 'no data exists'. Label your own reasoning as yours.",
  },
];

const TITLES: Record<string, string> = {
  evaluate_target: "Applicability verdicts for a condition",
  find_evidence: "Find extracted test records",
  get_receipt: "Source of one value",
  transfer_hypothesis: "Gravity transfer (hypothesis)",
  fm2_balance: "FM2 chamber oxygen balance",
  text_search: "Text-similarity ranking (not physics)",
  flex_model: "FLEX droplet model",
  suggest_experiments: "Suggested experiments (FLEX)",
};

const TOOLS: Tool[] = [
  ...TOOL_DEFS.map((d) => ({ name: d.function.name, title: TITLES[d.function.name] ?? d.function.name, description: d.function.description, inputSchema: d.function.parameters })),
  ...EXTRA,
];

const text = (value: unknown, isError = false) => {
  const { text: t } = truncateResult(value, 20_000);
  return { content: [{ type: "text", text: t }], isError };
};

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === "oxygen_partial_pressure") return text(runCalculator("o2PartialPressure", { o2: args.o2, pressure: args.pressure }));
  if (name === "compare_two_atmospheres") return text(runCalculator("compareAtmospheres", { a: args.a, b: args.b }));
  if (name === "gravity_value") return text(runCalculator("gravityValue", { name: args.name }));
  if (name === "convert_units") {
    const temp = /^(k|c|f|°c|°f)$/i.test(String(args.from ?? "").trim());
    return text(runCalculator(temp ? "convertTemperature" : "convertPressure", { value: args.value, from: args.from, to: args.to }));
  }
  if (name === "compare_conditions" || name === "evidence_gaps") {
    const raw = name === "compare_conditions" ? (Array.isArray(args.conditions) ? args.conditions : []) : [args.condition];
    const conds: ConditionInput[] = raw.slice(0, 8).flatMap((c): ConditionInput[] => {
      if (typeof c === "string") return [c.slice(0, 80)];
      if (!c || typeof c !== "object") return [];
      const x = c as Record<string, unknown>;
      return [{ name: typeof x.name === "string" ? x.name.slice(0, 60) : undefined, o2: typeof x.o2 === "string" || typeof x.o2 === "number" ? x.o2 : undefined, pressure: typeof x.pressure === "string" ? x.pressure.slice(0, 40) : undefined, gravity_regime: typeof x.gravity_regime === "string" ? x.gravity_regime : undefined, gravity_level: typeof x.gravity_level === "number" ? x.gravity_level : undefined }];
    });
    if (conds.length === 0) return text("give at least one condition", true);
    if (name === "compare_conditions") {
      const { records, investigations } = await serverData();
      const catalog = Object.fromEntries(investigations.map((i) => [i.accession, { acronym: i.acronym, title: i.title, doi: i.doi }]));
      const r = compareConditionSet(conds, { records, catalog });
      return text({ rule: r.rule, ranking: r.ranking, rows: r.rows });
    }
    const t = toTarget(conds[0]);
    if (t.error || !t.target) return text(t.error ?? "no condition", true);
    return text({ condition: t.name, gaps: await evidenceGaps(t.target), units: "o2_mole_fraction as a fraction, pressure in kPa" });
  }
  if (name === "moon_base_test_plan") {
    const r = await plannerReport();
    const d = r.data;
    return text({ label: d.label, fingerprint: r.fingerprint, band: d.band, coverage: d.coverage, planned_fm2: d.planned.fm2, minimum_test_set: d.minimumTestSet, report_markdown: r.markdown.slice(0, 12000), full_report: "https://pyrion.us/api/planner/report" });
  }
  if (name === "get_investigation") {
    const acc = typeof args.accession === "string" ? args.accession.trim().toUpperCase() : "";
    const profiles = JSON.parse((await readOpt("investigation_profiles.json")) ?? "[]") as { accession: string }[];
    const p = profiles.find((x) => x.accession === acc);
    return p ? text(p) : text(`unknown accession ${acc}; use list_investigations`, true);
  }
  if (name === "list_presets") {
    return text([...PRESET_VIEWS.map((v) => ({ id: v.preset.id, label: v.preset.label, values: v.summary })), ...PRESETS.filter((p) => !PRESET_VIEWS.some((v) => v.preset.id === p.id)).map((p) => ({ id: p.id, label: p.label }))]);
  }
  if (name === "list_investigations") {
    const { investigations } = await serverData();
    return text(investigations.map((i) => ({ accession: i.accession, acronym: i.acronym, title: i.title, doi: i.doi ? `https://doi.org/${i.doi.replace(/^https?:\/\/doi\.org\//, "")}` : null, license: i.license })));
  }
  if (name === "search_nasa_library") {
    const q = typeof args.query === "string" ? args.query.trim() : "";
    if (!q) return text("query is required", true);
    const top = Math.min(10, Math.max(1, Number.isInteger(args.top) ? (args.top as number) : 5));
    const lib = await loadLibrary();
    if (!lib) return text({ available: false, message: "The NASA library is not loaded on this server." });
    const hits = await lib.search(q.slice(0, 500), top);
    return text(hits.map((h) => ({ document: h.title, doc_id: h.doc_id, pages: h.page_start === h.page_end ? h.page_start : `${h.page_start}-${h.page_end}`, url: h.url, passage: h.text.slice(0, 1500) })));
  }
  const v = validateArgs(name, args);
  if (!v.ok) return text(v.error, true);
  const out = await runTool(await context(), name, v.value);
  return text(out);
}

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(m: Rpc) {
  switch (m.method) {
    case "initialize":
      return ok(m.id, { protocolVersion: PROTOCOL, capabilities: { tools: { listChanged: false }, prompts: { listChanged: false }, resources: { listChanged: false } }, serverInfo: SERVER, instructions: INSTRUCTIONS });
    case "ping":
      return ok(m.id, {});
    case "prompts/list":
      return ok(m.id, { prompts: PROMPTS.map((p) => ({ name: p.name, title: p.title, description: p.description, arguments: p.arguments ?? [] })) });
    case "prompts/get": {
      const p = PROMPTS.find((x) => x.name === m.params?.name);
      if (!p) return fail(m.id, -32602, `unknown prompt: ${String(m.params?.name ?? "")}`);
      const raw = (m.params?.arguments ?? {}) as Record<string, unknown>;
      const a = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v).slice(0, 200)]));
      const missing = (p.arguments ?? []).filter((x) => x.required && !a[x.name]).map((x) => x.name);
      if (missing.length) return fail(m.id, -32602, `missing arguments: ${missing.join(", ")}`);
      return ok(m.id, { description: p.description, messages: [{ role: "user", content: { type: "text", text: p.text(a) } }] });
    }
    case "resources/list":
      return ok(m.id, { resources: RESOURCES.map((r) => ({ uri: r.uri, name: r.name, title: r.title, description: r.description, mimeType: "text/plain" })) });
    case "resources/read": {
      const r = RESOURCES.find((x) => x.uri === m.params?.uri);
      if (!r) return fail(m.id, -32602, `unknown resource: ${String(m.params?.uri ?? "")}`);
      return ok(m.id, { contents: [{ uri: r.uri, mimeType: "text/plain", text: r.text }] });
    }
    case "tools/list":
      return ok(m.id, { tools: TOOLS });
    case "tools/call": {
      const name = typeof m.params?.name === "string" ? m.params.name : "";
      if (!TOOLS.some((t) => t.name === name)) return fail(m.id, -32602, `unknown tool: ${name}`);
      const args = (m.params?.arguments && typeof m.params.arguments === "object" ? m.params.arguments : {}) as Record<string, unknown>;
      try {
        return ok(m.id, await callTool(name, args));
      } catch {
        return ok(m.id, text("The tool failed on the server.", true));
      }
    }
    default:
      return fail(m.id, -32601, `method not found: ${m.method ?? ""}`);
  }
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, mcp-protocol-version, mcp-session-id", "access-control-allow-methods": "POST, GET, OPTIONS" };

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(fail(null, -32700, "parse error"), { status: 400, headers: CORS });
  }
  const isObj = (x: unknown): x is Rpc => typeof x === "object" && x !== null && !Array.isArray(x);
  if (!isObj(body) && !(Array.isArray(body) && body.length > 0)) return Response.json(fail(null, -32600, "invalid request: expected a JSON-RPC object or a non-empty batch"), { status: 400, headers: CORS });
  const msgs = (Array.isArray(body) ? body : [body]) as unknown[];
  const replies = [];
  for (const m of msgs.slice(0, 20)) {
    if (!isObj(m) || typeof m.method !== "string") {
      replies.push(fail(isObj(m) ? m.id : null, -32600, "invalid request"));
      continue;
    }
    if (m.id === undefined || m.id === null) continue; // notifications get no reply
    replies.push(await handle(m));
  }
  if (replies.length === 0) return new Response(null, { status: 202, headers: CORS });
  return Response.json(Array.isArray(body) ? replies : replies[0], { headers: CORS });
}

/** No server-sent stream: this server only answers requests. */
export async function GET(req: Request) {
  if ((req.headers.get("accept") ?? "").includes("text/event-stream")) return new Response(null, { status: 405, headers: { ...CORS, allow: "POST" } });
  return Response.json({ server: SERVER, protocol: PROTOCOL, transport: "streamable-http (POST JSON-RPC)", tools: TOOLS.map((t) => t.name) }, { headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
