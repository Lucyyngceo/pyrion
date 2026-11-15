// centinela:off (false positive: this file DEFINES the language gate that catches those phrases; it never says them)
// "Check a claim": paste a text, get each atomic claim classified against what PYRION can show.
// The model only PROPOSES (the claims, and candidate sentences of NASA passages); every classification is made by code:
//   contradicted          the engine gives another verdict for the investigation and condition the claim names, or a verified
//                         NASA quote says otherwise (a different number, or a negation the claim lacks)
//   overclaim             language gate: safe, validated by NASA, first, proves, no data exists, ... (validation/run_all.py BANNED, plus Spanish)
//   supported in PSI      the engine gives the claimed verdict, or a verified NASA quote contains every number the claim states
//   not supported in PSI  everything else: no passage, no engine evidence, or a citation that did not verify
// Every classification carries its verified citations or its engine reference. Pure: model and library come in through the context.

import { canonicalJson, evaluate, sha256Hex, type ConditionRecord, type Verdict } from "../../../engine/src/index.ts";
import { verdictLabel } from "../../../engine/src/labels.ts";
import { citationProblem, numbersIn, type Corpus, type VerifiedCitation } from "./claims.ts";
import { conditionFromMessage } from "./condition.ts";
import { extractJson, type AskModel } from "./model.ts";

export type ClaimClass = "supported in PSI" | "not supported in PSI" | "contradicted" | "overclaim";

export interface ClaimPassage {
  doc_id: string;
  page_start: number;
  text: string;
  title?: string;
  url?: string;
}

export interface ClaimContext {
  corpus: Corpus;
  askModel: AskModel;
  /** The NASA library search (code). */
  search: (query: string, top?: number) => Promise<ClaimPassage[]>;
  records: readonly ConditionRecord[];
  catalog?: Record<string, { acronym: string; title: string; doi: string }>;
}

export interface EngineRef {
  accession: string;
  claimedVerdict: string;
  engineVerdict: string;
  target: string;
  fingerprint: string;
  doi?: string;
}

export interface ClaimResult {
  text: string;
  class: ClaimClass;
  citations: VerifiedCitation[];
  engineRefs: EngineRef[];
  /** Overclaim patterns found in the claim's wording. */
  overclaimPatterns: string[];
  /** One plain sentence (a fixed template) saying why. */
  reason: string;
}

export interface ClaimCheck {
  claims: ClaimResult[];
  counts: Record<ClaimClass, number>;
  /** The models that proposed (claims, passages); empty when none was available and the code split the text itself. */
  models: string[];
  /** What the code threw away, never shown with the model's words. */
  dropped: string[];
}

export const MAX_CLAIMS = 12;

