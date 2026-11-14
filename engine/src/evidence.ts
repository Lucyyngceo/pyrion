// Turns validated condition records into tests and clusters.
//
// A test is one test_id of an investigation. Records with test_id "*" apply to every test of that
// investigation, unless the test has its own record(s) for the same variable: then only the test's
// own records are used, even if all of them are excluded (a flag on a test is never overridden by "*").
//
// A cluster is the set of tests of one investigation that share the same regime values
// (gravity_regime, fuel_phase, diluent). Each cluster gets exactly one verdict.

import { isContinuousAxis, isRegimeAxis, parseValues } from './records.ts';
import {
  AXIS_UNITS,
  CONTINUOUS_AXES,
  DESCRIPTIVE_VARIABLES,
  REGIME_AXES,
  type AxisScale,
  type Citation,
  type ConditionRecord,
  type ContinuousAxis,
  type EngineOptions,
  type RegimeAxis,
  type RegimeState,
} from './types.ts';

export interface ResolvedVariable {
  /** Records that count as evidence for this test and variable. */
  used: ConditionRecord[];
  /** Records present but excluded: status insufficient_evidence, or below the minimum status. */
  excluded: ConditionRecord[];
}

export interface TestEvidence {
  accession: string;
  test_id: string;
  regime: Record<RegimeAxis, RegimeState & { records: ConditionRecord[]; excluded: ConditionRecord[] }>;
  continuous: Record<ContinuousAxis, { values: number[]; records: ConditionRecord[]; excluded: ConditionRecord[] }>;
  descriptors: Record<string, string[]>;
}

export interface Cluster {
  accession: string;
  key: string;
  regime: RegimeState[];
  tests: TestEvidence[];
}

export interface Corpus {
  clusters: Cluster[];
  normalization: AxisScale[];
  recordsUsed: number;
  recordsFlaggedInsufficient: number;
  recordsBelowMinimumStatus: number;
}

// ---------- deterministic ordering helpers ----------

export function accessionNumber(a: string): number {
  return Number(a.slice(4));
}

