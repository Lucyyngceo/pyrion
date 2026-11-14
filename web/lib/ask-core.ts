// Pure helpers of "Ask PYRION": reading the model's target, and building what the narrator may see.
// Relative .ts imports on purpose, so the unit tests can run them under `node --test`.

import { targetFromQuantities, validateTarget, type Evaluation, type Target, type TargetQuantities } from "../../engine/src/index.ts";
import { BANNED_PATTERNS, factsFromText, type Fact, type Facts, type Verdict } from "./narration-check.ts";
import { cleanModelText } from "./llm/clean.ts";

const KPA_PER_PSI = 6.894757293168361;

export interface ParsedTarget {
  target: Target;
  assumptions: string[];
  /** Axes the question did not state. */
  unstated: string[];
  /** Unit conversions done by the engine, for display: "8.2 psia → 56.54 kPa (×6.894757)". */
  conversions: string[];
  /** Engine notes and plausibility warnings about the values. */
  warnings: string[];
}

const QUANTITY_KEYS = ["gravity", "o2", "pressure", "flow_velocity", "sample_thickness", "ambient_temperature"] as const;
const REGIME_KEYS = ["gravity_regime", "fuel_phase", "diluent", "flame_type"] as const;

function extractJson(text: string): unknown {
  const t = cleanModelText(text);
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("the model did not return JSON");
  return JSON.parse(t.slice(start, end + 1));
}

const NUMS = /\d+(?:\.\d+)?/g;

/** Words in a question that state a regime value outright. A value the model supplies without one of them was inferred. */
const STATES: Record<string, RegExp> = {
  solid: /\bsolids?\b/i,
  liquid: /\bliquids?\b|\bdroplets?\b/i,
  gas: /\bgas(?:es|eous)?\b/i,
  N2: /\bn2\b|\bnitrogen\b/i,
  He: /\bhelium\b/i,
  CO2: /\bco2\b|\bcarbon dioxide\b/i,
  Ar: /\bargon\b/i,
  mixed: /\bmixed\b/i,
  normal: /\bnormal flame\b/i,
  inverse: /\binverse\b/i,
  microgravity: /\bmicro-?gravity\b|\bweightless/i,
  partial_gravity: /\bpartial\b/i,
  normal_gravity: /\bnormal gravity\b|\b1 ?g\b|\bearth gravity\b/i,
};
const norm = (s: string) => s.normalize("NFKC").toLowerCase();

/**
 * "Copy as written": a quantity the model returned is accepted only if its numbers (or, for names such as "lunar",
 * its words) are present in the question. A converted or invented value is not.
 */
export function supportedByQuestion(value: string, question: string): boolean {
  const q = norm(question);
  const v = norm(value);
  const nums = v.match(NUMS);
  if (nums) {
    const inQuestion = new Set((q.match(NUMS) ?? []).map(Number));
    return nums.every((n) => inQuestion.has(Number(n)));
  }
  return v
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3)
    .every((w) => q.includes(w));
}

/** A model-written assumption is kept only if short, free of banned phrases, and with no number the question lacks. */
export function keepAssumption(a: string, question: string): boolean {
  if (a.length > 150 || a.trim() === "") return false;
  if (BANNED_PATTERNS.some((b) => b.pattern.test(a))) return false;
  const inQuestion = new Set((norm(question).match(NUMS) ?? []).map(Number));
  return (a.match(NUMS) ?? []).every((n) => inQuestion.has(Number(n)));
}

/**
 * Read the model's reply (quantities as written) and let the engine convert and validate them.
 * The model never outputs a converted number. Throws a readable Error when the reply cannot become a target.
 */
