// Copilot tools: thin, deterministic wrappers over the engine and the data. Pure (no I/O): the caller supplies the context.
// The model may only answer from what these return. Relative .ts imports so the tests run under `node --test`.

import {
  DENSITY_FACTOR_PMMA_AIR,
  GRAVITY_TARGETS,
  PMMA_STOICH,
  TRANSFER_LIMITS,
  canonicalJson,
  evaluate,
  fm2Balance,
  fm2Chamber,
  parseQuantity,
  parseValues,
  targetFromQuantities,
  type TargetQuantities,
  transferHypotheses,
  transferTestsFromFlowSteps,
  withGravity,
  type ConditionRecord,
  type GravityTargetId,
} from "../../engine/src/index.ts";
import { buildNarrationInput } from "./ask-core.ts";
import { tfidfRank } from "./textsearch.ts";

export interface ToolContext {
  records: ConditionRecord[];
  investigations: { accession: string; acronym: string; title: string; doi: string; license: string; version: string; publications?: string[] }[];
  /** data/derived/text_similarity.json, when present: preset id -> ranking. */
  embedding?: { model: string; license: string; rankings: Record<string, { accession: string; score: number }[]> };
  /** Preset id and label, to match a text query to a precomputed ranking. */
  presets: { id: string; label: string }[];
  bassCsv: string | null;
  /** data/derived/flex_model.json, when present. */
  flex?: unknown;
  sha256: (text: string) => Promise<string | null>;
}

export type ToolName = "evaluate_target" | "find_evidence" | "get_receipt" | "transfer_hypothesis" | "fm2_balance" | "text_search" | "flex_model" | "suggest_experiments";

export interface ToolDef {
  type: "function";
  function: { name: ToolName; description: string; parameters: Record<string, unknown> };
}

const fn = (name: ToolName, description: string, properties: Record<string, unknown>, required: string[] = []): ToolDef => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } },
});
const range = { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 };

