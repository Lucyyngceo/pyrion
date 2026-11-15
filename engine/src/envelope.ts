// Envelope geometry for the chart: measured (O2 mole fraction, pressure) points and their convex hull,
// per regime combination. The same points and the same hull rule the verdict uses.

import { buildCorpus, citationsOf, compareAccession, compareNatural, recordsAt, regimeKey, testPoints } from './evidence.ts';
import { convexHull, distanceToHull, hullContains, hullNearBox, type Vec2 } from './geometry.ts';
import {
  ENGINE_NAME,
  ENGINE_VERSION,
  MEASUREMENT_TOLERANCE_REL,
  REGIME_AXES,
  type AxisScale,
  type Citation,
  type ConditionRecord,
  type ContinuousAxis,
  type EngineOptions,
  type PlanePoint,
  type RegimeAxis,
  type RegimeState,
  type Target,
} from './types.ts';

export interface EnvelopePoint extends PlanePoint {
  accession: string;
  test_id: string;
  citations: Citation[];
}

export interface RegimeEnvelope {
  key: string;
  regime: RegimeState[];
  /** false when some regime axis is missing or conflicting for these tests. */
  regimeComplete: boolean;
  points: EnvelopePoint[];
  /** Convex hull of all points of this regime combination, counter-clockwise. */
  hull: PlanePoint[];
  ranges: { o2_mole_fraction: [number, number] | null; pressure: [number, number] | null };
  investigations: { accession: string; tests: number; pointCount: number; hull: PlanePoint[] }[];
  /** Tests with several O2 and several pressure values and no stated pairing: not plotted. */
  unpairedTests: { accession: string; test_id: string }[];
  /** Tests in this regime combination without a usable O2 or pressure value: not plotted. */
  testsWithoutPlaneData: { accession: string; test_id: string }[];
}

export interface EnvelopeOptions extends EngineOptions {
  /**
   * Regime axes that split the envelopes (default: all four). With fewer axes, tests that differ only
   * on the others share one envelope, e.g. ['gravity_regime'] gives one envelope per gravity regime.
   * The verdict always uses all four.
   */
  groupBy?: RegimeAxis[];
}

export interface EnvelopeSet {
  engine: { name: string; version: string };
  options: Required<EngineOptions>;
  groupBy: RegimeAxis[];
  normalization: AxisScale[];
  regimes: RegimeEnvelope[];
}

const PLANE: ContinuousAxis[] = ['o2_mole_fraction', 'pressure'];

function hullOf(points: readonly PlanePoint[], so: number, sp: number): PlanePoint[] {
  return convexHull(points.map((p) => ({ x: p.o2_mole_fraction / so, y: p.pressure / sp }))).map((v) => ({
    o2_mole_fraction: v.x * so,
    pressure: v.y * sp,
  }));
}

function comparePoints(a: EnvelopePoint, b: EnvelopePoint): number {
  return (
    compareAccession(a.accession, b.accession) ||
    compareNatural(a.test_id, b.test_id) ||
    a.o2_mole_fraction - b.o2_mole_fraction ||
    a.pressure - b.pressure
  );
}

