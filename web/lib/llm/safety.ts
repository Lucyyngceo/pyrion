// Content check on user input with a safety model on the NIM provider (first model that answers). Never blocks the product when the check itself fails.

import type { Provider } from "./config.ts";

/** Tried in order. nvidia/nemotron-3.5-content-safety is listed by the catalog but answers 404 for this account. */
export const SAFETY_MODELS = ["nvidia/llama-3.1-nemotron-safety-guard-8b-v3", "meta/llama-guard-4-12b"];

export type SafetyDetail =
  | "first_safe" // the first guard cleared it
  | "second_cleared" // the first flagged, the second cleared it: the flag was treated as a false positive
  | "both_flagged" // both flagged
  | "second_unavailable_after_flag" // the first flagged and the second could not answer, even after a retry: not answered, not accused (503)
  | "first_unavailable_second_safe"
  | "first_unavailable_second_flagged"
  | "both_unavailable"; // nothing could check: the question goes through, visibly unchecked

export interface SafetyResult {
  /** The input is refused. */
  flagged: boolean;
  /** At least one guard actually answered. */
  checked: boolean;
  /** Which branch of the policy applied. */
  detail: SafetyDetail;
  /** The first guard flagged and the second could not answer even after a retry: the question is neither cleared nor confirmed harmful. */
  unresolved?: boolean;
}

/** Reads a guard's verdict defensively: any "unsafe" in the reply (plain text or JSON) flags the input. */
export function readVerdict(content: string): boolean {
  return /\bunsafe\b/i.test(content);
}

/** Time the first guard (and a first-unavailable fallback) may take. */
export const SAFETY_TOTAL_MS = 8000;
/** Budget of the second opinion after a flag: its own, so a slow first guard cannot starve it (still bounded by the caller's deadline). */
export const SAFETY_SECOND_MS = 10000;

/**
 * Policy (measured: the first guard has false positives on benign non-English questions, the second had none and caught
 * every harmful one): ask the first; if it says safe the input passes. If it flags, ask the second: refuse only if the second
 * also flags or cannot answer. If the first cannot answer, the second decides alone. If neither can answer, the input goes
 * through and the response says it was not checked.
 */
export async function checkContent(
  text: string,
  providers: Provider[],
  f: typeof fetch = fetch,
  log: (m: string) => void = console.warn,
  /** The caller's signal (the request's, combined with its deadline): a client that leaves or a deadline that passes stops the check. */
  signal?: AbortSignal,
): Promise<SafetyResult> {
  const nim = providers.find((p) => p.id === "nim");
  if (!nim) return { flagged: false, checked: false, detail: "both_unavailable" };
  const models = process.env.PYRION_SAFETY_MODEL ? [process.env.PYRION_SAFETY_MODEL, ...SAFETY_MODELS] : SAFETY_MODELS;
  const total = AbortSignal.any([AbortSignal.timeout(SAFETY_TOTAL_MS), ...(signal ? [signal] : [])]);
  const own = (ms: number) => AbortSignal.any([AbortSignal.timeout(ms), ...(signal ? [signal] : [])]);

  /** One guard's opinion: true = flags, false = safe, null = could not answer. */
  const ask = async (model: string, within: AbortSignal = total, callMs = 6000): Promise<boolean | null> => {
    if (within.aborted) return null;
    try {
      const res = await f(`${nim.base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${nim.key}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: text }], temperature: 0, max_tokens: 60 }),
        signal: AbortSignal.any([within, AbortSignal.timeout(callMs)]),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("no verdict in the reply");
      return readVerdict(content);
    } catch (e) {
      log(`[pyrion] content-safety model ${model} unavailable: ${e instanceof Error ? e.message : "error"}`);
      return null;
    }
  };

  const first = await ask(models[0]);
  if (first === false) return { flagged: false, checked: true, detail: "first_safe" };
  // The second opinion has its own budget and one retry: a timeout under load must not decide the outcome.
  const secondBudget = own(SAFETY_SECOND_MS);
  let second = await ask(models[1] ?? models[0], secondBudget, 6000);
  if (second === null) second = await ask(models[1] ?? models[0], secondBudget, 6000);
  if (first === true) {
    if (second === false) return { flagged: false, checked: true, detail: "second_cleared" };
    if (second === true) return { flagged: true, checked: true, detail: "both_flagged" };
    return { flagged: false, checked: true, unresolved: true, detail: "second_unavailable_after_flag" };
  }
  // the first could not answer
  if (second === false) return { flagged: false, checked: true, detail: "first_unavailable_second_safe" };
  if (second === true) return { flagged: true, checked: true, detail: "first_unavailable_second_flagged" };
  return { flagged: false, checked: false, detail: "both_unavailable" };
}