export const TOOL_DEFS: ToolDef[] = [
  fn(
    "evaluate_target",
    "Run the deterministic applicability engine for a target condition. Give every quantity as text WITH its unit, exactly as the user wrote it (for example \"8.2 psia\", \"34 %\", \"Moon\" or \"0.165 g\"); the engine converts units, you never do. Leave out anything not stated. Returns verdict counts per investigation, the top investigations with DOI and reasons, the unit conversions done, and a hash of the full output.",
    {
      gravity: { type: "string", description: 'a level or a name, for example "0.165 g", "1/6 g", "Moon", "Mars", "microgravity"' },
      o2: { type: "string", description: 'oxygen, for example "34 %" or "0.21"' },
      pressure: { type: "string", description: 'for example "8.2 psia", "101.3 kPa", "1 atm"; psi means absolute' },
      flow_velocity: { type: "string", description: 'for example "20 cm/s"' },
      sample_thickness: { type: "string", description: 'for example "0.1 mm"' },
      ambient_temperature: { type: "string", description: 'for example "22 C" or "295 K"' },
      gravity_regime: { enum: ["microgravity", "partial_gravity", "normal_gravity"] },
      fuel_phase: { enum: ["solid", "liquid", "gas"] },
      diluent: { enum: ["N2", "He", "CO2", "Ar", "mixed"] },
      flame_type: { enum: ["normal", "inverse"] },
    },
  ),
  fn(
    "find_evidence",
    "Find extracted condition records, grouped by test. All filters optional.",
    {
      accession: { type: "string" },
      variable: { type: "string", description: "for example o2_mole_fraction, pressure, material, fuel" },
      material: { type: "string", description: "substring of the material or fuel name" },
      o2_range: { ...range, description: 'two oxygen values with units, for example ["20 %", "30 %"]' },
      pressure_range: { ...range, description: 'two pressures with units, for example ["50 kPa", "10 psia"]' },
      limit: { type: "integer", minimum: 1, maximum: 25 },
    },
  ),
  fn("get_receipt", "The source of one value: file, location, verbatim quote, status, and the investigation DOI.", {
    accession: { type: "string" },
    test_id: { type: "string" },
    variable: { type: "string" },
  }, ["accession", "test_id", "variable"]),
  fn("transfer_hypothesis", "Hypothesis, not evidence: which BASS-II rod tests have a forced stretch rate in the buoyant-stretch band of a gravity level. Returns the limits.", {
    gravity: { enum: ["moon", "mars", "earth"] },
  }, ["gravity"]),
  fn("fm2_balance", "Closed-chamber oxygen balance of the FM2 instrument (not a flame model) for a hypothesised limiting oxygen.", {
    limit_o2: { type: "string", description: 'limiting oxygen with its unit, for example "25 %"; between 15 % and 40 %' },
    temperature: { type: "string", description: 'assumed chamber temperature with its unit, for example "22 C"; between 5 and 45 C; default 22 C' },
  }, ["limit_o2"]),
  fn("text_search", "Rank PSI investigations by text similarity (not physical applicability).", {
    query: { type: "string" },
    k: { type: "integer", minimum: 1, maximum: 15 },
  }, ["query"]),
  fn("flex_model", "FLEX droplet-combustion model output. Returns not available when the model file is absent.", {
    fuel: { type: "string" }, d0_mm: { type: "number" }, o2: { type: "number" }, pressure_kpa: { type: "number" },
  }, ["fuel"]),
  fn("suggest_experiments", "Suggested next experiments from the FLEX model. Returns not available when the model file is absent.", {
    fuel: { type: "string" },
  }, ["fuel"]),
];

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };
const bad = (error: string): { ok: false; error: string } => ({ ok: false, error });
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** Two quantity strings -> [lo, hi] in schema units, with the conversions done. */
function qRange(x: unknown, name: string, variable: "o2_mole_fraction" | "pressure"): Validated<{ range: [number, number] | undefined; conversions: string[] }> {
  if (x === undefined || x === null) return { ok: true, value: { range: undefined, conversions: [] } };
  if (!Array.isArray(x) || x.length !== 2 || x.some((v) => typeof v !== "string")) return bad(`${name} must be two strings with units`);
  const qs = x.map((v) => parseQuantity(v as string, variable));
  for (const q of qs) if (!q.ok) return bad(`${name}: ${q.message}`);
  const v = qs.map((q) => (q.ok ? q.value : 0));
  if (v[0] > v[1]) return bad(`${name} must be [lo, hi] with lo <= hi`);
  return { ok: true, value: { range: [v[0], v[1]], conversions: qs.map((q) => (q.ok ? q.display : "")) } };
}

const QFIELDS = ["gravity", "o2", "pressure", "flow_velocity", "sample_thickness", "ambient_temperature", "gravity_regime", "fuel_phase", "diluent", "flame_type"] as const;

/** The engine's own conversion of the tool arguments into a target. */
function toTarget(a: Record<string, unknown>) {
  const q: Record<string, string> = {};
  for (const k of QFIELDS) {
    const v = a[k];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string") return { ok: false as const, error: `${k} must be a string` };
    q[k] = v;
  }
  const r = targetFromQuantities(q as TargetQuantities);
  return r.ok ? r : { ok: false as const, error: r.errors.map((e) => `${e.field}: ${e.message}`).join("; ") };
}

