// The server-side entry point: providers from the environment, one shared budget, one call that applies all of it.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createBudget, RateLimited, type Budget, type BudgetState } from "./budget.ts";
import { clientModels, loadProviders, type Provider } from "./config.ts";
import { complete, NoModelAvailable, type CompleteArgs, type Completion } from "./router.ts";

export { RateLimited, NoModelAvailable };
export { allModels, publicConfig, loadProviders } from "./config.ts";
export { checkContent } from "./safety.ts";
export type { Completion, CompleteArgs };

const g = globalThis as unknown as { __pyrionBudget?: Budget; __pyrionWarned?: boolean; __pyrionProxyWarned?: boolean };

/** A number from the environment: unset or empty gives the default, and "0" really means 0. */
export function numEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// The daily counter survives a restart: a small file under web/.data/ (git-ignored).
const STATE_FILE = path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "budget.json");
const fileStore = {
  load(): BudgetState | null {
    try {
      const j = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Partial<BudgetState>;
      return typeof j.day === "number" && typeof j.used === "number" ? { day: j.day, used: j.used, safety: typeof j.safety === "number" ? j.safety : 0 } : null;
    } catch {
      return null;
    }
  },
  save(s: BudgetState) {
    try {
      mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      writeFileSync(STATE_FILE, JSON.stringify(s));
    } catch {
      /* a read-only disk must not stop the product */
    }
  },
};

export function budget(): Budget {
  g.__pyrionBudget ??= createBudget({
    perVisitorPerHour: numEnv("PYRION_VISITOR_LIMIT_PER_HOUR", 20),
    perVisitorPrimaryPerHour: numEnv("PYRION_VISITOR_PRIMARY_PER_HOUR", 10),
    dailyCap: numEnv("PYRION_DAILY_REQUEST_CAP", 300),
    store: fileStore,
  });
  return g.__pyrionBudget;
}

/**
 * Anonymous visitor id. Only a proxy we run (nginx sets x-real-ip) is trusted, and only when PYRION_TRUST_PROXY=1.
 * Without it every caller shares one bucket: a client-chosen header never creates a fresh allowance.
 */
export function visitorId(req: Request): string {
  if (process.env.PYRION_TRUST_PROXY === "1") {
    const ip = req.headers.get("x-real-ip")?.trim();
    if (ip) return createHash("sha256").update(ip).digest("hex").slice(0, 16);
  }
  return "shared";
}

/** True when visitors are told apart (a proxy we run sets x-real-ip). False: everyone shares one bucket. */
export const visitorIsolation = () => process.env.PYRION_TRUST_PROXY === "1";

if (process.env.NODE_ENV === "production" && !visitorIsolation() && !g.__pyrionProxyWarned) {
  g.__pyrionProxyWarned = true;
  console.error("[pyrion] PYRION_TRUST_PROXY is not 1 in production: all visitors share one rate-limit bucket. Run behind nginx that overwrites X-Real-IP and set PYRION_TRUST_PROXY=1 (docs/DEPLOY.md).");
}

export function providers(): Provider[] {
  const ps = loadProviders();
  if (!g.__pyrionWarned) {
    g.__pyrionWarned = true;
    if (!ps.some((p) => p.id === "nim")) console.warn("[pyrion] NVIDIA NIM is not configured: no fallback provider and no content-safety check on user input.");
    if (ps.length === 0) console.warn("[pyrion] no language-model provider is configured: structured mode only.");
  }
  return ps;
}

/** Models a visitor may choose: PYRION_CLIENT_MODELS (default: the two cheap ones) among the configured ones. */
export function selectableModels(): string[] {
  return clientModels(providers());
}

/** complete() with the budget applied: the daily cap and the visitor's quota send the primary provider's traffic to the fallback. */
export async function askLlm(args: CompleteArgs, visitor?: string): Promise<Completion> {
  const b = budget();
  const ps = providers();
  if (ps.length === 0) throw new NoModelAvailable("no language-model provider is configured");
  return complete(args, {
    providers: ps,
    allow: (id) => id !== "openrouter" || b.primaryAllowed(visitor),
    onRequest: (id) => {
      if (id === "openrouter") b.recordPrimary(visitor);
    },
  });
}
