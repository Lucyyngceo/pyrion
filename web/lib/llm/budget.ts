// Budget protection, in memory: a per-visitor hourly limit and a daily cap on the primary provider.
// Pure given a clock, so it is unit-tested with a fake one.

export interface BudgetOptions {
  /** Questions per visitor per hour. */
  perVisitorPerHour: number;
  /** Requests per UTC day on the primary provider. */
  dailyCap: number;
  now?: () => number;
}

export class RateLimited extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`Too many questions from this visitor. Try again in about ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} minutes.`);
    this.name = "RateLimited";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const HOUR = 3_600_000;
const dayOf = (t: number) => Math.floor(t / 86_400_000);

export function createBudget(opts: BudgetOptions) {
  const now = opts.now ?? Date.now;
  const visitors = new Map<string, number[]>();
  let day = dayOf(now());
  let used = 0;

  const roll = () => {
    const d = dayOf(now());
    if (d !== day) {
      day = d;
      used = 0;
    }
  };

  return {
    /** Count one question for this visitor; throws RateLimited past the hourly limit. */
    visitor(id: string): void {
      const t = now();
      const recent = (visitors.get(id) ?? []).filter((x) => t - x < HOUR);
      if (recent.length >= opts.perVisitorPerHour) {
        visitors.set(id, recent);
        throw new RateLimited((recent[0] + HOUR - t) / 1000);
      }
      recent.push(t);
      visitors.set(id, recent);
      if (visitors.size > 5000) for (const [k, v] of visitors) if (v.every((x) => t - x >= HOUR)) visitors.delete(k);
    },
    primaryAllowed(): boolean {
      roll();
      return used < opts.dailyCap;
    },
    recordPrimary(): void {
      roll();
      used++;
    },
    remaining(): { daily_cap: number; used_today: number; remaining_today: number } {
      roll();
      return { daily_cap: opts.dailyCap, used_today: used, remaining_today: Math.max(0, opts.dailyCap - used) };
    },
  };
}

export type Budget = ReturnType<typeof createBudget>;
