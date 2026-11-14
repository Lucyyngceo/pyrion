// Deterministic narration check. Pure, no imports: runs in the browser, on the server and under `node --test`.
// A narration written by a language model is shown only if every number, every investigation id and every DOI
// in it appears in the engine's structured output, and none of the banned phrases is present.

/** Mirror of BANNED in validation/run_all.py (keep the two in step). */
export const BANNED_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bfirst (?:ever|in the world)\b|\bworld'?s first\b/i, label: "superlative claim" },
  { pattern: /\bvalidated by NASA\b|\bNASA[- ]validated\b|\bNASA[- ]approved\b|\bendorsed by NASA\b/i, label: "claim of NASA endorsement" },
  { pattern: /\bperfect accuracy\b|\b100 ?% accura/i, label: "accuracy claim" },
  { pattern: /\bno data exists?\b|\bnever been tested\b|\bnever tested\b/i, label: "absence claim" },
  { pattern: /\bautonomous end[- ]to[- ]end\b/i, label: "autonomy claim" },
  { pattern: /\bguarantee[sd]?\b|\bproven safe\b/i, label: "guarantee claim" }, // lang-ok: banned-phrase pattern, not a claim
  { pattern: /\bdiscover(?:y|ed|ies)\b/i, label: "discovery claim" }, // lang-ok: banned-phrase pattern, not a claim
  { pattern: /\bsafe\b/i, label: "safety claim" }, // lang-ok: banned-phrase pattern, not a claim
];

export const MAX_NARRATION_WORDS = 120;

const ID_RE = /\bPSI-\d+\b/g;
const DOI_RE = /\b10\.\d{4,9}\/[^\s,;)"']+/g;
const NUM_RE = /(?<![\w.])[-+]?\d+(?:\.\d+)?/g;

export interface Facts {
  ids: string[];
  dois: string[];
  /** The structured output given to the model, as text: every number in it is allowed. */
  source: string;
}

export interface CheckResult {
  ok: boolean;
  failures: string[];
}

const stripThousands = (s: string) => s.replace(/(\d),(?=\d{3}\b)/g, "$1");
const trimDoi = (d: string) => d.replace(/[.]+$/, "");

/** Numbers written in a text, after removing investigation ids and DOIs (their digits are not quantities). */
export function numbersIn(text: string): { raw: string; value: number; decimals: number }[] {
  const t = stripThousands(text.replace(DOI_RE, " ").replace(ID_RE, " "));
  return [...t.matchAll(NUM_RE)].map((m) => {
    const raw = m[0].replace(/^\+/, "");
    return { raw, value: Number(raw), decimals: (raw.split(".")[1] ?? "").length };
  });
}

/** A number written with d decimals matches a fact if rounding the fact to d decimals gives the same value. */
function matches(written: { value: number; decimals: number }, fact: number): boolean {
  if (written.value === fact) return true;
  return Number(fact.toFixed(written.decimals)) === written.value;
}

export function checkNarration(narration: string, facts: Facts): CheckResult {
  const failures: string[] = [];
  const text = narration.trim();
  if (text === "") return { ok: false, failures: ["the narration is empty"] };

  const words = text.split(/\s+/).length;
  if (words > MAX_NARRATION_WORDS) failures.push(`too long: ${words} words (limit ${MAX_NARRATION_WORDS})`);

  const allowedIds = new Set(facts.ids);
  for (const id of new Set(text.match(ID_RE) ?? [])) if (!allowedIds.has(id)) failures.push(`investigation ${id} is not in the engine output`);

  const allowedDois = new Set(facts.dois.map((d) => d.toLowerCase()));
  for (const d of new Set((text.match(DOI_RE) ?? []).map(trimDoi))) if (!allowedDois.has(d.toLowerCase())) failures.push(`DOI ${d} is not in the engine output`);

  const factNumbers = numbersIn(facts.source).map((n) => n.value);
  for (const n of numbersIn(text)) {
    if (!factNumbers.some((f) => matches(n, f))) failures.push(`the number ${n.raw} is not in the engine output`);
  }

  for (const b of BANNED_PATTERNS) if (b.pattern.test(text)) failures.push(`banned phrase (${b.label})`);

  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}