/** The language gate. The first group is `BANNED` of validation/run_all.py; the rest are the same ideas, plus Spanish. */
export const OVERCLAIM_PATTERNS: readonly { name: string; re: RegExp }[] = [
  { name: "first in the world", re: /\b(?:first ever|first in the world|world'?s first)\b|\bprimer[oa]? (?:del mundo|en el mundo)\b/i },
  { name: "validated by NASA", re: /\b(?:validated by NASA|NASA[- ]validated|NASA[- ]approved|endorsed by NASA|approved by NASA)\b|\bvalidad[oa] por la? NASA\b|\baprobad[oa] por la? NASA\b/i },
  { name: "perfect accuracy", re: /\b(?:perfect accuracy|100 ?% accura\w*)\b|\bprecisi[oó]n perfecta\b/i },
  { name: "no data exists", re: /\b(?:no data exists?|never been tested|never tested|nobody has (?:ever )?tested)\b|\bno existen datos\b|\bnunca se ha probado\b/i },
  { name: "autonomous end-to-end", re: /\bautonomous end[- ]to[- ]end\b/i },
  { name: "guarantee", re: /\b(?:guarantee[sd]?|proven safe)\b|\bgarantiza\w*\b/i },
  { name: "proves", re: /\b(?:prove[sd]?|proven|proof that)\b|\bdemuestra\w*\b|\bprueba que\b/i },
  { name: "discovery", re: /\bdiscover(?:y|ed|ies)\b|\bdescubrimiento\b/i },
  { name: "safe", re: /\b(?:safe|safely|safety guaranteed|harmless)\b|\b(?:seguro|segura|seguros|inofensiv[oa])\b/i },
];

const CLAIMED_VERDICTS: { re: RegExp; verdict: Verdict }[] = [
  { re: /\b(?:not comparable|different regime|regime barrier|no es comparable)\b/i, verdict: "REGIME_BARRIER" },
  { re: /\b(?:insufficient evidence|not enough evidence|evidencia insuficiente)\b/i, verdict: "INSUFFICIENT_EVIDENCE" },
  { re: /\b(?:extrapolation|extrapolat\w+|extrapolaci[oó]n)\b/i, verdict: "EXTRAPOLATION" },
  { re: /\b(?:applicable|applies|apply|aplicable|aplica)\b/i, verdict: "APPLICABLE" },
];

const STOP = new Set("that this with from have has had were been being would could should about which their there than then them they what when where while will your into over also only such these those more most some very much many each other".split(" "));
const words = (s: string) => (s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[a-z0-9]{4,}/g) ?? []).filter((w) => !STOP.has(w));
const overlap = (a: string, b: string) => {
  const wb = new Set(words(b));
  return [...new Set(words(a))].filter((w) => wb.has(w)).length;
};
const NEGATION = /\b(?:not|no|never|cannot|without|neither|nor|none)\b/i;

export const CLAIM_SPLIT_SYSTEM = `Split the pasted text into atomic factual claims: one checkable statement each, copied or lightly shortened from the text, at most ${MAX_CLAIMS}. Reply with ONLY JSON: {"claims":["...","..."]}. Do not add claims that are not in the text. Do not judge them.`;
export const CLAIM_FIND_SYSTEM = `You are given one claim and numbered passages of NASA documents. Reply with ONLY JSON: {"candidates":[{"doc_id":"...","page":1,"quote":"words copied exactly from that page","relation":"supports"|"contradicts"}]}. A quote must be copied exactly from the passage text of that doc_id and page, at most 200 characters. Return [] if nothing in the passages bears on the claim. Do not judge the claim beyond relation.`;

/** The atomic claims: the model's proposals that really come from the text, or the text's own sentences. */
async function splitClaims(text: string, ctx: ClaimContext, models: Set<string>, dropped: string[]): Promise<string[]> {
  const own = text.split(/(?<=[.!?;])\s+|\n+/).map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length >= 12);
  const wordsOfText = new Set(words(text));
  try {
    const r = await ctx.askModel({ purpose: "split claims", prefer: [], avoidFamilies: [], messages: [{ role: "system", content: CLAIM_SPLIT_SYSTEM }, { role: "user", content: text }] });
    models.add(r.name ?? r.model);
    const j = extractJson(r.text) as { claims?: unknown } | null;
    const proposed = Array.isArray(j?.claims) ? (j!.claims as unknown[]).filter((c): c is string => typeof c === "string" && c.trim().length >= 8) : [];
    const kept: string[] = [];
    for (const c of proposed) {
      const w = words(c);
      // A proposed claim must come from the pasted text: almost all of its words are in it.
      if (w.length > 0 && w.filter((x) => wordsOfText.has(x)).length / w.length >= 0.8) kept.push(c.trim());
      else dropped.push(`claim not in the pasted text: "${c.slice(0, 60)}"`);
    }
    if (kept.length > 0) return kept.slice(0, MAX_CLAIMS);
  } catch {
    dropped.push("the model could not split the text; the code split it into sentences");
  }
  return own.slice(0, MAX_CLAIMS);
}

function overclaims(text: string): string[] {
  return OVERCLAIM_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
}

/** Content numbers of a claim, without investigation ids and the like. */
const claimNumbers = (text: string) => numbersIn(text.replace(/PSI-\d+/g, " ").replace(/\b[A-Za-z]+(?:-[A-Za-z]+)*-\d+[A-Za-z]*\b/g, " "));

