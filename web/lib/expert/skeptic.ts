// A second opinion on a checked answer, from a model of a DIFFERENT family than the one that wrote it.
// The reviewer never changes the answer: its objections are shown beside it. Every objection must point to a block; a
// NASA quote in an objection goes through the same quote check as the answer's own (an unverified one is dropped); the
// reviewer's wording is scrubbed of numbers that are not in the answer. Pure: the model comes in through `AskModel`.

import { citationProblem, numberFacts, numbersIn, scrubNumbers, type Corpus, type KeptBlock, type VerifiedCitation } from "./claims.ts";
import { extractJson, modelFamily, reviewerPreference, type AskModel } from "./model.ts";

export interface Objection {
  /** Index of the block (in the checked answer) the objection is about. */
  blockIndex: number;
  reason: string;
  /** A NASA quote that supports the objection, verified on its page. */
  citation?: VerifiedCitation;
}

export interface SkepticResult {
  verdict: "agree" | "object" | "unavailable";
  objections: Objection[];
  /** The reviewing model; null when none answered. */
  model: { model: string; name?: string; family: string } | null;
  /** Who wrote the answer, as given. */
  answeredBy: string | null;
  /** What the code threw away, with the reason (never shown with the model's words). */
  dropped: { kind: "objection" | "citation" | "reply"; reason: string }[];
  /** Why the verdict is "unavailable", in plain words. */
  note?: string;
}

export interface SkepticContext {
  corpus: Corpus;
  askModel: AskModel;
  /** The model id that wrote the answer. */
  answeredBy?: string | null;
  /** Model ids this server can use (limits the preference list). */
  available?: readonly string[];
}

export const SKEPTIC_SYSTEM = `You are a skeptical reviewer of an answer written by another AI for PYRION, a tool that compares a combustion condition with NASA PSI investigations. You are shown the question and the answer as numbered blocks. Find statements that are unsupported, overclaimed, wrong, or that the cited quote does not say. Rules:
- Reply with ONLY one JSON object: {"verdict":"agree"|"object","objections":[{"blockIndex":0,"reason":"one or two plain sentences","citation":{"doc_id":"...","page":1,"quote":"exact words from that page"}}]}.
- "agree" means you found nothing to object to; then objections is [].
- Every objection MUST give the blockIndex of the block it is about. "citation" is optional: use it only for words copied exactly from a NASA page you were shown in the answer's citations.
- Do not write numbers that are not already in the answer. Do not write verdict codes or snake_case names. Do not rewrite the answer.`;

const MAX_REASON = 400;

const plain = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/\b(APPLICABLE|EXTRAPOLATION|INSUFFICIENT_EVIDENCE|REGIME_BARRIER)\b/g, (m) => m.toLowerCase().replace(/_/g, " "))
    .replace(/\b([a-z0-9]+)_([a-z0-9_]+)\b/g, (m) => m.replace(/_/g, " "))
    .trim();

const unavailable = (answeredBy: string | null, note: string, dropped: SkepticResult["dropped"] = [], model: SkepticResult["model"] = null): SkepticResult => ({
  verdict: "unavailable",
  objections: [],
  model,
  answeredBy,
  dropped,
  note,
});

