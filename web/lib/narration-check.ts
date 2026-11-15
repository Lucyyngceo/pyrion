// Deterministic narration check. Pure, no imports: runs on the server and under `node --test`.
// Nothing a model writes about counts or verdicts is trusted. A sentence that makes a verdict claim (applicable,
// comparable, extrapolation, barrier, insufficient) or uses a quantifier (none, all, only, every, closest) must name
// an investigation of the engine output whose verdict agrees, negation included. Every number must match a fact
// exactly (integers) with the same unit; unit words the check does not know are rejected. A DOI must be the one
// paired with the investigation named beside it. Investigations and non-PSI names not in the output, spelled-out
// numbers above ten and banned phrases are rejected.

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

/** Names that are not PSI investigations: never allowed in a narration unless the engine output itself contains them. */
export const NON_PSI_NAMES = ["LUCI", "FM2", "SoFIE", "FLARE", "Saffire", "SIBAL"];

export type Verdict = "APPLICABLE" | "EXTRAPOLATION" | "INSUFFICIENT_EVIDENCE" | "REGIME_BARRIER";
export type UnitClass = "" | "%" | "kPa" | "psia" | "atm" | "mm" | "cm" | "m/s" | "cm/s" | "g" | "K" | "°C" | "count";

export interface Fact {
  value: number;
  /** Unit class of the quantity, "" when it has none. */
  cls: UnitClass;
}

export interface Facts {
  /** Investigations in the engine output, with their verdict and DOI. */
  top: { accession: string; acronym: string; doi: string; verdict: Verdict }[];
  /** Every investigation of the dataset: those not in `top` may not be named. */
  all: { accession: string; acronym: string; title: string }[];
  /** Numbers (with unit class) of the engine output. */
  numbers: Fact[];
  /** The engine output as text, for the "is this name already in the output" test. */
  source: string;
}

export interface CheckResult {
  ok: boolean;
  failures: string[];
}

/** Model text quoted in a message: short, and labelled as unused. */
export const modelText = (s: string, n = 80) => `model text (not used): "${s.length > n ? `${s.slice(0, n)}…` : s}"`;

const ID_RE = /\bPSI-\d+\b/g;
const DOI_RE = /\b10\.\d{4,9}\/[^\s,;)"']+/g;
const SPELLED_VALUE: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const SPELLED_UNSUPPORTED = /\b(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen|half)\b/i;
// A number (digits, or one…ten in words) and the unit-like word after it.
const NUM_RE = /(?<![\w.])(?:([-+]?\d+(?:\.\d+)?)|\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b)(?:\s*(%|°\s?C|[A-Za-z]+(?:\/[A-Za-z]+)?))?/gi;

const UNIT_WORDS: Record<string, UnitClass> = {
  "%": "%", percent: "%",
  kpa: "kPa", kilopascal: "kPa", kilopascals: "kPa",
  psi: "psia", psia: "psia",
  atm: "atm", atmosphere: "atm", atmospheres: "atm",
  mm: "mm", millimeter: "mm", millimeters: "mm", millimetre: "mm", millimetres: "mm",
  cm: "cm", centimeter: "cm", centimeters: "cm",
  "m/s": "m/s", "cm/s": "cm/s",
  g: "g",
  k: "K", kelvin: "K",
  "°c": "°C", celsius: "°C",
  investigation: "count", investigations: "count", experiment: "count", experiments: "count", test: "count", tests: "count", study: "count", studies: "count", record: "count", records: "count",
};
/** Unit words that are not in the small supported list: a number followed by one is rejected. */
const UNKNOWN_UNITS = new Set(["torr", "bar", "mbar", "pascal", "pascals", "pa", "mmhg", "fahrenheit", "seconds", "second", "minutes", "minute", "hours", "hour", "mol", "mole", "moles", "kg", "lb", "lbs", "inches", "inch", "meters", "metres", "feet", "foot", "joules", "watts"]);

const stripThousands = (s: string) => s.replace(/(\d),(?=\d{3}\b)/g, "$1");
const trimDoi = (d: string) => d.replace(/[.]+$/, "");

/** The unit class a following word stands for ("" when it is not a unit word). */
export function unitClass(word: string | undefined): UnitClass {
  const w = (word ?? "").toLowerCase().replace(/\s+/g, "");
  return UNIT_WORDS[w] ?? "";
}

