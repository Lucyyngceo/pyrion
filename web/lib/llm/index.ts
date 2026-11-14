// The server-side entry point: providers from the environment, one shared budget, one call that applies all of it.

import { createHash } from "node:crypto";
import { createBudget, RateLimited, type Budget } from "./budget.ts";
import { loadProviders, type Provider } from "./config.ts";
import { complete, NoModelAvailable, type CompleteArgs, type Completion } from "./router.ts";

export { RateLimited, NoModelAvailable };
export { allModels, publicConfig, loadProviders } from "./config.ts";
export { checkContent } from "./safety.ts";
export type { Completion, CompleteArgs };

const g = globalThis as unknown as { __pyrionBudget?: Budget };

export function budget(): Budget {
  g.__pyrionBudget ??= createBudget({
    perVisitorPerHour: Number(process.env.PYRION_VISITOR_LIMIT_PER_HOUR) || 20,
    dailyCap: Number(process.env.PYRION_DAILY_REQUEST_CAP) || 300,
  });
  return g.__pyrionBudget;
}

/** Anonymous visitor id: a hash of IP and user agent. Nothing identifying is stored. */
export function visitorId(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${ip}|${req.headers.get("user-agent") ?? ""}`).digest("hex").slice(0, 16);
}

export function providers(): Provider[] {
  return loadProviders();
}

/** complete() with the budget applied: the daily cap routes the primary provider's traffic to the fallback. */
export async function askLlm(args: CompleteArgs, visitor?: string): Promise<Completion> {
  const b = budget();
  if (visitor) b.visitor(visitor);
  const ps = providers();
  if (ps.length === 0) throw new NoModelAvailable("no language-model provider is configured");
  return complete(args, {
    providers: ps,
    allow: (id) => id !== "openrouter" || b.primaryAllowed(),
    onRequest: (id) => {
      if (id === "openrouter") b.recordPrimary();
    },
  });
}
