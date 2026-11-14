// Test helpers. Fixtures are SYNTHETIC (see test/fixtures/synthetic/README.md), never NASA data.
import { join } from 'node:path';
import { loadConditionDir } from '../src/load.ts';
import type { ClusterVerdict, ConditionRecord, Evaluation } from '../src/types.ts';

export const FIXTURES = join(import.meta.dirname, 'fixtures', 'synthetic');

export function fixtureRecords(): ConditionRecord[] {
  const res = loadConditionDir(FIXTURES);
  if (!res.found || res.rejected.length > 0) throw new Error(`fixtures did not load cleanly: ${JSON.stringify(res.rejected)}`);
  return res.records;
}

export function clustersOf(ev: Evaluation, accession: string): ClusterVerdict[] {
  return [...ev.ranked, ...ev.unranked].filter((c) => c.accession === accession);
}

export function onlyCluster(ev: Evaluation, accession: string): ClusterVerdict {
  const cs = clustersOf(ev, accession);
  if (cs.length !== 1) throw new Error(`${accession}: expected 1 cluster, got ${cs.length}`);
  return cs[0];
}

/** Deterministic shuffle (fixed seed), to show results do not depend on record order. */
export function shuffled<T>(xs: readonly T[], seed = 12345): T[] {
  const a = [...xs];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const MICRO_SOLID_N2 = { gravity_regime: 'microgravity', fuel_phase: 'solid', diluent: 'N2' } as const;