export interface Quantity {
  raw: string;
  value: number;
  decimals: number;
  cls: UnitClass;
  /** The unit-like word as written, when it is one the check knows to reject. */
  unknownUnit?: string;
}

/** Numbers written in a text (digits, or one…ten) with their unit class. Investigation ids and DOIs are removed first. */
export function quantitiesIn(text: string): Quantity[] {
  const t = stripThousands(text.replace(DOI_RE, " ").replace(ID_RE, " "));
  return [...t.matchAll(NUM_RE)].map((m) => {
    const word = m[3];
    const spelled = m[2] !== undefined;
    const raw = spelled ? m[2] : m[1].replace(/^\+/, "");
    const value = spelled ? SPELLED_VALUE[m[2].toLowerCase()] : Number(raw);
    const unknown = word && UNKNOWN_UNITS.has(word.toLowerCase()) ? word : undefined;
    return { raw, value, decimals: spelled ? 0 : (raw.split(".")[1] ?? "").length, cls: unitClass(word), ...(unknown ? { unknownUnit: unknown } : {}) };
  });
}

/** Kept for callers that only need the values. */
export const numbersIn = (text: string) => quantitiesIn(text).map(({ raw, value, decimals }) => ({ raw, value, decimals }));

/** Facts from a text (numbers in the engine's own reason messages), each with the unit class of the word after it. */
export function factsFromText(text: string): Fact[] {
  return quantitiesIn(text).map((q) => ({ value: q.value, cls: q.cls }));
}

/** Integers must match exactly. A decimal may be a rounding of the fact, to the decimals written. */
function sameValue(written: { value: number; decimals: number }, fact: number): boolean {
  if (written.value === fact) return true;
  if (written.decimals === 0) return false;
  return Number(fact.toFixed(written.decimals)) === written.value;
}

// ---- verdict claims, with negation