export async function checkClaim(text: string, ctx: ClaimContext): Promise<ClaimCheck> {
  const models = new Set<string>();
  const dropped: string[] = [];
  const claimTexts = await splitClaims(text, ctx, models, dropped);
  const docCondition = conditionFromMessage(text);
  const evalCache = new Map<string, { verdicts: Map<string, Verdict>; fingerprint: string }>();
  const evaluateFor = (target: NonNullable<typeof docCondition.target>) => {
    const key = canonicalJson(target);
    if (!evalCache.has(key)) {
      const ev = evaluate(ctx.records, target);
      evalCache.set(key, { verdicts: new Map(ev.investigations.map((i) => [i.accession, i.verdict])), fingerprint: sha256Hex(canonicalJson(ev)) });
    }
    return evalCache.get(key)!;
  };

  const results: ClaimResult[] = [];
  for (const claim of claimTexts) {
    const patterns = overclaims(claim);
    const citations: VerifiedCitation[] = [];
    const engineRefs: EngineRef[] = [];
    let klass: ClaimClass | null = null;
    let reason = "";

    // ---- engine: a claim that names an investigation and a verdict, at a condition ----
    const id = /PSI-\d+/i.exec(claim)?.[0].toUpperCase();
    const claimed = CLAIMED_VERDICTS.find((v) => v.re.test(claim))?.verdict;
    const own = conditionFromMessage(claim);
    const target = own.target ?? docCondition.target;
    if (id && claimed) {
      if (!target) {
        reason = `The claim names ${id} and a verdict but no condition, so the engine cannot check it.`;
      } else {
        const e = evaluateFor(target);
        const got = e.verdicts.get(id);
        if (got === undefined) {
          reason = `${id} is not among the investigations extracted from PSI.`;
        } else {
          const cat = ctx.catalog?.[id];
          engineRefs.push({ accession: id, claimedVerdict: verdictLabel(claimed), engineVerdict: verdictLabel(got), target: own.conversions.concat(docCondition.conversions).join("; ") || "the condition in the text", fingerprint: e.fingerprint, ...(cat ? { doi: cat.doi } : {}) });
          if (got === claimed) {
            klass = "supported in PSI";
            reason = `The engine gives ${verdictLabel(got)} for ${id} at that condition.`;
          } else {
            klass = "contradicted";
            reason = `The engine gives ${verdictLabel(got)} for ${id} at that condition, not ${verdictLabel(claimed)}.`;
          }
        }
      }
    }

    // ---- NASA passages: proposed by the model, verified by code ----
    if (klass === null || klass === "supported in PSI") {
      let passages: ClaimPassage[] = [];
      try {
        passages = await ctx.search(claim, 5);
      } catch {
        dropped.push(`search failed for: "${claim.slice(0, 60)}"`);
      }
      if (passages.length > 0 && klass === null) {
        try {
          const r = await ctx.askModel({
            purpose: "find passages",
            prefer: [],
            avoidFamilies: [],
            messages: [
              { role: "system", content: CLAIM_FIND_SYSTEM },
              { role: "user", content: JSON.stringify({ claim, passages: passages.map((p) => ({ doc_id: p.doc_id, page: p.page_start, text: p.text.slice(0, 900) })) }) },
            ],
          });
          models.add(r.name ?? r.model);
          const j = extractJson(r.text) as { candidates?: unknown } | null;
          const cands = Array.isArray(j?.candidates) ? (j!.candidates as unknown[]) : [];
          const nums = claimNumbers(claim);
          for (const c of cands) {
            const x = c as { doc_id?: unknown; page?: unknown; quote?: unknown; relation?: unknown };
            const problem = citationProblem(x, ctx.corpus);
            if (problem) {
              dropped.push(`candidate quote not verified (${problem})`);
              continue;
            }
            const cite = x as { doc_id: string; page: number; quote: string };
            if (overlap(claim, cite.quote) < 2) {
              dropped.push("candidate quote shares too few words with the claim");
              continue;
            }
            const page = ctx.corpus.get(cite.doc_id, cite.page);
            const url = page?.url ?? page?.file_url;
            const verified: VerifiedCitation = { doc_id: cite.doc_id, page: cite.page, quote: cite.quote, ...(page?.title ? { title: page.title } : {}), ...(url ? { url } : {}), ...(page?.doi ? { doi: page.doi } : {}), ...(page?.ntrs_id ? { ntrs_id: page.ntrs_id } : {}) };
            const qn = numbersIn(cite.quote);
            if (x.relation === "supports") {
              // Supported only if every number the claim states is in the quote as written.
              if (nums.every((n) => qn.includes(n))) {
                citations.push(verified);
                if (klass === null) {
                  klass = "supported in PSI";
                  reason = "A NASA quote, verified on its page, contains what the claim states.";
                }
              } else dropped.push("a supporting quote does not contain every number of the claim");
            } else if (x.relation === "contradicts") {
              // Contradiction needs evidence the code can see: a different number, or a negation the claim does not have.
              const numericMismatch = nums.length > 0 && qn.length > 0 && nums.every((n) => !qn.includes(n));
              const negation = nums.length === 0 && NEGATION.test(cite.quote) && !NEGATION.test(claim);
              if (numericMismatch || negation) {
                citations.push(verified);
                klass = "contradicted";
                reason = numericMismatch ? "A NASA quote, verified on its page, gives different numbers." : "A NASA quote, verified on its page, says the opposite.";
                break;
              }
              dropped.push("a contradicting quote is not a visible contradiction (no different number, no negation)");
            }
          }
        } catch {
          dropped.push("the model could not propose passages");
        }
      }
    }

    // ---- the language gate and the final class ----
    if (klass !== "contradicted" && patterns.length > 0) {
      klass = "overclaim";
      reason = `The wording overclaims (${patterns.join(", ")}): PYRION never says that; it says what the records in PSI show.`;
    }
    if (klass === null) {
      klass = "not supported in PSI";
      reason ||= "No engine evidence and no verified NASA passage supports this in PSI.";
    }
    results.push({ text: claim, class: klass, citations, engineRefs, overclaimPatterns: patterns, reason });
  }

  const counts: Record<ClaimClass, number> = { "supported in PSI": 0, "not supported in PSI": 0, contradicted: 0, overclaim: 0 };
  for (const r of results) counts[r.class] += 1;
  return { claims: results, counts, models: [...models], dropped };
}
