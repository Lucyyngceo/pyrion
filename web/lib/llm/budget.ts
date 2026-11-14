// Budget protection: a per-visitor hourly limit, a per-visitor quota on the primary provider, and a daily cap on the
// primary provider that survives a restart (a small state file, injected). Pure given a clock and a store.

export interface BudgetState {
  day: number;
  used: number;
  safety: number;
}

export interface BudgetStore {
  load(): BudgetState | null;
  save(state: BudgetState): void;
}

export interface BudgetOptions {
  /** Questions per visitor per hour. */
  perVisitorPerHour: number;
  /** Requests per visitor per hour on the primary provider; past it that visitor is served by the fallback. */
  perVisitorPrimaryPerHour: number;
  /** Requests per UTC day on the primary provider. 0 means 0. */
  dailyCap: number;
  /** Hard cap on remembered visitors (least recently used are dropped). */
  maxVisitors?: number;
  now?: () => number;
  store?: BudgetStore;
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
  const maxVisitors = opts.maxVisitors ?? 2000;
  // Map keeps insertion order: re-inserting on use makes the first key the least recently used.
  const asks = new Map<string, number[]>();
  const primary = new Map<string, number[]>();
  const loaded = opts.store?.load() ?? null;
  const state: BudgetState = loaded && loaded.day === dayOf(now()) ? { ...loaded } : { day: dayOf(now()), used: 0, safety: 0 };

  const roll = () => {
    const d = dayOf(now());
    if (d !== state.day) {
      state.day = d;
      state.used = 0;
      state.safety = 0;
      opts.store?.save(state);
    }
  };
  const touch = (m: Map<string, number[]>, id: string, t: number): number[] => {
    const recent = (m.get(id) ?? []).filter((x) => t - x < HOUR);
    m.delete(id);
    m.set(id, recent);
    while (m.size > maxVisitors) m.delete(m.keys().next().value as string);
    return recent;
  };

  return {
    /** Count one question for this visitor; throws RateLimited past the hourly limit. */
    visitor(id: string): void {
      const t = now();
      const recent = touch(asks, id, t);
      if (recent.length >= opts.perVisitorPerHour) throw new RateLimited((recent[0] + HOUR - t) / 1000);
      recent.push(t);
    },
    /** May this visitor use the primary provider now (daily cap and personal quota)? */
    primaryAllowed(visitor?: string): boolean {
      roll();
      if (state.used >= opts.dailyCap) return false;
      if (visitor !== undefined && touch(primary, visitor, now()).length >= opts.perVisitorPrimaryPerHour) return false;
      return true;
    },
    recordPrimary(visitor?: string): void {
      roll();
      state.used++;
      if (visitor !== undefined) touch(primary, visitor, now()).push(now());
      opts.store?.save(state);
    },
    recordSafety(): void {
      roll();
      state.safety++;
      opts.store?.save(state);
    },
    remaining(): { daily_cap: number; used_today: number; remaining_today: number; safety_calls_today: number } {
      roll();
      return { daily_cap: opts.dailyCap, used_today: state.used, remaining_today: Math.max(0, opts.dailyCap - state.used), safety_calls_today: state.safety };
    },
    /** Visitors currently remembered (for tests and health). */
    size: () => asks.size,
  };
}

export type Budget = ReturnType<typeof createBudget>;