interface Claim {
  /** Verdicts an investigation may have for the claim to be true. */
  allowed: Verdict[];
  text: string;
}
const ALL: Verdict[] = ["APPLICABLE", "EXTRAPOLATION", "INSUFFICIENT_EVIDENCE", "REGIME_BARRIER"];
const not = (v: Verdict[]) => ALL.filter((x) => !v.includes(x));
const NEG_BEFORE = /(?:\bnot|\bno|\bnever|\bneither|\bnor|\bcannot|n't|\bwithout|\bnone)\W+(?:\w+\W+){0,3}$/i;

/** Verdict words: a pattern, and the verdicts that make the positive claim true. */
const CLAIM_WORDS: { re: RegExp; positive: Verdict[]; neg?: Verdict[] }[] = [
  { re: /\b(in|non-?)?applica(?:ble|bility)\b|\bapplies\b|\bapply\b|\bapplying\b|APPLICABLE/gi, positive: ["APPLICABLE"] },
  { re: /\b(in|non-?)?comparable\b|\bcomparab\w+/gi, positive: ["APPLICABLE", "EXTRAPOLATION"], neg: ["REGIME_BARRIER"] },
  { re: /\bextrapolat\w*|EXTRAPOLATION/gi, positive: ["EXTRAPOLATION"] },
  { re: /\bbarriers?\b|REGIME_BARRIER/gi, positive: ["REGIME_BARRIER"] },
  { re: /\binsufficient\b|INSUFFICIENT_EVIDENCE/gi, positive: ["INSUFFICIENT_EVIDENCE"] },
];
const QUANTIFIER = /\b(none|all|only|every|each|no investigations?|one investigation|closest|nearest|most|best)\b/i;

export function claimsOf(sentence: string): Claim[] {
  const out: Claim[] = [];
  for (const w of CLAIM_WORDS) {
    for (const m of sentence.matchAll(w.re)) {
      const word = m[0];
      const prefixNegated = /^(in|non-?)/i.test(word) && /^(in|non-?)(applica|comparab)/i.test(word);
      const before = sentence.slice(0, m.index ?? 0);
      const negated = prefixNegated !== NEG_BEFORE.test(before); // "not inapplicable" reverses back
      out.push({ allowed: negated ? (w.neg ?? not(w.positive)) : w.positive, text: word });
    }
  }
  return out;
}

const sentencesOf = (t: string) => t.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (w: string) => new RegExp(`(?<![A-Za-z0-9])${esc(w)}(?![A-Za-z0-9])`, "i");

export function checkNarration(narration: string, facts: Facts): CheckResult {
  const failures: string[] = [];
  const text = narration.trim();
  if (text === "") return { ok: false, failures: ["the narration is empty"] };

  const words = text.split(/\s+/).length;
  if (words > MAX_NARRATION_WORDS) failures.push(`too long: ${words} words (limit ${MAX_NARRATION_WORDS})`);

  const byId = new Map(facts.top.map((t) => [t.accession, t]));
  const doiOwner = new Map(facts.top.map((t) => [t.doi.toLowerCase(), t.accession]));

  for (const id of new Set(text.match(ID_RE) ?? [])) if (!byId.has(id)) failures.push(`investigation ${id} is not in the engine output`);

  for (const sentence of sentencesOf(text)) {
    const ids = [...new Set(sentence.match(ID_RE) ?? [])].filter((i) => byId.has(i));
    const claims = claimsOf(sentence);
    // A verdict claim or a quantifier must be about a named investigation of the output, and the verdict must agree.
    if (claims.length > 0 || QUANTIFIER.test(sentence)) {
      if (ids.length === 0) failures.push(`a verdict statement without an investigation id: ${modelText(sentence)}`);
      else {
        for (const id of ids) {
          for (const c of claims) if (!c.allowed.includes(byId.get(id)!.verdict)) failures.push(`${id} is ${byId.get(id)!.verdict} in the engine output, which contradicts "${c.text}"`);
        }
      }
    }
    for (const d of new Set((sentence.match(DOI_RE) ?? []).map(trimDoi))) {
      const owner = doiOwner.get(d.toLowerCase());
      if (!owner) failures.push(`DOI ${modelText(d)} is not in the engine output`);
      else if (ids.length === 0) failures.push(`DOI ${modelText(d)} appears without the investigation it belongs to (${owner})`);
      else if (!ids.includes(owner)) failures.push(`DOI ${modelText(d)} belongs to ${owner}, not to ${ids.join(", ")}`);
    }
  }

  // Numbers: exact for integers; a unit word must be one the facts carry for that value; unknown unit words are rejected.
  for (const n of quantitiesIn(text)) {
    if (n.unknownUnit) {
      failures.push(`the unit ${modelText(n.unknownUnit, 20)} is not one the check supports (kPa, psi, atm, mm, cm, m/s, cm/s, g, K, °C, %)`);
      continue;
    }
    const candidates = facts.numbers.filter((f) => sameValue(n, f.value));
    const ok = n.cls === "" ? candidates.length > 0 : candidates.some((f) => f.cls === n.cls);
    if (!ok) failures.push(candidates.length > 0 ? `the number ${n.raw} is written with a unit (${n.cls}) the engine output does not have for it` : `the number ${n.raw} is not in the engine output`);
  }
  const spelled = text.match(SPELLED_UNSUPPORTED);
  if (spelled) failures.push(`spelled-out number ${modelText(spelled[0], 20)}: write numbers as digits that can be checked`);

  const source = facts.source.toLowerCase();
  for (const inv of facts.all) {
    if (byId.has(inv.accession)) continue;
    const parts = inv.acronym.split("/").map((p) => p.trim()).filter((p) => p.length >= 3);
    for (const p of parts) if (wordRe(p).test(text) && !source.includes(p.toLowerCase())) failures.push(`${p} is not in the engine output`);
    const tw = inv.title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const lower = text.toLowerCase().replace(/[^a-z0-9]+/g, " ");
    for (let i = 0; i + 4 <= tw.length; i++) {
      if (lower.includes(tw.slice(i, i + 4).join(" ")) && !source.includes(tw.slice(i, i + 4).join(" "))) {
        failures.push(`the title of ${inv.accession} is quoted, but it is not in the engine output`);
        break;
      }
    }
  }
  for (const name of NON_PSI_NAMES) if (wordRe(name).test(text) && !source.includes(name.toLowerCase())) failures.push(`${name} is not in the engine output`);

  for (const b of BANNED_PATTERNS) if (b.pattern.test(text)) failures.push(`banned phrase (${b.label})`);

  return { ok: failures.length === 0, failures: [...new Set(failures)] };
}
