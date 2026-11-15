// Which providers answer and which model would be used. In production only that is public; the details (daily cap,
// per-provider status, visitor isolation) are for development. No key and no base URL in any output.

import { budget, providers, visitorIsolation } from "@/lib/llm";
import { providerIsDown } from "@/lib/llm/router";

export const dynamic = "force-dynamic";

// One probe at a time, and its answer kept for a minute: a burst of requests costs one round of /models calls.
const cache: { at: number; promise?: Promise<unknown> } = { at: 0 };
const TTL_MS = 60_000;

async function reachable(base: string, key: string): Promise<boolean> {
  try {
    // Listing models costs no tokens.
    const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function probe() {
  const ps = providers();
  const b = budget();
  const status = await Promise.all(ps.map(async (p) => ({ provider: p.id, configured: true, answering: !providerIsDown(p.id) && (await reachable(p.base, p.key)), models: p.models })));
  const cap = b.remaining();
  const primary = status.find((s) => s.provider === "openrouter");
  const usable = status.filter((s) => s.answering && (s.provider !== "openrouter" || cap.remaining_today > 0));
  return {
    mode: usable.length ? "model" : "structured",
    would_use: usable.length ? { provider: usable[0].provider, model: usable[0].models[0] } : null,
    detail: { visitor_isolation: visitorIsolation(), providers: status, daily_cap: { ...cap, applies_to: primary ? "openrouter" : null } },
  };
}

export async function GET() {
  if (!cache.promise || Date.now() - cache.at > TTL_MS) {
    cache.at = Date.now();
    cache.promise = probe().catch((e) => {
      cache.promise = undefined; // do not cache a failure
      throw e;
    });
  }
  const r = (await cache.promise) as Awaited<ReturnType<typeof probe>>;
  const body = process.env.NODE_ENV === "production" ? { mode: r.mode, would_use: r.would_use } : { mode: r.mode, would_use: r.would_use, ...r.detail };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