export function compareAccession(a: string, b: string): number {
  return accessionNumber(a) - accessionNumber(b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** Natural order ("T2" before "T10") without locale data, so it is the same on every machine. */
export function compareNatural(a: string, b: string): number {
  const ca = a.match(/\d+|\D+/g) ?? [];
  const cb = b.match(/\d+|\D+/g) ?? [];
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < n; i += 1) {
    const x = ca[i];
    const y = cb[i];
    const dx = /^\d/.test(x);
    const dy = /^\d/.test(y);
    if (dx && dy) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d;
      if (x.length !== y.length) return x.length - y.length;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return ca.length - cb.length || (a < b ? -1 : a > b ? 1 : 0);
}

const RECORD_KEY_FIELDS = [
  'accession',
  'test_id',
  'variable',
  'value',
  'unit',
  'source_file',
  'source_location',
  'status',
  'method',
  'quote',
  'value_original',
  'unit_original',
  'note',
] as const;

/** Total order on records, so results never depend on file or row order. */
export function compareRecords(a: ConditionRecord, b: ConditionRecord): number {
  const c = compareAccession(a.accession, b.accession);
  if (c !== 0) return c;
  for (const f of RECORD_KEY_FIELDS) {
    if (f === 'accession') continue;
    const x = a[f];
    const y = b[f];
    if (x !== y) return f === 'test_id' ? compareNatural(x, y) : x < y ? -1 : 1;
  }
  return 0;
}

export function citationOf(r: ConditionRecord): Citation {
  return {
    accession: r.accession,
    test_id: r.test_id,
    variable: r.variable,
    value: r.value,
    unit: r.unit,
    value_original: r.value_original,
    unit_original: r.unit_original,
    note: r.note,
    status: r.status,
    method: r.method,
    source_file: r.source_file,
    source_location: r.source_location,
    quote: r.quote,
  };
}

/** Distinct records (by content) in canonical order, as citations. */
export function citationsOf(records: readonly ConditionRecord[]): Citation[] {
  const sorted = [...records].sort(compareRecords);
  const out: ConditionRecord[] = [];
  for (const r of sorted) if (out.length === 0 || compareRecords(out[out.length - 1], r) !== 0) out.push(r);
  return out.map(citationOf);
}

function distinctSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function distinctNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

// ---------- corpus ----------

function counts(status: ConditionRecord['status'], minimum: 'extracted' | 'verified'): boolean {
  if (status === 'insufficient_evidence') return false;
  return minimum === 'extracted' || status === 'verified';
}

function resolve(own: ConditionRecord[], all: ConditionRecord[], minimum: 'extracted' | 'verified'): ResolvedVariable {
  const level = own.length > 0 ? own : all;
  return {
    used: level.filter((r) => counts(r.status, minimum)),
    excluded: level.filter((r) => !counts(r.status, minimum)),
  };
}

export function regimeKey(regime: readonly RegimeState[]): string {
  return regime
    .map((s) => `${s.axis}=${s.state === 'known' ? s.values[0] : s.state === 'missing' ? '?' : `conflict(${s.values.join('/')})`}`)
    .join('|');
}

export function buildCorpus(input: readonly ConditionRecord[], options: Required<EngineOptions>): Corpus {
  const records = [...input].sort(compareRecords);
  const minimum = options.minimumStatus;

  // Normalization: every value that counts as evidence, any investigation, any regime.
  const normalization: AxisScale[] = CONTINUOUS_AXES.map((axis) => {
    const vals = records
      .filter((r) => r.variable === axis && counts(r.status, minimum))
      .flatMap((r) => parseValues(r.value) as number[]);
    if (vals.length === 0) return { axis, unit: AXIS_UNITS[axis], min: null, max: null, scale: 1, scaleRule: 'unit' };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (max > min) return { axis, unit: AXIS_UNITS[axis], min, max, scale: max - min, scaleRule: 'range' };
    if (min !== 0) return { axis, unit: AXIS_UNITS[axis], min, max, scale: Math.abs(min), scaleRule: 'abs_value' };
    return { axis, unit: AXIS_UNITS[axis], min, max, scale: 1, scaleRule: 'unit' };
  });

  const byAccession = new Map<string, ConditionRecord[]>();
  for (const r of records) {
    const list = byAccession.get(r.accession);
    if (list) list.push(r);
    else byAccession.set(r.accession, [r]);
  }

  const clusters: Cluster[] = [];
  for (const accession of [...byAccession.keys()].sort(compareAccession)) {
    const recs = byAccession.get(accession) as ConditionRecord[];
    const named = distinctSorted(recs.filter((r) => r.test_id !== '*').map((r) => r.test_id)).sort(compareNatural);
    const testIds = named.length > 0 ? named : ['*'];
    const star = recs.filter((r) => r.test_id === '*');

    const tests: TestEvidence[] = testIds.map((test_id) => {
      const own = test_id === '*' ? [] : recs.filter((r) => r.test_id === test_id);
      const varRecords = (v: string) =>
        resolve(
          own.filter((r) => r.variable === v),
          star.filter((r) => r.variable === v),
          minimum,
        );
      const regime = {} as TestEvidence['regime'];
      for (const axis of REGIME_AXES) {
        const res = varRecords(axis);
        const values = distinctSorted(res.used.map((r) => r.value));
        regime[axis] = {
          axis,
          state: values.length === 0 ? 'missing' : values.length === 1 ? 'known' : 'conflicting',
          values,
          records: res.used,
          excluded: res.excluded,
        };
      }
      const continuous = {} as TestEvidence['continuous'];
      for (const axis of CONTINUOUS_AXES) {
        const res = varRecords(axis);
        continuous[axis] = {
          values: distinctNumbers(res.used.flatMap((r) => parseValues(r.value) as number[])),
          records: res.used,
          excluded: res.excluded,
        };
      }
      const descriptors: Record<string, string[]> = {};
      for (const d of DESCRIPTIVE_VARIABLES) {
        const vals = distinctSorted(varRecords(d).used.map((r) => r.value));
        if (vals.length > 0) descriptors[d] = vals;
      }
      return { accession, test_id, regime, continuous, descriptors };
    });

    const groups = new Map<string, TestEvidence[]>();
    for (const t of tests) {
      const key = regimeKey(REGIME_AXES.map((a) => t.regime[a]));
      const g = groups.get(key);
      if (g) g.push(t);
      else groups.set(key, [t]);
    }
    for (const key of [...groups.keys()].sort()) {
      const g = groups.get(key) as TestEvidence[];
      clusters.push({
        accession,
        key,
        regime: REGIME_AXES.map((a) => ({ axis: a, state: g[0].regime[a].state, values: g[0].regime[a].values })),
        tests: g,
      });
    }
  }

  return {
    clusters,
    normalization,
    recordsUsed: records.filter((r) => counts(r.status, minimum)).length,
    recordsFlaggedInsufficient: records.filter((r) => r.status === 'insufficient_evidence').length,
    recordsBelowMinimumStatus: records.filter((r) => r.status === 'extracted' && minimum === 'verified').length,
  };
}

/**
 * The measured points of one test in the space of the given axes.
 * Exact only when at most one axis has more than one value (then the pairing is unambiguous).
 * Returns null when two or more axes have several values: which value goes with which is unknown.
 */
export function testPoints(t: TestEvidence, axes: readonly ContinuousAxis[]): number[][] | null {
  const sets = axes.map((a) => t.continuous[a].values);
  if (sets.some((s) => s.length === 0)) return [];
  if (sets.filter((s) => s.length > 1).length > 1) return null;
  let points: number[][] = [[]];
  for (const s of sets) points = points.flatMap((p) => s.map((v) => [...p, v]));
  return points;
}

/** Records behind one coordinate of a test point (the records whose value, or range end, equals it). */
export function recordsAt(t: TestEvidence, axis: ContinuousAxis, value: number): ConditionRecord[] {
  return t.continuous[axis].records.filter((r) => (parseValues(r.value) as number[]).includes(value));
}

export { isContinuousAxis, isRegimeAxis };
