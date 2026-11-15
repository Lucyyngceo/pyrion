// Pure helpers of "Ask PYRION": reading the model's target, and building what the narrator may see.
// Relative .ts imports on purpose, so the unit tests can run them under `node --test`.

import { REGIME_VALUES, targetFromQuantities, validateTarget, type Evaluation, type Target, type TargetQuantities } from "../../engine/src/index.ts";
import { BANNED_PATTERNS, modelText } from "./narration-check.ts";
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
  /**
   * Regime axes the model proposed that the question does not state. They are NOT in the target: the target keeps only what
   * the question states. The user may apply one, and it is then marked as added by the user.
   */
  suggestions: { axis: string; value: string; reason: string }[];
}

/** A problem with the user's input that is shown as written, not as model text. */
export class PlainError extends Error {}

/** The oxygen-partial-pressure message, shared by the question check and the parse check. */
export const PARTIAL_PRESSURE_MESSAGE = "Oxygen partial pressure is not total pressure: give the total pressure and the O2 percentage.";

/**
 * Does the question give an oxygen partial pressure and no total pressure? ("partial pressure", "ppO2", "pO2", "21 kPa O2").
 * Checked before any model is called. A question that also says "total" is left to the parse step.
 */
export function questionHasOxygenPartialPressure(question: string): boolean {
  const q = question.normalize("NFKC").toLowerCase();
  const phrased = /partial pressure|\bppo2\b|\bpo2\b|p\(o2\)/.test(q) || /\d\s*(?:kpa|psia|psi|atm|bar|mbar|torr|mmhg|pa)\s*(?:of\s+)?(?:o2|oxygen)\b/.test(q);
  return phrased && !/\btotal\b/.test(q);
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

/**
 * Words in a question that state a regime value outright; a value the model supplies without one of them was inferred.
 * Gravity words are kept in one list: they are what states a gravity regime (Earth, Moon, Mars, free fall, in orbit, and
 * the Spanish words). "Candle" or "PMMA" do not state a fuel phase.
 */
const GRAVITY_WORDS: Record<"microgravity" | "partial_gravity" | "normal_gravity", RegExp> = {
  microgravity: /micro-?gravity|microgravedad|weightless|free[- ]?fall|ingravidez|caida libre|gravedad cero|zero[- ]?g(?:ravity)?\b|\b0 ?g\b|in orbit|en orbita|\borbital\b|space station|estacion espacial/,
  partial_gravity: /partial gravity|gravedad parcial|\blunar\b|\bmoon\b|\bmars\b|martian|\bluna\b|\bmarte\b/,
  normal_gravity: /normal gravity|gravedad normal|\bearth\b|\bterrestrial\b|ground[- ]based|\b1 ?g\b|sea[- ]level|\btierra\b|\bground\b/,
};
const STATES: Record<string, RegExp> = {
  solid: /\bsolids?\b|\bsolido\b/,
  liquid: /\bliquids?\b|\bdroplets?\b|\bliquido\b/,
  gas: /\bgas(?:es|eous)?\b|\bgaseoso\b/,
  N2: /\bn2\b|\bnitrogen\b|\bnitrogeno\b/,
  He: /\bhelium\b|\bhelio\b/,
  CO2: /\bco2\b|\bcarbon dioxide\b|\bdioxido de carbono\b/,
  Ar: /\bargon\b/,
  mixed: /\bmixed\b/,
  normal: /\bnormal flame\b/,
  inverse: /\binverse\b/,
  microgravity: GRAVITY_WORDS.microgravity,
  partial_gravity: GRAVITY_WORDS.partial_gravity,
  normal_gravity: GRAVITY_WORDS.normal_gravity,
};

/** Lowercase, accents removed: "gravedad cero" and "caída libre" match their unaccented patterns. */
const plainText = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFKC").toLowerCase();

const norm = (s: string) => plainText(s);

const UNIT_ALIAS: Record<string, string> = { psia: "psi", percent: "%", celsius: "c", degc: "c", "°c": "c", kilopascals: "kpa", kilopascal: "kpa", atmosphere: "atm", atmospheres: "atm" };
const TOKEN = /(\d+(?:\.\d+)?)\s*(%|°\s?c|[a-z]+(?:\/[a-z]+)?)?/g;

/** Numbers of a text with the unit written beside each (aliases folded: psia = psi, percent = %). */
function tokensOf(text: string): { value: number; unit: string }[] {
  return [...text.matchAll(TOKEN)].map((m) => {
    const u = (m[2] ?? "").replace(/\s+/g, "").toLowerCase();
    // A trailing word that is not a unit (for example "oxygen") is not treated as one.
    const unit = UNIT_ALIAS[u] ?? (/^(%|psi|kpa|pa|atm|bar|mbar|torr|mmhg|g|mm|cm|m|um|in|k|c|cm\/s|mm\/s|m\/s)$/.test(u) ? u : "");
    return { value: Number(m[1]), unit };
  });
}

/** Does the question state a gravity at all (a regime word, or a level)? */
export const statesGravity = (question: string) => Object.values(GRAVITY_WORDS).some((re) => re.test(plainText(question)));

/**
 * "Copy as written": a quantity the model returned is accepted only if its numbers (or, for names such as "lunar",
 * its words) are present in the question. A converted or invented value is not.
 */
export function supportedByQuestion(value: string, question: string, used: Set<number> = new Set()): boolean {
  const q = norm(question);
  const v = norm(value);
  const nums = tokensOf(v);
  if (nums.length > 0) {
    // Each number, with the unit the model wrote beside it, must be in the question, and a number in the question
    // may feed only one quantity (`used` holds the positions already taken).
    const inQuestion = tokensOf(q);
    const taken: number[] = [];
    for (const n of nums) {
      const at = inQuestion.findIndex((t, i) => !used.has(i) && !taken.includes(i) && t.value === n.value && t.unit === n.unit);
      if (at < 0) return false;
      taken.push(at);
    }
    taken.forEach((i) => used.add(i));
    return true;
  }
  return v
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3)
    .every((w) => q.includes(w));
}

