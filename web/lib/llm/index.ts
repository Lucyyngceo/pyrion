// The server-side entry point: providers from the environment, one shared budget, one call that applies all of it.

import { createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createBudget, RateLimited, type Budget, type BudgetState, type BudgetStore } from "./budget.ts";
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

// The daily counter survives a restart: a small file under web/.data/ (git-ignored). Written to a temp file and
// renamed, so a crash cannot leave half a file. A file that exists but does not parse closes the paid provider for the
// rest of the day (a damaged counter must never read as "nothing used").
export function createFileStore(file: string, log: (m: string) => void = console.error): BudgetStore {
  return {
    load(): BudgetState | null {
      let raw: string;
      try {
        raw = readFileSync(file, "utf8");
      } catch {
        return null; // no file yet: a fresh counter
      }
      try {
        const j = JSON.parse(raw) as Partial<BudgetState>;
        if (typeof j.day === "number" && typeof j.used === "number") return { day: j.day, used: j.used, safety: typeof j.safety === "number" ? j.safety : 0 };
        throw new Error("unexpected shape");
      } catch {
        log("[pyrion] the budget counter file is damaged: the primary provider is closed until the next UTC day.");
        return { day: Math.floor(Date.now() / 86_400_000), used: Number.MAX_SAFE_INTEGER, safety: 0 };
      }
    },
    save(s: BudgetState) {
      try {
        mkdirSync(path.dirname(file), { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        writeFileSync(tmp, JSON.stringify(s));
        renameSync(tmp, file);
      } catch {
        /* a read-only disk must not stop the product */
      }
    },
  };
}

const fileStore = createFileStore(path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "budget.json"));

export function budget(): Budget {
  g.__pyrionBudget ??= createBudget({
    perVisitorPerHour: numEnv("PYRION_VISITOR_LIMIT_PER_HOUR", 20),
    perVisitorPrimaryPerHour: numEnv("PYRION_VISITOR_PRIMARY_PER_HOUR", 10),
    dailyCap: numEnv("PYRION_DAILY_REQUEST_CAP", 300),
    store: fileStore,
  });
  return g.__pyrionBudget;
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Anonymous visitor id. X-Real-IP is believed only when PYRION_TRUST_PROXY=1 AND the request carries the proxy's secret
 * (header X-Pyrion-Proxy equal to PYRION_PROXY_SECRET, which only our nginx adds). Otherwise every caller shares one
 * bucket: a forged header never creates a fresh allowance, even if Node is reachable directly.
 */
export function visitorId(req: Request): string {
  const secret = process.env.PYRION_PROXY_SECRET ?? "";
  if (process.env.PYRION_TRUST_PROXY === "1" && secret !== "" && safeEqual(req.headers.get("x-pyrion-proxy") ?? "", secret)) {
    const ip = req.headers.get("x-real-ip")?.trim();
    if (ip) return createHash("sha256").update(ip).digest("hex").slice(0, 16);
  }
  return "shared";
}

/** True only when visitors can be told apart: the proxy is trusted and its secret is configured. */
export const visitorIsolation = () => process.env.PYRION_TRUST_PROXY === "1" && (process.env.PYRION_PROXY_SECRET ?? "") !== "";

if (process.env.NODE_ENV === "production" && !visitorIsolation() && !g.__pyrionProxyWarned) {
  g.__pyrionProxyWarned = true;
  console.error("[pyrion] visitor isolation is off in production (PYRION_TRUST_PROXY=1 and PYRION_PROXY_SECRET are both needed): all visitors share one rate-limit bucket. See docs/DEPLOY.md.");
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