export function parseTargetReply(reply: string, question: string): ParsedTarget {
  let raw: unknown;
  try {
    raw = extractJson(reply);
  } catch (e) {
    throw new Error(e instanceof Error && e.message.startsWith("the model") ? e.message : "the model's reply is not valid JSON");
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error("the reply is not a JSON object");
  const o = raw as Record<string, unknown>;
  const input: Record<string, string> = {};
  const unstated: string[] = [];
  const dropped: string[] = [];
  for (const k of [...QUANTITY_KEYS, ...REGIME_KEYS]) {
    const v = o[k];
    if (v === null || v === undefined || v === "") {
      unstated.push(k === "o2" ? "o2_mole_fraction" : k);
      continue;
    }
    if (typeof v !== "string") throw new Error(`${k} must be text as written in the question, or null`);
    if ((QUANTITY_KEYS as readonly string[]).includes(k) && !supportedByQuestion(v, question)) {
      unstated.push(k === "o2" ? "o2_mole_fraction" : k);
      dropped.push(`The model returned "${v}" for ${k.replaceAll("_", " ")}, which is not in the question. It was ignored.`);
      continue;
    }
    input[k] = v;
  }
  const r = targetFromQuantities(input as TargetQuantities);
  if (!r.ok) throw new Error(r.errors.map((e) => `${e.field}: ${e.message}`).join("; "));
  // A regime axis the model filled in without the question stating it is shown as an assumption.
  const inferred: string[] = [];
  for (const k of REGIME_KEYS) {
    const v = input[k];
    if (v === undefined) continue;
    if (k === "gravity_regime" && input.gravity !== undefined) continue; // derived by the engine from the stated gravity
    if (!(STATES[v]?.test(question) ?? false)) inferred.push(`${k.replaceAll("_", " ")} "${v}" was inferred by the model: the question does not state it.`);
  }
  const assumptions = Array.isArray(o.assumptions) ? o.assumptions.filter((a): a is string => typeof a === "string" && keepAssumption(a, question)).slice(0, 5) : [];
  return {
    target: r.target,
    assumptions: [...inferred, ...assumptions].slice(0, 6),
    unstated,
    conversions: r.conversions.map((c) => c.display),
    warnings: [...dropped, ...r.conversions.flatMap((c) => [...c.notes, ...c.warnings])],
  };
}

const sig = (n: number, d = 3) => Number(n.toPrecision(d));
const ORDER = { APPLICABLE: 0, EXTRAPOLATION: 1, INSUFFICIENT_EVIDENCE: 2, REGIME_BARRIER: 3 } as const;

export interface NarrationInput {
  target: Record<string, unknown>;
  open_axes: string[];
  counts: Record<string, number>;
  top: { accession: string; acronym: string; doi: string; verdict: string; distance: number | null; reasons: string[] }[];
  note: string;
}

/** What the narrator may see: counts, the top investigations with DOI, and their decisive reasons. Nothing else. */
export function buildNarrationInput(
  evaluation: Evaluation,
  investigations: { accession: string; acronym: string; title?: string; doi: string }[],
  target: Target,
  maxTop = 5,
): { input: NarrationInput; facts: Facts } {
  const inv = new Map(investigations.map((i) => [i.accession, i]));
  const clusters = new Map([...evaluation.ranked, ...evaluation.unranked].map((c) => [`${c.accession}|${c.clusterKey}`, c]));
  const rows = evaluation.investigations.toSorted(
    (a, b) =>
      ORDER[a.verdict] - ORDER[b.verdict] ||
      (clusters.get(`${a.accession}|${a.decidingCluster}`)?.rank ?? 1e9) - (clusters.get(`${b.accession}|${b.decidingCluster}`)?.rank ?? 1e9) ||
      (a.accession < b.accession ? -1 : 1),
  );
  const t = target.continuous;
  const tgt: Record<string, unknown> = { ...target.regime };
  if (t.o2_mole_fraction !== undefined) {
    tgt.o2_mole_fraction = sig(t.o2_mole_fraction, 4);
    tgt.o2_percent = sig(t.o2_mole_fraction * 100, 4);
  }
  if (t.pressure !== undefined) {
    tgt.pressure_kpa = sig(t.pressure, 4);
    tgt.pressure_psia = sig(t.pressure / KPA_PER_PSI, 3);
  }
  if (t.gravity_level !== undefined) tgt.gravity_level_g = t.gravity_level;
  const top = rows.slice(0, maxTop).map((r) => {
    const c = clusters.get(`${r.accession}|${r.decidingCluster}`);
    return {
      accession: r.accession,
      acronym: inv.get(r.accession)?.acronym ?? "",
      doi: inv.get(r.accession)?.doi ?? "",
      verdict: r.verdict,
      distance: c?.distance != null ? sig(c.distance) : null,
      reasons: (c?.reasons ?? []).filter((x) => !x.informational).slice(0, 3).map((x) => x.message),
    };
  });
  const input: NarrationInput = {
    target: tgt,
    open_axes: evaluation.openRegimeAxes,
    counts: { ...evaluation.counts.investigations },
    top,
    note: "Verdicts are computed by a deterministic engine. A transfer hypothesis for partial gravity is a separate, labelled page and is not part of this output.",
  };
  // Facts the narration is checked against, each number with its unit class.
  const numbers: Fact[] = [];
  const counts = Object.values(input.counts);
  for (const c of counts) numbers.push({ value: c, cls: "count" });
  numbers.push({ value: counts.reduce((a, b) => a + b, 0), cls: "count" });
  for (const [k, v] of Object.entries(tgt)) {
    if (typeof v !== "number") continue;
    numbers.push({ value: v, cls: k === "o2_percent" ? "%" : k === "pressure_kpa" ? "kPa" : k === "pressure_psia" ? "psia" : k === "gravity_level_g" ? "g" : "" });
  }
  for (const t2 of top) {
    if (t2.distance !== null) numbers.push({ value: t2.distance, cls: "" });
    for (const r of t2.reasons) numbers.push(...factsFromText(r));
  }
  const source = JSON.stringify(input);
  const facts: Facts = {
    top: top.map((x) => ({ accession: x.accession, acronym: x.acronym, doi: x.doi, verdict: x.verdict as Verdict })),
    all: investigations.map((i) => ({ accession: i.accession, acronym: i.acronym, title: i.title ?? "" })),
    numbers,
    source,
  };
  return { input, facts };
}

const VERDICT_LABEL: Record<string, string> = { APPLICABLE: "applicable", EXTRAPOLATION: "extrapolation", INSUFFICIENT_EVIDENCE: "insufficient evidence", REGIME_BARRIER: "not comparable (regime barrier)" };

/**
 * The counts and the per-investigation verdict sentences, written by code from the engine output.
 * A model never writes these.
 */
export function renderVerdicts(input: NarrationInput): string[] {
  const c = input.counts;
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const lines = [
    `Verdicts across ${total} investigations: ${c.APPLICABLE ?? 0} applicable, ${c.EXTRAPOLATION ?? 0} extrapolation, ${c.INSUFFICIENT_EVIDENCE ?? 0} insufficient evidence, ${c.REGIME_BARRIER ?? 0} not comparable (regime barrier).`,
  ];
  for (const t of input.top) lines.push(`${t.accession}${t.acronym ? ` (${t.acronym}${t.doi ? `, doi:${t.doi}` : ""})` : ""}: ${VERDICT_LABEL[t.verdict] ?? t.verdict}.`);
  return lines;
}

/** SHA-256 (hex) of a text, where Web Crypto exists; null otherwise. */
export async function sha256Hex(text: string): Promise<string | null> {
  const s = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!s) return null;
  const buf = await s.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * A target sent by a client: only the two known objects, strings and finite numbers, then the engine's own validation.
 * Returns the target or a readable error. Runs before any paid call.
 */
export function shapeTarget(x: unknown): { ok: true; target: Target } | { ok: false; error: string } {
  const o = x as { regime?: unknown; continuous?: unknown } | null;
  if (o === null || typeof o !== "object" || Array.isArray(o)) return { ok: false, error: "target must be an object" };
  if (Object.keys(o).some((k) => k !== "regime" && k !== "continuous")) return { ok: false, error: "target has unknown fields" };
  const { regime, continuous } = o;
  if (typeof regime !== "object" || regime === null || Array.isArray(regime) || typeof continuous !== "object" || continuous === null || Array.isArray(continuous)) {
    return { ok: false, error: "target needs regime and continuous objects" };
  }
  if (Object.keys(regime).length > 8 || Object.keys(continuous).length > 12) return { ok: false, error: "target is too large" };
  for (const v of Object.values(regime)) if (typeof v !== "string" || v.length > 40) return { ok: false, error: "regime values must be short strings" };
  for (const v of Object.values(continuous)) if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: "continuous values must be finite numbers" };
  const target = { regime: { ...(regime as Record<string, string>) }, continuous: { ...(continuous as Record<string, number>) } } as Target;
  try {
    validateTarget(target);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "invalid target" };
  }
  return { ok: true, target };
}
