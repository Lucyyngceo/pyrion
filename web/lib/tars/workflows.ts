// Server only. Typed workflow requests in the chat ("Check this: …", "Make an evidence brief of this conversation",
// "Compare … with …", "second opinion") produce the same results as the panel buttons: result.claimCheck, result.brief,
// result.comparison, result.skeptic. Which workflow runs is decided by code (the page's `ui.workflow`, else the wording).

import { PRESETS, type ConditionRecord, type Target } from "../../../engine/src/index.ts";
import { checkClaim } from "@/lib/expert/claim";
import { buildBrief, type BriefTurn } from "@/lib/expert/brief";
import { compareConditionSet, type ConditionInput } from "@/lib/expert/compare";
import { conditionFromMessage } from "@/lib/expert/condition";
import { reviewSecondOpinion } from "@/lib/expert/skeptic";
import type { KeptBlock } from "@/lib/expert/claims";
import type { AskModel } from "@/lib/expert/model";
import type { Library } from "@/lib/expert/library";

export type Workflow = "second_opinion" | "check_claims" | "brief" | "compare";
const KNOWN: readonly Workflow[] = ["second_opinion", "check_claims", "brief", "compare"];

export function workflowOf(message: string, ui: { workflow?: unknown }): Workflow | null {
  const w = KNOWN.find((k) => k === ui.workflow);
  if (w) return w;
  if (/^\s*(check this|check these claims?|check the claims?|verifica esto|revisa esto|comprueba esto)\s*:/i.test(message)) return "check_claims";
  if (/\b(evidence brief|brief of this conversation|informe de evidencia|resumen de evidencia)\b/i.test(message)) return "brief";
  if (/^\s*compar(?:e|a)\b.+\b(?:with|to|vs\.?|versus|and|con|y)\b/i.test(message)) return "compare";
  if (/\bsecond opinion\b|segunda opini[oó]n/i.test(message)) return "second_opinion";
  return null;
}

/** The text to check: what follows "Check this:". */
export const claimText = (message: string) => message.replace(/^\s*[^:]{0,30}:\s*/, "").trim();

const ISS: ConditionInput = { name: "ISS cabin air", o2: 21, pressure: "14.7 psia", gravity_regime: "microgravity" };

function side(text: string): ConditionInput | null {
  const t = text.trim();
  if (/\biss\b/i.test(t)) return ISS;
  if (/8\.2\s*psi/i.test(t) && /34/.test(t)) return "nesc-8.2psia-34o2-lunar";
  if (/10\.2\s*psi/i.test(t) && /26\.5/.test(t)) return "nesc-10.2psia-26.5o2-lunar";
  if (/(challenge|moon base|lunar base)/i.test(t) && !/\d/.test(t)) return "challenge-lunar-base";
  const c = conditionFromMessage(t);
  return c.target ? { name: t.slice(0, 60), target: c.target } : null;
}

export function compareInputs(message: string, ui: { conditions?: unknown }): ConditionInput[] | null {
  const ids = new Set(PRESETS.map((p) => p.id));
  if (Array.isArray(ui.conditions)) {
    const list = ui.conditions.filter((c): c is string => typeof c === "string" && ids.has(c));
    if (list.length >= 2) return list.slice(0, 8);
  }
  const body = message.replace(/^\s*compar(?:e|a)\s+/i, "");
  const parts = body.split(/\s+(?:with|to|vs\.?|versus|con)\s+|\s+and\s+(?=the\s|an?\s|\d|iss\b)/i).map(side);
  const ok = parts.filter((p): p is ConditionInput => p !== null);
  return ok.length >= 2 ? ok.slice(0, 8) : null;
}

export interface WorkflowCtx {
  message: string;
  history: { role: string; text: string }[];
  ui: { conditions?: unknown };
  kept: readonly KeptBlock[];
  target: Target | null;
  model: { model: string; name?: string } | null;
  records: readonly ConditionRecord[];
  investigations: { accession: string; acronym: string; title: string; doi: string }[];
  library: Library | null;
  askModel: AskModel;
  available: string[];
  /** Turns the browser kept (answered questions with their checked blocks), for the brief. */
  turns?: BriefTurn[];
}

/** Runs one workflow; the result's field name is the key. A workflow that cannot run says why instead of failing. */
export async function runWorkflow(w: Workflow, c: WorkflowCtx): Promise<Record<string, unknown>> {
  const catalog = Object.fromEntries(c.investigations.map((i) => [i.accession, { acronym: i.acronym, title: i.title, doi: i.doi }]));
  const corpus = c.library?.corpus ?? { get: () => undefined, hasDocument: () => false };
  try {
    if (w === "check_claims") {
      if (!c.library) return { claimCheckError: "The NASA library is not available on this server." };
      const lib = c.library;
      return { claimCheck: await checkClaim(claimText(c.message), { corpus, askModel: c.askModel, search: async (q, top) => (await lib.search(q, top)).map((p) => ({ doc_id: p.doc_id, page_start: p.page_start, text: p.text, title: p.title, url: p.url })), records: c.records, catalog }) };
    }
    if (w === "brief") {
      const prior = [...c.history].reverse().find((h) => h.role === "user")?.text;
      const turns: BriefTurn[] = c.turns && c.turns.length > 0 ? c.turns : [{ question: prior ?? c.message, kept: c.kept, target: c.target, model: c.model }];
      return { brief: buildBrief(turns, { date: new Date().toISOString().slice(0, 10), records: c.records, catalog, corpus }) };
    }
    if (w === "compare") {
      const inputs = compareInputs(c.message, c.ui);
      if (!inputs) return { comparisonError: "Name two conditions to compare, for example \"Compare the ISS with the Moon Base\"." };
      return { comparison: compareConditionSet(inputs, { records: c.records, catalog }) };
    }
    if (c.kept.length === 0 || !c.model) return { skeptic: { verdict: "unavailable", objections: [], model: null, answeredBy: null, dropped: [], note: "There was no checked answer to review." } };
    return { skeptic: await reviewSecondOpinion(c.message, c.kept, { corpus, askModel: c.askModel, answeredBy: c.model.model, available: c.available }) };
  } catch {
    return { [`${w}Error`]: "That workflow could not finish." };
  }
}
