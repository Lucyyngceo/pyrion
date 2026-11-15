// Server only. TARS never goes mute: when no model answers (timeout, no credit, rate limit, nothing configured) it still answers by code.
//  (a) a condition question: the engine's verdict counts, known / unknown / next with receipts, and what would close the gap;
//  (b) a site or how-to question: the best help topics (TARS Support, BM25);
//  (c) a physics or NASA question: the top passages of the NASA library as verified quotations, labelled as retrieved.
// Every sentence here comes from the engine, the help topics or a NASA page; no model words, nothing invented.

import { evaluate, experimentsNeeded, threePartAnswer, type ConditionRecord, type Target } from "../../../engine/src/index.ts";
import { verdictLabel } from "../../../engine/src/labels.ts";
import { ENGINE_NAME, ENGINE_VERSION } from "../../../engine/src/index.ts";
import { plainify, isExplanatory } from "../expert/agent.ts";
import { citationProblem, ENGINE_LABEL, type KeptBlock, type VerifiedCitation } from "../expert/claims.ts";
import { conditionFromMessage, isCompleteTarget } from "../expert/condition.ts";
import type { Library, Passage } from "../expert/library.ts";
import { detectLang } from "./lang.ts";
import { MIN_SCORE, searchTopics, type Topic } from "./help.ts";

export const FALLBACK_NOTICE = "The explanation layer is temporarily unavailable; everything shown comes from code and NASA documents.";
export const NASA_RETRIEVED_LABEL = "NASA said (retrieved; no model available to explain)";

export interface CodeAnswer {
  blocks: KeptBlock[];
  target: Target | null;
  engineCounts?: Record<string, number>;
  fingerprint?: string;
  helpTopics: { id: string; title: string; body: string; link: string }[];
  notice: string;
  lang: string;
}

const words = (s: string) => new Set((s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []));

/** The sentence of a passage that shares the most words with the question, long enough to be a quotation. */
function bestSentence(text: string, query: string): string | null {
  const q = words(query);
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length >= 40 && s.length <= 240);
  let best: { s: string; n: number } | null = null;
  for (const s of sentences) {
    const n = [...words(s)].filter((w) => q.has(w)).length;
    if (!best || n > best.n) best = { s, n };
  }
  return best ? best.s : null;
}

export async function codeAnswer(env: { message: string; lastTarget: Target | null; records: readonly ConditionRecord[]; investigations: { accession: string; acronym: string; title: string; doi: string }[]; topics: readonly Topic[]; library: Library | null }): Promise<CodeAnswer> {
  const lang = detectLang(env.message);
  const es = lang === "es";
  const blocks: KeptBlock[] = [];
  const cond = conditionFromMessage(env.message, { lastTarget: env.lastTarget });
  const target = cond.target;
  let engineCounts: Record<string, number> | undefined;
  let fingerprint: string | undefined;
  const engineBlock = (text: string, provenance: string[]): KeptBlock => ({ layer: "engine", text: plainify(text), label: ENGINE_LABEL, citations: [], provenance, flagged: false });

  // (a) a condition: the engine
  if (target && isCompleteTarget(target) && env.records.length > 0) {
    const catalog = Object.fromEntries(env.investigations.map((i) => [i.accession, { acronym: i.acronym, title: i.title, doi: i.doi }]));
    const ev = evaluate(env.records, target);
    engineCounts = { ...ev.counts.investigations } as Record<string, number>;
    const parts = Object.entries(ev.counts.investigations).filter(([, v]) => v > 0).map(([k, v]) => `${verdictLabel(k as never)}: ${v}`);
    const total = Object.values(ev.counts.investigations).reduce((a, b) => a + b, 0);
    const how = `computed by code (${ENGINE_NAME} ${ENGINE_VERSION})`;
    const a = threePartAnswer(env.records, target, { mode: "advanced", catalog });
    fingerprint = a.fingerprint;
    blocks.push(engineBlock(`${es ? `El motor evalúa ${total} investigaciones en esta condición` : `The engine evaluates ${total} investigations at this condition`} (verdict counts): ${parts.join("; ")}.`, [`${how}: evaluate() over the extracted records`, `fingerprint ${a.fingerprint}`]));
    const receipts = (c: { accession: string; doi?: string }[]) => c.map((x) => `${x.accession}${x.doi ? ` doi:${x.doi}` : ""}`);
    if (a.known.length) blocks.push(engineBlock(`**${es ? "Lo que se sabe" : "Known"}**\n${a.known.map((k) => `- ${k.sentence}`).join("\n")}`, [how, ...a.known.flatMap((k) => receipts(k.citations)).slice(0, 12).map((r) => `receipt ${r}`)]));
    if (a.unknown.length) blocks.push(engineBlock(`**${es ? "Lo que no se sabe" : "Not known"}**\n${a.unknown.map((u) => `- ${u.sentence}`).join("\n")}`, [how]));
    if (a.next.length) blocks.push(engineBlock(`**${es ? "Lo siguiente" : "Next"}**\n${a.next.map((n) => `- ${n.sentence}`).join("\n")}`, [how]));
    try {
      const g = experimentsNeeded(env.records, target, { catalog });
      blocks.push(engineBlock(`**${es ? "Qué cerraría esta brecha" : "What would close this gap"}** (PYRION proposal, a testable plan, not a NASA plan)\n- ${g.gap.sentence}\n- ${g.testMatrix.sentence}`, [how]));
    } catch {
      /* the plan is optional */
    }
  }

  // (b) the site: help topics
  const hits = searchTopics(env.topics, env.message, 3).filter((h) => h.score >= MIN_SCORE);
  const helpTopics = blocks.length > 0 ? [] : hits.slice(0, 2).map((h) => ({ id: h.topic.id, title: h.topic.title, body: h.topic.body.slice(0, 900), link: h.topic.link }));

  // (c) physics or NASA: retrieved passages as verified quotations
  if (blocks.length === 0 && env.library && (helpTopics.length === 0 || isExplanatory(env.message))) {
    const lib = env.library;
    let passages: Passage[] = [];
    try {
      passages = await lib.search(env.message, 6);
    } catch {
      passages = [];
    }
    const seen = new Set<string>();
    for (const p of passages) {
      if (blocks.length >= 3) break;
      const q = bestSentence(p.text, env.message);
      if (!q) continue;
      for (const page of new Set([p.page_start, p.page_end])) {
        const cite = { doc_id: p.doc_id, page, quote: q };
        if (seen.has(`${p.doc_id}#${page}`) || citationProblem(cite, lib.corpus)) continue;
        seen.add(`${p.doc_id}#${page}`);
        const pg = lib.corpus.get(p.doc_id, page);
        const url = pg?.url ?? pg?.file_url ?? p.url;
        const verified: VerifiedCitation = { ...cite, ...(p.title ? { title: p.title } : {}), ...(url ? { url } : {}), ...(pg?.doi ? { doi: pg.doi } : {}), ...(pg?.ntrs_id ? { ntrs_id: pg.ntrs_id } : {}) };
        blocks.push({ layer: "nasa", text: `${p.title || p.doc_id}, p. ${page}: the passage most related to the question, shown as a quotation.`, label: NASA_RETRIEVED_LABEL, citations: [verified], provenance: ["retrieved by code (BM25 over the NASA library); the quotation was found word for word on the cited page"], flagged: false });
        break;
      }
    }
  }
  return { blocks, target: target ?? null, ...(engineCounts ? { engineCounts } : {}), ...(fingerprint ? { fingerprint } : {}), helpTopics, notice: FALLBACK_NOTICE, lang };
}