/**
 * A pressure the question gives as an oxygen partial pressure ("partial pressure of 21 kPa", "ppO2 21 kPa",
 * "21 kPa O2") is not the total pressure: it must not become the target's pressure.
 */
export function isOxygenPartialPressure(value: string, question: string): boolean {
  const q = norm(question);
  for (const m of norm(value).matchAll(NUMS)) {
    const n = m[0].replace(/\./g, "\\.");
    if (new RegExp(`(?:partial pressure|ppo2|po2|p\\(o2\\))[^0-9]{0,40}${n}\\b`).test(q)) return true;
    if (new RegExp(`\\b${n}\\s*(?:kpa|psia|psi|atm|bar|mbar|torr|mmhg|pa)?\\s*(?:of\\s+)?(?:o2|oxygen)\\b`).test(q)) return true;
  }
  return false;
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
  const suggestions: ParsedTarget["suggestions"] = [];
  const gravityStated = typeof o.gravity === "string" && o.gravity !== "" && supportedByQuestion(o.gravity, question);
  const dropped: string[] = [];
  const used = new Set<number>();
  for (const k of [...QUANTITY_KEYS, ...REGIME_KEYS]) {
    const v = o[k];
    if (v === null || v === undefined || v === "") {
      unstated.push(k === "o2" ? "o2_mole_fraction" : k);
      continue;
    }
    if (typeof v !== "string") throw new Error(`${k} must be text as written in the question, or null`);
    if (k === "pressure" && isOxygenPartialPressure(v, question)) {
      throw new PlainError(PARTIAL_PRESSURE_MESSAGE);
    }
    if ((QUANTITY_KEYS as readonly string[]).includes(k) && !supportedByQuestion(v, question, used)) {
      unstated.push(k === "o2" ? "o2_mole_fraction" : k);
      dropped.push(`The model returned a value for ${k.replaceAll("_", " ")} that is not in the question (${modelText(v)}). It was ignored.`);
      continue;
    }
    // A regime axis the question does not state is a suggestion, never part of the target. A stated gravity gives the gravity regime.
    if ((REGIME_KEYS as readonly string[]).includes(k)) {
      if (k === "gravity_regime" && gravityStated) {
        unstated.push(k);
        continue;
      }
      if (!(REGIME_VALUES[k as keyof typeof REGIME_VALUES] ?? []).includes(v)) throw new Error(`${k} is not an allowed value`);
      if (!(STATES[v]?.test(plainText(question)) ?? false)) {
        suggestions.push({ axis: k, value: v, reason: "proposed by the model; the question does not state it" });
        unstated.push(k);
        continue;
      }
    }
    input[k] = v;
  }
  const r = targetFromQuantities(input as TargetQuantities);
  if (!r.ok) throw new Error(r.errors.map((e) => `${e.field}: ${e.message}`).join("; "));
  // A question that states no oxygen, pressure, gravity or regime is not about a combustion condition: no target, no verdicts.
  const t = r.target;
  if (Object.keys(t.continuous).length === 0 && Object.keys(t.regime).length === 0 && t.informational === undefined) {
    throw new PlainError("No combustion condition found in the question. Give at least an oxygen level, a pressure or a gravity.");
  }
  const assumptions = Array.isArray(o.assumptions) ? o.assumptions.filter((a): a is string => typeof a === "string" && keepAssumption(a, question)).slice(0, 5) : [];
  return {
    target: r.target,
    assumptions: assumptions.slice(0, 6),
    suggestions,
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
): { input: NarrationInput } {
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
  // A stated gravity level is informational in the engine's target (it selects the regime, it is not compared).
  const gl = target.informational?.gravity_level;
  if (gl !== undefined) tgt.gravity_level_g = gl;
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
  return { input };
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
  const o = x as { regime?: unknown; continuous?: unknown; informational?: unknown } | null;
  if (o === null || typeof o !== "object" || Array.isArray(o)) return { ok: false, error: "target must be an object" };
  if (Object.keys(o).some((k) => k !== "regime" && k !== "continuous" && k !== "informational")) return { ok: false, error: "target has unknown fields" };
  const { regime, continuous, informational } = o;
  if (typeof regime !== "object" || regime === null || Array.isArray(regime) || typeof continuous !== "object" || continuous === null || Array.isArray(continuous)) {
    return { ok: false, error: "target needs regime and continuous objects" };
  }
  if (Object.keys(regime).length > 8 || Object.keys(continuous).length > 12) return { ok: false, error: "target is too large" };
  for (const v of Object.values(regime)) if (typeof v !== "string" || v.length > 40) return { ok: false, error: "regime values must be short strings" };
  for (const v of Object.values(continuous)) if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: "continuous values must be finite numbers" };
  let info: Target["informational"];
  if (informational !== undefined) {
    if (typeof informational !== "object" || informational === null || Array.isArray(informational)) return { ok: false, error: "informational must be an object" };
    const i = informational as Record<string, unknown>;
    if (Object.keys(i).some((k) => k !== "gravity_level" && k !== "gravity_not_covered")) return { ok: false, error: "informational has unknown fields" };
    if (i.gravity_level !== undefined && (typeof i.gravity_level !== "number" || !Number.isFinite(i.gravity_level))) return { ok: false, error: "gravity_level must be a finite number" };
    if (i.gravity_not_covered !== undefined && (typeof i.gravity_not_covered !== "string" || i.gravity_not_covered.length > 300)) return { ok: false, error: "gravity_not_covered must be short text" };
    info = { ...(i.gravity_level !== undefined ? { gravity_level: i.gravity_level as number } : {}), ...(i.gravity_not_covered !== undefined ? { gravity_not_covered: i.gravity_not_covered as string } : {}) };
  }
  const target = { regime: { ...(regime as Record<string, string>) }, continuous: { ...(continuous as Record<string, number>) }, ...(info ? { informational: info } : {}) } as Target;
  try {
    validateTarget(target);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "invalid target" };
  }
  return { ok: true, target };
}