export function buildEnvelopes(records: readonly ConditionRecord[], options: EnvelopeOptions = {}): EnvelopeSet {
  const opts: Required<EngineOptions> = { minimumStatus: options.minimumStatus ?? 'extracted' };
  const groupBy = REGIME_AXES.filter((a) => (options.groupBy ?? REGIME_AXES).includes(a));
  const corpus = buildCorpus(records, opts);
  const scale = (a: ContinuousAxis) => (corpus.normalization.find((s) => s.axis === a) as AxisScale).scale;
  const so = scale('o2_mole_fraction');
  const sp = scale('pressure');

  const byKey = new Map<string, RegimeEnvelope>();
  for (const cluster of corpus.clusters) {
    const regime = cluster.regime.filter((s) => groupBy.includes(s.axis));
    const key = regimeKey(regime);
    let env = byKey.get(key);
    if (!env) {
      env = {
        key,
        regime,
        regimeComplete: regime.every((s) => s.state === 'known'),
        points: [],
        hull: [],
        ranges: { o2_mole_fraction: null, pressure: null },
        investigations: [],
        unpairedTests: [],
        testsWithoutPlaneData: [],
      };
      byKey.set(key, env);
    }
    const mine: EnvelopePoint[] = [];
    for (const t of cluster.tests) {
      const tp = testPoints(t, PLANE);
      if (tp === null) {
        env.unpairedTests.push({ accession: t.accession, test_id: t.test_id });
        continue;
      }
      if (tp.length === 0) {
        env.testsWithoutPlaneData.push({ accession: t.accession, test_id: t.test_id });
        continue;
      }
      for (const [o2, p] of tp) {
        mine.push({
          o2_mole_fraction: o2,
          pressure: p,
          accession: t.accession,
          test_id: t.test_id,
          citations: citationsOf([...recordsAt(t, 'o2_mole_fraction', o2), ...recordsAt(t, 'pressure', p)]),
        });
      }
    }
    env.points.push(...mine);
    const inv = env.investigations.find((i) => i.accession === cluster.accession);
    if (inv) {
      inv.tests += cluster.tests.length;
      inv.pointCount += mine.length;
    } else {
      env.investigations.push({ accession: cluster.accession, tests: cluster.tests.length, pointCount: mine.length, hull: [] });
    }
  }

  const regimes = [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  for (const env of regimes) {
    env.points.sort(comparePoints);
    env.hull = hullOf(env.points, so, sp);
    for (const inv of env.investigations) inv.hull = hullOf(env.points.filter((p) => p.accession === inv.accession), so, sp);
    env.unpairedTests.sort((a, b) => compareAccession(a.accession, b.accession) || compareNatural(a.test_id, b.test_id));
    env.testsWithoutPlaneData.sort((a, b) => compareAccession(a.accession, b.accession) || compareNatural(a.test_id, b.test_id));
    if (env.points.length > 0) {
      const o2 = env.points.map((p) => p.o2_mole_fraction);
      const pr = env.points.map((p) => p.pressure);
      env.ranges = { o2_mole_fraction: [Math.min(...o2), Math.max(...o2)], pressure: [Math.min(...pr), Math.max(...pr)] };
    }
    env.investigations.sort((a, b) => compareAccession(a.accession, b.accession));
  }
  return { engine: { name: ENGINE_NAME, version: ENGINE_VERSION }, options: opts, groupBy, normalization: corpus.normalization, regimes };
}

export interface TargetLocation {
  key: string;
  regimeComplete: boolean;
  /** true / false when every regime axis is known on both sides; null when it cannot be told. */
  sameRegime: boolean | null;
  pointCount: number;
  insideRanges: boolean | null;
  insideHull: boolean | null;
  /** Normalized distance from the target to this hull; 0 inside, null without points. */
  hullDistance: number | null;
  /**
   * Present (true) only when the target counts as inside the hull (or the ranges) because of the
   * measurement tolerance (MEASUREMENT_TOLERANCE_REL, the same one evaluate() uses). Draw the marker on the
   * edge with the "within 0.5 % measurement tolerance" note.
   */
  viaTolerance?: true;
  /** The same, against the hull of each investigation in this envelope. */
  investigations: { accession: string; pointCount: number; insideHull: boolean | null; hullDistance: number | null; viaTolerance?: true }[];
}

/**
 * Where a target's (O2, pressure) falls relative to each regime envelope. For drawing the marker.
 * This is geometry only: the applicability verdict comes from evaluate(), which also applies barriers.
 */
export function locateTarget(target: Target, envelopes: EnvelopeSet): TargetLocation[] {
  const o2 = target.continuous.o2_mole_fraction;
  const p = target.continuous.pressure;
  const scale = (a: ContinuousAxis) => (envelopes.normalization.find((s) => s.axis === a) as AxisScale).scale;
  const so = scale('o2_mole_fraction');
  const sp = scale('pressure');
  return envelopes.regimes.map((env) => {
    // Axes the target leaves open are not compared, as in evaluate().
    let sameRegime: boolean | null = true;
    for (const st of env.regime) {
      const t = target.regime[st.axis];
      if (t === undefined) continue;
      if (st.state !== 'missing' && !st.values.includes(t)) {
        sameRegime = false;
        break;
      }
      if (st.state !== 'known') sameRegime = null;
    }
    const has = o2 !== undefined && p !== undefined && env.points.length > 0;
    const tv: Vec2 | null = has ? { x: (o2 as number) / so, y: (p as number) / sp } : null;
    const hv = env.hull.map((q) => ({ x: q.o2_mole_fraction / so, y: q.pressure / sp }));
    const r = env.ranges;
    // The same tolerance box as evaluate(): ±MEASUREMENT_TOLERANCE_REL of the target's own value, per axis.
    const hx = o2 !== undefined ? (MEASUREMENT_TOLERANCE_REL * Math.abs(o2)) / so : 0;
    const hy = p !== undefined ? (MEASUREMENT_TOLERANCE_REL * Math.abs(p)) / sp : 0;
    const exact = tv ? hullContains(tv, hv) : null;
    const viaTol = tv !== null && hv.length > 0 && !exact && hullNearBox(hv, tv, hx, hy);
    const within = (v: number, lo: number, hi: number) => {
      const tol = MEASUREMENT_TOLERANCE_REL * Math.abs(v);
      return v >= lo - tol && v <= hi + tol;
    };
    const rangesExact =
      has && r.o2_mole_fraction && r.pressure
        ? (o2 as number) >= r.o2_mole_fraction[0] && (o2 as number) <= r.o2_mole_fraction[1] && (p as number) >= r.pressure[0] && (p as number) <= r.pressure[1]
        : null;
    const rangesTol =
      has && r.o2_mole_fraction && r.pressure
        ? within(o2 as number, r.o2_mole_fraction[0], r.o2_mole_fraction[1]) && within(p as number, r.pressure[0], r.pressure[1])
        : null;
    return {
      key: env.key,
      regimeComplete: env.regimeComplete,
      sameRegime,
      pointCount: env.points.length,
      insideRanges: rangesTol,
      insideHull: tv ? exact || viaTol : null,
      hullDistance: tv ? (viaTol ? 0 : distanceToHull(tv, hv)) : null,
      ...(viaTol || (rangesTol && !rangesExact) ? { viaTolerance: true as const } : {}),
      investigations: env.investigations.map((inv) => {
        const ih = inv.hull.map((q) => ({ x: q.o2_mole_fraction / so, y: q.pressure / sp }));
        const ok = tv !== null && ih.length > 0;
        const ex = ok ? hullContains(tv as Vec2, ih) : null;
        const vt = ok && !ex && hullNearBox(ih, tv as Vec2, hx, hy);
        return {
          accession: inv.accession,
          pointCount: inv.pointCount,
          insideHull: ok ? ex || vt : null,
          hullDistance: ok ? (vt ? 0 : distanceToHull(tv as Vec2, ih)) : null,
          ...(vt ? { viaTolerance: true as const } : {}),
        };
      }),
    };
  });
}