export async function reviewSecondOpinion(question: string, checkedAnswer: readonly KeptBlock[], ctx: SkepticContext): Promise<SkepticResult> {
  const answeredBy = ctx.answeredBy ?? null;
  const ownFamily = modelFamily(answeredBy);
  const prefer = reviewerPreference(answeredBy, ctx.available);
  if (checkedAnswer.length === 0) return unavailable(answeredBy, "There is no answer to review.");
  if (prefer.length === 0) return unavailable(answeredBy, "No model of another family is available to give a second opinion.");

  const shown = checkedAnswer.map((b, i) => ({ blockIndex: i, layer: b.layer, text: b.text, citations: b.citations.map((c) => ({ doc_id: c.doc_id, page: c.page, quote: c.quote })) }));
  let reply;
  try {
    reply = await ctx.askModel({
      purpose: "second opinion",
      prefer,
      avoidFamilies: ownFamily === "unknown" ? [] : [ownFamily],
      messages: [
        { role: "system", content: SKEPTIC_SYSTEM },
        { role: "user", content: JSON.stringify({ question, answer: shown }) },
      ],
    });
  } catch (e) {
    return unavailable(answeredBy, `The reviewing model could not answer (${e instanceof Error ? e.message.slice(0, 120) : "error"}).`);
  }
  const model = { model: reply.model, ...(reply.name ? { name: reply.name } : {}), family: modelFamily(reply.model) };
  // The rule is about the family that really answered, after any fallback inside the app.
  if (ownFamily !== "unknown" && model.family === ownFamily) {
    return unavailable(answeredBy, "The reviewing model was of the same family as the one that wrote the answer, so its opinion is not independent and is not shown.", [{ kind: "reply", reason: "same model family" }], model);
  }

  const parsed = extractJson(reply.text) as { verdict?: unknown; objections?: unknown } | null;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || (parsed.verdict !== "agree" && parsed.verdict !== "object")) {
    return unavailable(answeredBy, "The reviewing model did not return a usable answer.", [{ kind: "reply", reason: "not the requested JSON" }], model);
  }

  // Numbers the reviewer may restate: those of the answer it reviewed.
  const facts = checkedAnswer.flatMap((b) => [...numberFacts(b.text), ...b.provenance.flatMap(numberFacts), ...b.citations.flatMap((c) => numberFacts(c.quote))]);
  const quoteTokens = new Set(checkedAnswer.flatMap((b) => b.citations.flatMap((c) => numbersIn(c.quote))));

  const dropped: SkepticResult["dropped"] = [];
  const objections: Objection[] = [];
  const raw = Array.isArray(parsed.objections) ? parsed.objections : [];
  raw.forEach((o: unknown, k) => {
    const x = o as { blockIndex?: unknown; reason?: unknown; citation?: unknown } | null;
    if (!x || typeof x !== "object") return void dropped.push({ kind: "objection", reason: `objection ${k}: malformed` });
    if (typeof x.blockIndex !== "number" || !Number.isInteger(x.blockIndex) || x.blockIndex < 0 || x.blockIndex >= checkedAnswer.length) {
      return void dropped.push({ kind: "objection", reason: `objection ${k}: it does not point to a block of the answer` });
    }
    if (typeof x.reason !== "string" || x.reason.trim() === "") return void dropped.push({ kind: "objection", reason: `objection ${k}: no reason` });
    const scrubbed = scrubNumbers(plain(x.reason).slice(0, MAX_REASON), facts, quoteTokens);
    const obj: Objection = { blockIndex: x.blockIndex, reason: scrubbed.text };
    if (x.citation !== undefined && x.citation !== null) {
      const problem = citationProblem(x.citation, ctx.corpus);
      if (problem) dropped.push({ kind: "citation", reason: `objection ${k}: ${problem}` });
      else {
        const c = x.citation as { doc_id: string; page: number; quote: string };
        const page = ctx.corpus.get(c.doc_id, c.page);
        const url = page?.url ?? page?.file_url;
        obj.citation = { doc_id: c.doc_id, page: c.page, quote: c.quote, ...(page?.title ? { title: page.title } : {}), ...(url ? { url } : {}), ...(page?.doi ? { doi: page.doi } : {}), ...(page?.ntrs_id ? { ntrs_id: page.ntrs_id } : {}) };
      }
    }
    objections.push(obj);
  });

  if (objections.length > 0) return { verdict: "object", objections, model, answeredBy, dropped };
  if (parsed.verdict === "agree") return { verdict: "agree", objections: [], model, answeredBy, dropped };
  // It said "object" but nothing it said can be shown: that is not agreement.
  return { verdict: "unavailable", objections: [], model, answeredBy, dropped, note: "The reviewing model objected, but none of its objections could be checked against the answer, so none is shown." };
}
