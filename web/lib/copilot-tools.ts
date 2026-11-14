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
  parseValues,
  transferHypotheses,
  transferTestsFromFlowSteps,
  withGravity,
  type ConditionRecord,
  type GravityTargetId,
} from "../../engine/src/index.ts";
import { buildNarrationInput, parseTargetReply } from "./ask-core.ts";
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
const range = { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 };

export const TOOL_DEFS: ToolDef[] = [
  fn(
    "evaluate_target",
    "Run the deterministic applicability engine for a target condition. Returns verdict counts per investigation, the top investigations with DOI and reasons, and a hash of the full output. Use null for anything not stated.",
    {
      regime: {
        type: "object",
        properties: {
          gravity_regime: { enum: ["microgravity", "partial_gravity", "normal_gravity", null] },
          fuel_phase: { enum: ["solid", "liquid", "gas", null] },
          diluent: { enum: ["N2", "He", "CO2", "Ar", "mixed", null] },
          flame_type: { enum: ["normal", "inverse", null] },
        },
      },
      continuous: {
        type: "object",
        properties: {
          o2_mole_fraction: { type: ["number", "null"], description: "0 to 1" },
          pressure_kpa: { type: ["number", "null"] },
          gravity_level_g: { type: ["number", "null"] },
        },
      },
    },
    ["regime", "continuous"],
  ),
  fn(
    "find_evidence",
    "Find extracted condition records, grouped by test. All filters optional.",
    {
      accession: { type: "string" },
      variable: { type: "string", description: "for example o2_mole_fraction, pressure, material, fuel" },
      material: { type: "string", description: "substring of the material or fuel name" },
      o2_range: { ...range, description: "mole fraction [lo, hi]" },
      pressure_range: { ...range, description: "kPa [lo, hi]" },
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
    limit_o2: { type: "number", description: "limiting O2 mole fraction, 0.15 to 0.40" },
    temperature_c: { type: "number", description: "assumed chamber temperature, 5 to 45; default 22" },
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

function numRange(x: unknown, name: string): Validated<[number, number] | undefined> {
  if (x === undefined || x === null) return { ok: true, value: undefined };
  if (!Array.isArray(x) || x.length !== 2 || x.some((v) => typeof v !== "number" || !Number.isFinite(v)) || x[0] > x[1]) return bad(`${name} must be [lo, hi] with lo <= hi`);
  return { ok: true, value: [x[0], x[1]] };
}

/** Validate the arguments the model produced. Never throws. */
export function validateArgs(name: string, raw: unknown): Validated<Record<string, unknown>> {
  const a = raw === undefined || raw === null ? {} : raw;
  if (!isObj(a)) return bad("arguments must be a JSON object");
  switch (name) {
    case "evaluate_target": {
      try {
        parseTargetReply(JSON.stringify(a));
        return { ok: true, value: a };
      } catch (e) {
        return bad(e instanceof Error ? e.message : String(e));
      }
    }
    case "find_evidence": {
      const o2 = numRange(a.o2_range, "o2_range");
      if (!o2.ok) return o2;
      const p = numRange(a.pressure_range, "pressure_range");
      if (!p.ok) return p;
      for (const k of ["accession", "variable", "material"]) if (a[k] !== undefined && typeof a[k] !== "string") return bad(`${k} must be a string`);
      const limit = a.limit === undefined ? 10 : a.limit;
      if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 25) return bad("limit must be an integer from 1 to 25");
      return { ok: true, value: { ...a, limit } };
    }
    case "get_receipt":
      for (const k of ["accession", "test_id", "variable"]) if (typeof a[k] !== "string" || a[k] === "") return bad(`${k} is required (a string)`);
      return { ok: true, value: a };
    case "transfer_hypothesis":
      return a.gravity === "moon" || a.gravity === "mars" || a.gravity === "earth" ? { ok: true, value: a } : bad('gravity must be "moon", "mars" or "earth"');
    case "fm2_balance": {
      const l = a.limit_o2;
      if (typeof l !== "number" || !(l >= 0.15 && l <= 0.4)) return bad("limit_o2 must be a mole fraction from 0.15 to 0.40");
      const t = a.temperature_c ?? 22;
      if (typeof t !== "number" || !(t >= 5 && t <= 45)) return bad("temperature_c must be from 5 to 45");
      return { ok: true, value: { limit_o2: l, temperature_c: t } };
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
      const parsed = parseTargetReply(JSON.stringify(args));
      const evaluation = evaluate(ctx.records, parsed.target);
      const { input } = buildNarrationInput(evaluation, ctx.investigations, parsed.target, 6);
      return { result: { ...input, assumptions_unstated: parsed.unstated }, engineHash: await ctx.sha256(canonicalJson(evaluation)), target: parsed.target };
    }
    case "find_evidence": {
      const a = args as { accession?: string; variable?: string; material?: string; o2_range?: [number, number]; pressure_range?: [number, number]; limit: number };
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
        if (!inR("o2_mole_fraction", a.o2_range) || !inR("pressure", a.pressure_range)) continue;
        const [accession, test_id] = k.split("|");
        out.push({ accession, test_id, doi: inv.get(accession)?.doi ?? "", values: recs.filter((r) => !r.variable.startsWith("outcome:")).map((r) => ({ variable: r.variable, value: r.value, unit: r.unit, status: r.status })) });
        if (out.length >= a.limit) break;
      }
      return { result: { count_returned: out.length, tests: out } };
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
      const L = args.limit_o2 as number;
      const T = (args.temperature_c as number) + 273.15;
      const rows = FM2_STARTS.map((x0) => {
        const b = fm2Balance(fm2Chamber({ temperatureK: { value: T, unit: "K", source: { note: "assumed, not in the source" } }, startO2Fraction: { value: x0, unit: "1", source: { note: "FM2 test start" } }, limitO2Fraction: { value: L, unit: "1", source: { note: "hypothesised limit" } }, stoichGO2PerGFuel: PMMA_STOICH }));
        return { start_o2: x0, o2_consumable_mol: b.o2ConsumableMol, o2_consumable_g: b.o2ConsumableG, final_o2: b.finalO2Fraction, pmma_burned_g_illustration: b.fuelBurnedG };
      });
      return { result: { label: "closed-chamber mass balance, not a flame model", volume_l: 14.4, pressure_psia: 8.2, temperature_k_assumed: T, limit_o2_hypothesised: L, tests: rows } };
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
