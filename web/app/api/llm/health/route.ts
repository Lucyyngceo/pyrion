// Which providers answer, which model would be used, how much of the daily cap is left. No key, no base URL in the output.

import { budget, providers } from "@/lib/llm";

export const dynamic = "force-dynamic";

const cache: { at: number; body?: unknown } = { at: 0 };

async function reachable(base: string, key: string): Promise<boolean> {
  try {
    // Listing models costs no tokens.
    const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  if (cache.body && Date.now() - cache.at < 60_000) return Response.json(cache.body, { headers: { "Cache-Control": "no-store" } });
  const ps = providers();
  const b = budget();
  const status = await Promise.all(ps.map(async (p) => ({ provider: p.id, configured: true, answering: await reachable(p.base, p.key), models: p.models })));
  const cap = b.remaining();
  const primary = status.find((s) => s.provider === "openrouter");
  const usable = status.filter((s) => s.answering && (s.provider !== "openrouter" || cap.remaining_today > 0));
  const body = {
    mode: usable.length ? "model" : "structured",
    would_use: usable.length ? { provider: usable[0].provider, model: usable[0].models[0] } : null,
    providers: status,
    daily_cap: { ...cap, applies_to: primary ? "openrouter" : null },
  };
  cache.at = Date.now();
  cache.body = body;
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