/** Validate the arguments the model produced. Never throws. */
export function validateArgs(name: string, raw: unknown): Validated<Record<string, unknown>> {
  const a = raw === undefined || raw === null ? {} : raw;
  if (!isObj(a)) return bad("arguments must be a JSON object");
  switch (name) {
    case "evaluate_target": {
      const t = toTarget(a);
      return t.ok ? { ok: true, value: a } : bad(t.error);
    }
    case "find_evidence": {
      const o2 = qRange(a.o2_range, "o2_range", "o2_mole_fraction");
      if (!o2.ok) return o2;
      const p = qRange(a.pressure_range, "pressure_range", "pressure");
      if (!p.ok) return p;
      for (const k of ["accession", "variable", "material"]) if (a[k] !== undefined && typeof a[k] !== "string") return bad(`${k} must be a string`);
      const limit = a.limit === undefined ? 10 : a.limit;
      if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 25) return bad("limit must be an integer from 1 to 25");
      return { ok: true, value: { ...a, limit, _o2: o2.value, _p: p.value } };
    }
    case "get_receipt":
      for (const k of ["accession", "test_id", "variable"]) if (typeof a[k] !== "string" || a[k] === "") return bad(`${k} is required (a string)`);
      return { ok: true, value: a };
    case "transfer_hypothesis":
      return a.gravity === "moon" || a.gravity === "mars" || a.gravity === "earth" ? { ok: true, value: a } : bad('gravity must be "moon", "mars" or "earth"');
    case "fm2_balance": {
      if (typeof a.limit_o2 !== "string") return bad('limit_o2 is required: a string with its unit, for example "25 %"');
      const l = parseQuantity(a.limit_o2, "o2_mole_fraction");
      if (!l.ok) return bad(`limit_o2: ${l.message}`);
      if (!(l.value >= 0.15 && l.value <= 0.4)) return bad("limit_o2 must be between 15 % and 40 %");
      const t = parseQuantity(typeof a.temperature === "string" ? a.temperature : "22 C", "ambient_temperature");
      if (!t.ok) return bad(`temperature: ${t.message}`);
      if (!(t.value >= 278.15 && t.value <= 318.15)) return bad("temperature must be between 5 and 45 C");
      return { ok: true, value: { limit: l, temperature: t } };
    }
    case "text_search": {
      if (typeof a.query !== "string" || a.query.trim() === "" || a.query.length > 500) return bad("query must be 1 to 500 characters");
      const k = a.k === undefined ? 5 : a.k;
      if (!Number.isInteger(k) || (k as number) < 1 || (k as number) > 15) return bad("k must be an integer from 1 to 15");
      return { ok: true, value: { query: a.query, k } };
    }
    case "flex_model":
    case "suggest_experiments":
      return typeof a.fuel === "string" && a.fuel !== "" ? { ok: true, value: a } : bad("fuel is required (a string)");
    default:
      return bad(`unknown tool "${name}"`);
  }
}

/** Cap a tool result: long arrays are halved until the JSON fits, and the result says it was truncated. */
export function truncateResult(value: unknown, maxChars = 6000): { text: string; truncated: boolean } {
  let v = JSON.parse(JSON.stringify(value ?? null)) as unknown;
  let text = JSON.stringify(v);
  if (text.length <= maxChars) return { text, truncated: false };
  const arrays: unknown[][] = [];
  const walk = (x: unknown) => {
    if (Array.isArray(x)) {
      arrays.push(x);
      x.forEach(walk);
    } else if (isObj(x)) Object.values(x).forEach(walk);
  };
  for (let guard = 0; guard < 200 && text.length > maxChars; guard++) {
    arrays.length = 0;
    walk(v);
    const longest = arrays.reduce<unknown[] | null>((m, x) => (x.length > 1 && (!m || x.length > m.length) ? x : m), null);
    if (!longest) break;
    longest.length = Math.ceil(longest.length / 2);
    text = JSON.stringify(v);
  }
  if (!isObj(v)) v = { value: v };
  (v as Record<string, unknown>)._truncated = true;
  text = JSON.stringify(v);
  if (text.length > maxChars) text = JSON.stringify({ _truncated: true, note: "result too large to show", head: text.slice(0, Math.max(0, maxChars - 80)) });
  return { text, truncated: true };
}

const first = (v: string) => (parseValues(v) as number[])[0];
const FM2_STARTS = [0.37, 0.33, 0.29, 0.25];

export interface ToolOutput {
  result: unknown;
  /** SHA-256 of the canonical engine output, for evaluate_target. */
  engineHash?: string | null;
  /** The target the engine evaluated, for "show on envelope". */
  target?: unknown;
}

