// Content check on user input with a safety model on the NIM provider (first model that answers). Never blocks the product when the check itself fails.

import type { Provider } from "./config.ts";

/** Tried in order. nvidia/nemotron-3.5-content-safety is listed by the catalog but answers 404 for this account. */
export const SAFETY_MODELS = ["nvidia/llama-3.1-nemotron-safety-guard-8b-v3", "meta/llama-guard-4-12b"];

export interface SafetyResult {
  /** The model flagged the input. */
  flagged: boolean;
  /** The check actually ran. false = safety model unavailable: the caller continues. */
  checked: boolean;
}

/** Reads the model's verdict defensively: any "unsafe" in the reply (plain text or JSON) flags the input. */
export function readVerdict(content: string): boolean {
  return /\bunsafe\b/i.test(content);
}

export async function checkContent(text: string, providers: Provider[], f: typeof fetch = fetch, log: (m: string) => void = console.warn): Promise<SafetyResult> {
  const nim = providers.find((p) => p.id === "nim");
  if (!nim) return { flagged: false, checked: false };
  const models = process.env.PYRION_SAFETY_MODEL ? [process.env.PYRION_SAFETY_MODEL, ...SAFETY_MODELS] : SAFETY_MODELS;
  for (const model of models) {
    try {
      const res = await f(`${nim.base}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${nim.key}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: text }], temperature: 0, max_tokens: 60 }),
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("no verdict in the reply");
      return { flagged: readVerdict(content), checked: true };
    } catch (e) {
      log(`[pyrion] content-safety model ${model} unavailable: ${e instanceof Error ? e.message : "error"}`);
    }
  }
  return { flagged: false, checked: false };
}
