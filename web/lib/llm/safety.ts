// Content check on user input with a safety model on the NIM provider. Never blocks the product when the check itself fails.

import type { Provider } from "./config.ts";

export const SAFETY_MODEL = "nvidia/nemotron-3.5-content-safety";

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
  try {
    const res = await f(`${nim.base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${nim.key}` },
      body: JSON.stringify({ model: SAFETY_MODEL, messages: [{ role: "user", content: text }], temperature: 0, max_tokens: 40 }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("no verdict in the reply");
    return { flagged: readVerdict(content), checked: true };
  } catch (e) {
    log(`[pyrion] content-safety check unavailable, continuing: ${e instanceof Error ? e.message : "error"}`);
    return { flagged: false, checked: false };
  }
}
