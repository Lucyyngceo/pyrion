// Deterministic narration check. Pure, no imports: runs on the server and under `node --test`.
// Nothing a model writes about counts or verdicts is trusted: every number must match a fact exactly (integers),
// with the same unit word; a verdict word in a sentence that names an investigation must be that investigation's
// verdict; a DOI must be the one paired with the investigation named beside it; names of investigations that are not
// in the engine output, known non-PSI names, spelled-out numbers and banned phrases are rejected.

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
export type UnitClass = "" | "%" | "kPa" | "psia" | "g" | "count";

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

const ID_RE = /\bPSI-\d+\b/g;
const DOI_RE = /\b10\.\d{4,9}\/[^\s,;)"']+/g;
const NUM_RE = /(?<![\w.])([-+]?\d+(?:\.\d+)?)(?:\s*(%|[A-Za-z]+))?/g;
const SPELLED = /\b(zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen|half)\b/i;

const stripThousands = (s: string) => s.replace(/(\d),(?=\d{3}\b)/g, "$1");
const trimDoi = (d: string) => d.replace(/[.]+$/, "");

/** The unit class a following word stands for. */
export function unitClass(word: string | undefined): UnitClass {
  const w = (word ?? "").toLowerCase();
  if (w === "%" || w === "percent") return "%";
  if (w === "kpa") return "kPa";
  if (w === "psi" || w === "psia") return "psia";
  if (w === "g") return "g";
  if (/^(investigations?|experiments?|tests?|studies|study|records?)$/.test(w)) return "count";
  return "";
}

/** Numbers written in a text with their unit class. Investigation ids and DOIs are removed first: their digits are not quantities. */
export function quantitiesIn(text: string): { raw: string; value: number; decimals: number; cls: UnitClass }[] {
  const t = stripThousands(text.replace(DOI_RE, " ").replace(ID_RE, " "));
  return [...t.matchAll(NUM_RE)].map((m) => {
    const raw = m[1].replace(/^\+/, "");
    return { raw, value: Number(raw), decimals: (raw.split(".")[1] ?? "").length, cls: unitClass(m[2]) };
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

const VERDICT_WORDS: { re: RegExp; verdict: Verdict }[] = [
  { re: /\bnot (?:directly )?comparable\b|\bregime barrier\b|REGIME_BARRIER/i, verdict: "REGIME_BARRIER" },
  { re: /\binsufficient evidence\b|INSUFFICIENT_EVIDENCE/i, verdict: "INSUFFICIENT_EVIDENCE" },
  { re: /\bextrapolat\w*|EXTRAPOLATION/i, verdict: "EXTRAPOLATION" },
  { re: /(?<!not )(?<!un)\bapplicable\b|APPLICABLE/, verdict: "APPLICABLE" },
];

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

  // Investigation ids: only those in the output.
  for (const id of new Set(text.match(ID_RE) ?? [])) if (!byId.has(id)) failures.push(`investigation ${id} is not in the engine output`);

  // Per sentence: verdict words and DOIs bound to the investigation named in the same sentence.
  for (const sentence of sentencesOf(text)) {
    const ids = [...new Set(sentence.match(ID_RE) ?? [])].filter((i) => byId.has(i));
    const said = VERDICT_WORDS.filter((v) => v.re.test(sentence)).map((v) => v.verdict);
    if (/\bnot applicable\b/i.test(sentence)) failures.push(`"not applicable" is not an engine verdict (${sentence.slice(0, 50)}…)`);
    if (ids.length > 0 && said.length > 0) {
      for (const id of ids) {
        for (const v of said) if (byId.get(id)!.verdict !== v) failures.push(`${id} is ${byId.get(id)!.verdict} in the engine output, not ${v}`);
      }
    }
    for (const d of new Set((sentence.match(DOI_RE) ?? []).map(trimDoi))) {
      const owner = doiOwner.get(d.toLowerCase());
      if (!owner) failures.push(`DOI ${d} is not in the engine output`);
      else if (ids.length === 0) failures.push(`DOI ${d} appears without the investigation it belongs to (${owner})`);
      else if (!ids.includes(owner)) failures.push(`DOI ${d} belongs to ${owner}, not to ${ids.join(", ")}`);
    }
  }

  // Numbers: exact for integers, same unit class as the fact.
  for (const n of quantitiesIn(text)) {
    const candidates = facts.numbers.filter((f) => sameValue(n, f.value));
    const ok = n.cls === "" ? candidates.length > 0 : candidates.some((f) => f.cls === n.cls);
    if (!ok) failures.push(candidates.length > 0 ? `the number ${n.raw} is written with the wrong unit (${n.cls})` : `the number ${n.raw} is not in the engine output`);
  }
  const spelled = text.match(SPELLED);
  if (spelled) failures.push(`spelled-out number "${spelled[0]}": write numbers as digits that can be checked`);

  // Names: investigations not in the output, titles of those, and known non-PSI names.
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