const NA = (what: string) => ({ available: false, message: `${what} is not available: data/derived/flex_model.json does not exist. PSI evidence is insufficient to answer.` });

export async function runTool(ctx: ToolContext, name: string, args: Record<string, unknown>): Promise<ToolOutput> {
  const inv = new Map(ctx.investigations.map((i) => [i.accession, i]));
  switch (name) {
    case "evaluate_target": {
      const t = toTarget(args);
      if (!t.ok) return { result: { error: t.error } };
      const evaluation = evaluate(ctx.records, t.target);
      const { input } = buildNarrationInput(evaluation, ctx.investigations, t.target, 6);
      return {
        result: { ...input, conversions: t.conversions.map((c) => c.display), notes: t.conversions.flatMap((c) => c.notes), warnings: t.conversions.flatMap((c) => c.warnings) },
        engineHash: await ctx.sha256(canonicalJson(evaluation)),
        target: t.target,
      };
    }
    case "find_evidence": {
      const a = args as { accession?: string; variable?: string; material?: string; limit: number; _o2?: { range?: [number, number]; conversions: string[] }; _p?: { range?: [number, number]; conversions: string[] } };
      const o2r = a._o2?.range;
      const pr = a._p?.range;
      const byTest = new Map<string, ConditionRecord[]>();
      for (const r of ctx.records) {
        if (r.status === "insufficient_evidence") continue;
        if (a.accession && r.accession !== a.accession) continue;
        const k = `${r.accession}|${r.test_id}`;
        const l = byTest.get(k);
        if (l) l.push(r);
        else byTest.set(k, [r]);
      }
      const common = new Map<string, ConditionRecord[]>();
      for (const [k, l] of byTest) if (k.endsWith("|*")) common.set(k.split("|")[0], l);
      const tests = [...byTest.entries()].filter(([k]) => !k.endsWith("|*"));
      const out = [];
      for (const [k, own] of tests) {
        const recs = [...(common.get(k.split("|")[0]) ?? []), ...own];
        const val = (v: string) => recs.filter((r) => r.variable === v);
        if (a.variable && val(a.variable).length === 0) continue;
        if (a.material && !recs.some((r) => (r.variable === "material" || r.variable === "fuel") && r.value.toLowerCase().includes(a.material!.toLowerCase()))) continue;
        const inR = (v: string, rg?: [number, number]) => !rg || val(v).some((r) => { const n = first(r.value); return n >= rg[0] && n <= rg[1]; });
        if (!inR("o2_mole_fraction", o2r) || !inR("pressure", pr)) continue;
        const [accession, test_id] = k.split("|");
        out.push({ accession, test_id, doi: inv.get(accession)?.doi ?? "", values: recs.filter((r) => !r.variable.startsWith("outcome:")).map((r) => ({ variable: r.variable, value: r.value, unit: r.unit, status: r.status })) });
        if (out.length >= a.limit) break;
      }
      return { result: { count_returned: out.length, tests: out, conversions: [...(a._o2?.conversions ?? []), ...(a._p?.conversions ?? [])] } };
    }
    case "get_receipt": {
      const a = args as { accession: string; test_id: string; variable: string };
      const r = ctx.records.find((x) => x.accession === a.accession && (x.test_id === a.test_id || x.test_id === "*") && x.variable === a.variable);
      if (!r) return { result: { found: false, message: "no extracted record matches; PSI evidence is insufficient" } };
      const i = inv.get(r.accession);
      return { result: { found: true, accession: r.accession, test_id: r.test_id, variable: r.variable, value: r.value, unit: r.unit, value_original: r.value_original, unit_original: r.unit_original, source_file: r.source_file, source_location: r.source_location, quote: r.quote, status: r.status, method: r.method, doi: i?.doi ?? "", psi_version: i?.version ?? "", license: i?.license || "not stated" } };
    }
    case "transfer_hypothesis": {
      if (!ctx.bassCsv) return { result: { available: false, message: "data/derived/bass2_flow_steps.csv is missing" } };
      const id = args.gravity as GravityTargetId;
      const { tests } = transferTestsFromFlowSteps(ctx.bassCsv, { gravityRegime: "microgravity", rodFormula: "rod_tip" });
      const rep = transferHypotheses(withGravity({ regime: {}, continuous: {} }, id), tests, { densityFactor: { lo: DENSITY_FACTOR_PMMA_AIR.lo, hi: DENSITY_FACTOR_PMMA_AIR.hi } });
      const row = (h: (typeof rep.hypotheses)[number]) => ({ accession: h.accession, test_id: h.test_id, test_stretch_per_s: h.testStretch.value, buoyant_stretch_band_per_s: h.targetStretch.value, relation: h.relation });
      return { result: { label: "HYPOTHESIS, NOT EVIDENCE", gravity_g: GRAVITY_TARGETS[id].level, analogs: rep.hypotheses.filter((h) => h.isAnalog).map(row), partial_overlap: rep.hypotheses.filter((h) => !h.isAnalog && h.relation === "overlap").map(row), tests_considered: rep.hypotheses.length, limits: TRANSFER_LIMITS } };
    }
    case "fm2_balance": {
      const lq = (args as { limit: { value: number; display: string } }).limit;
      const tq = (args as { temperature: { value: number; display: string } }).temperature;
      const L = lq.value;
      const T = tq.value;
      const rows = FM2_STARTS.map((x0) => {
        const b = fm2Balance(fm2Chamber({ temperatureK: { value: T, unit: "K", source: { note: "assumed, not in the source" } }, startO2Fraction: { value: x0, unit: "1", source: { note: "FM2 test start" } }, limitO2Fraction: { value: L, unit: "1", source: { note: "hypothesised limit" } }, stoichGO2PerGFuel: PMMA_STOICH }));
        return { start_o2: x0, o2_consumable_mol: b.o2ConsumableMol, o2_consumable_g: b.o2ConsumableG, final_o2: b.finalO2Fraction, pmma_burned_g_illustration: b.fuelBurnedG };
      });
      return { result: { label: "closed-chamber mass balance, not a flame model", volume_l: 14.4, pressure_psia: 8.2, temperature_k_assumed: T, limit_o2_hypothesised: L, conversions: [lq.display, tq.display], tests: rows } };
    }
    case "text_search": {
      const a = args as { query: string; k: number };
      const q = a.query.toLowerCase();
      const preset = ctx.presets.find((p) => q.includes(p.id.toLowerCase()) || q.includes(p.label.toLowerCase()));
      const emb = preset && ctx.embedding?.rankings[preset.id];
      const label = (acc: string) => inv.get(acc)?.acronym ?? "";
      if (emb && ctx.embedding) {
        return { result: { method: `embedding search (${ctx.embedding.model}, ${ctx.embedding.license}), precomputed for the preset "${preset.label}"`, note: "ranks text, not physical applicability", ranking: emb.slice(0, a.k).map((e) => ({ accession: e.accession, acronym: label(e.accession), cosine: e.score, doi: inv.get(e.accession)?.doi ?? "" })) } };
      }
      const docs = ctx.investigations.map((i) => ({ id: i.accession, text: [i.acronym, i.title, ...(i.publications ?? [])].join(" ") }));
      return { result: { method: "TF-IDF cosine over investigation and publication titles", note: "ranks text, not physical applicability", ranking: tfidfRank(docs, a.query).slice(0, a.k).map((e) => ({ accession: e.id, acronym: label(e.id), score: Number(e.score.toFixed(4)), doi: inv.get(e.id)?.doi ?? "" })) } };
    }
    case "flex_model":
    case "suggest_experiments":
      return { result: ctx.flex === undefined ? NA(name) : { available: true, note: "flex_model.json exists but its schema is not wired into this tool yet; PSI evidence is insufficient to answer from it." } };
    default:
      return { result: { error: `unknown tool "${name}"` } };
  }
}
