// Cleaning of model text before it is parsed or judged. Pure.

/** Remove <think>…</think> blocks (also an unclosed one at the start) and surrounding code fences. */
export function cleanModelText(text: string): string {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (/^\s*<think>/i.test(t)) t = ""; // reasoning that never closed: nothing usable follows
  t = t.trim();
  t = t.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "");
  return t.trim();
}
