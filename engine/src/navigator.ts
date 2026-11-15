// NAVIGATOR, engine side: where is the evidence, and what is the smallest change that reaches it?
// Everything here is deterministic and pure. The verdict is never decided here: every route is verified
// by running the engine's own cluster judgement on the resulting target (judgeCluster), so a route can
// only be returned when evaluate() gives APPLICABLE for its investigation.
//
// Three kinds of change, never mixed up:
//   move          a continuous axis (O2, pressure, any axis the records carry) goes to the nearest tested point;
//   leave_open    the target states an axis the investigation did not record: leave it open;
//   switch_regime a regime axis (gravity, fuel phase, diluent, flame type) differs from every tested cluster.
//                 It is returned as kind "different_regime", always ranked after every move / leave-open route:
//                 "infinity is not a big number".

import { buildCorpus, citationsOf, compareAccession, recordsAt, testPoints, type Cluster, type TestEvidence } from './evidence.ts';
import { hullContains, hullNearBox, nearestPointOnHull, convexHull, type Vec2 } from './geometry.ts';
import { KPA_PER_PSI } from './presets.ts';
import {
  AXIS_UNITS,
  CONTINUOUS_AXES,
  ENGINE_NAME,
  ENGINE_VERSION,
  MEASUREMENT_TOLERANCE_REL,
  REGIME_AXES,
  type AxisScale,
  type Citation,
  type ConditionRecord,
  type ContinuousAxis,
  type EngineOptions,
  type RegimeAxis,
  type Target,
} from './types.ts';
import { axisLabel, valueLabel, verdictLabel } from './labels.ts';
import { canonicalTarget, judgeCluster, validateTarget } from './verdict.ts';

// ---------- plain-language labels (shared with the reason codes) ----------

export { axisLabel, valueLabel } from './labels.ts';

const sig = (x: number, d = 4) => String(Number(x.toPrecision(d)));
const sig10 = (x: number) => Number(x.toPrecision(10));

/** "30 %", "70.33 kPa (10.2 psia)", "5 cm/s": a value of a continuous axis for a sentence. */
export function formatAxisValue(axis: ContinuousAxis, v: number): string {
  if (axis === 'o2_mole_fraction' || axis === 'burner_o2_mole_fraction') return `${sig(v * 100)} %`;
  if (axis === 'pressure') return `${sig(v)} kPa (${sig(v / KPA_PER_PSI)} psia)`;
  const u = AXIS_UNITS[axis];
  return u === '1' ? sig(v) : `${sig(v)} ${u}`;
}

// ---------- types ----------

export type RouteChangeKind = 'move' | 'leave_open' | 'switch_regime';

export interface RouteChange {
  kind: RouteChangeKind;
  axis: string;
  from?: number | string;
  to?: number | string;
  /** One plain sentence for this change. */
  sentence: string;
  /** The records that define the nearest edge (move), or state the regime the investigation was tested in (switch). */
  citations: Citation[];
}

export type RouteKind = 'move' | 'leave_open' | 'combined' | 'different_regime';

export interface Route {
  accession: string;
  clusterKey: string;
  kind: RouteKind;
  changes: RouteChange[];
  changeCount: number;
  /** Normalized distance travelled by the moved continuous axes (0 when none moved). */
  distance: number;
  /** The target after the change: evaluate() on it gives APPLICABLE for this investigation. */
  target: Target;
  /** The whole route in plain language. */
  sentence: string;
  /** different_regime only: every regime combination this investigation was tested in. */
  testedRegimes?: { gravity_regime?: string; fuel_phase?: string; diluent?: string; flame_type?: string }[];
}

export interface RouteSet {
  engine: { name: string; version: string };
  target: Target;
  /**
   * One route per investigation that is not APPLICABLE and can be reached, ordered by: move / leave-open
   * routes first by (number of changes, distance, accession); different_regime routes after all of them,
   * by the same keys.
   */
  routes: Route[];
  /** Investigations that are not APPLICABLE and for which no route exists, with the reason in words. */
  unreachable: { accession: string; reason: string }[];
  /** Things the reader should know, e.g. that a gravity level was moved out of the compared axes. */
  notes: string[];
}

// ---------- internals ----------

interface ClusterPlan {
  route: Route | null;
  why?: string;
}

function copyTarget(t: Target): Target {
  const out: Target = { regime: { ...t.regime }, continuous: { ...t.continuous } };
  if (t.informational) out.informational = { ...t.informational };
  return out;
}

function recordsOfRegime(cluster: Cluster, axis: RegimeAxis): ConditionRecord[] {
  return cluster.tests.flatMap((t) => t.regime[axis].records);
}

function inRange(v: number, lo: number, hi: number): boolean {
  const tol = MEASUREMENT_TOLERANCE_REL * Math.abs(v);
  return v >= lo - tol && v <= hi + tol;
}

function planCluster(cluster: Cluster, original: Target, scales: Map<ContinuousAxis, AxisScale>): ClusterPlan {
  const T = copyTarget(original);
  const changes: RouteChange[] = [];
  const acc = cluster.accession;
  let switched = false;

  // ---- regime axes ----
  const notCovered = T.informational?.gravity_not_covered;
  for (const axis of REGIME_AXES) {
    const st = cluster.regime.find((s) => s.axis === axis);
    if (!st) continue;
    const t = T.regime[axis];
    if (t === undefined) {
      if (axis === 'gravity_regime' && notCovered) {
        if (st.state !== 'known') return { route: null, why: `${acc} does not record the gravity regime, and the gravity you gave is above everything this dataset covers.` };
        T.regime[axis] = st.values[0];
        changes.push({
          kind: 'switch_regime',
          axis,
          from: 'above 1 g (not covered)',
          to: st.values[0],
          sentence: `Switch the gravity regime to ${valueLabel(st.values[0])}: ${acc} was tested only in ${valueLabel(st.values[0])}, and no regime covers the gravity you gave. This is another regime, not a small step.`,
          citations: citationsOf(recordsOfRegime(cluster, axis)),
        });
        switched = true;
      }
      continue;
    }
    if (axis === 'gravity_regime' && (st.state === 'missing' || st.state === 'conflicting')) {
      // Never leave gravity open to reach an investigation: that would compare a gravity with one nobody stated.
      return {
        route: null,
        why:
          st.state === 'missing'
            ? 'the extracted records do not state its gravity regime, so it cannot be compared on gravity'
            : `the extracted records disagree on its gravity regime (${st.values.map(valueLabel).join(' / ')}), so it cannot be compared on gravity`,
      };
    }
    if (st.state === 'missing' || st.state === 'conflicting') {
      delete T.regime[axis];
      changes.push({
        kind: 'leave_open',
        axis,
        from: t,
        sentence:
          st.state === 'missing'
            ? `Leave ${axisLabel(axis)} open: ${acc} did not record it.`
            : `Leave ${axisLabel(axis)} open: the records of ${acc} disagree on it (${st.values.map(valueLabel).join(' / ')}).`,
        citations: citationsOf(recordsOfRegime(cluster, axis)),
      });
    } else if (!st.values.includes(t)) {
      T.regime[axis] = st.values[0];
      changes.push({
        kind: 'switch_regime',
        axis,
        from: t,
        to: st.values[0],
        sentence: `Switch ${axisLabel(axis)} from ${valueLabel(t)} to ${valueLabel(st.values[0])}: ${acc} was tested only in ${valueLabel(st.values[0])}. This is another regime, not a small step.`,
        citations: citationsOf(recordsOfRegime(cluster, axis)),
      });
      switched = true;
    }
  }
  if (switched && T.informational) {
    delete T.informational.gravity_not_covered;
    if (Object.keys(T.informational).length === 0) delete T.informational;
  }

  // ---- continuous axes the investigation does not record at all ----
  const statedAll = CONTINUOUS_AXES.filter((a) => T.continuous[a] !== undefined);
  for (const a of statedAll) {
    if (!cluster.tests.some((t) => t.continuous[a].values.length > 0)) {
      changes.push({
        kind: 'leave_open',
        axis: a,
        from: T.continuous[a],
        sentence: `Leave ${axisLabel(a)} open: ${acc} did not record it.`,
        citations: [],
      });
      delete T.continuous[a];
    }
  }
  let stated = CONTINUOUS_AXES.filter((a) => T.continuous[a] !== undefined);
  if (statedAll.length > 0 && stated.length === 0) {
    return { route: null, why: `${acc} records none of the axes you set (${statedAll.map(axisLabel).join(', ')}).` };
  }

  // ---- no test records all remaining axes together: open the fewest axes that make some test complete ----
  const completeFor = (axes: readonly ContinuousAxis[]) => cluster.tests.filter((t) => axes.every((a) => t.continuous[a].values.length > 0));
  if (stated.length > 0 && completeFor(stated).length === 0) {
    let found: ContinuousAxis[] | null = null;
    outer: for (let k = 1; k < stated.length; k += 1) {
      const combos: ContinuousAxis[][] = [];
      const rec = (start: number, cur: ContinuousAxis[]) => {
        if (cur.length === k) {
          combos.push([...cur]);
          return;
        }
        for (let i = start; i < stated.length; i += 1) rec(i + 1, [...cur, stated[i]]);
      };
      rec(0, []);
      for (const drop of combos) {
        if (completeFor(stated.filter((a) => !drop.includes(a))).length > 0) {
          found = drop;
          break outer;
        }
      }
    }
    if (!found) return { route: null, why: `No single test of ${acc} records the axes you set together.` };
    for (const a of found) {
      changes.push({
        kind: 'leave_open',
        axis: a,
        from: T.continuous[a],
        sentence: `Leave ${axisLabel(a)} open: no test of ${acc} records it together with the other axes you set.`,
        citations: [],
      });
      delete T.continuous[a];
    }
    stated = CONTINUOUS_AXES.filter((a) => T.continuous[a] !== undefined);
  }

  // ---- moves: to the nearest tested point ----
  const pool: TestEvidence[] = stated.length > 0 ? completeFor(stated) : cluster.tests;
  const moved: { axis: ContinuousAxis; from: number; to: number }[] = [];
  const planeAxes: ContinuousAxis[] = ['o2_mole_fraction', 'pressure'];
  const usesPlane = stated.includes('o2_mole_fraction') && stated.includes('pressure');
  const moveCitations = new Map<ContinuousAxis, Citation[]>();

  if (usesPlane) {
    const so = (scales.get('o2_mole_fraction') as AxisScale).scale;
    const sp = (scales.get('pressure') as AxisScale).scale;
    const pts: { v: Vec2; test: TestEvidence; o2: number; p: number }[] = [];
    for (const t of pool) {
      const tp = testPoints(t, planeAxes);
      if (tp !== null) for (const [o2, p] of tp) pts.push({ v: { x: o2 / so, y: p / sp }, test: t, o2, p });
    }
    if (pts.length === 0) {
      return { route: null, why: `${acc} lists several oxygen and pressure values without saying which go together, so no tested point can be named.` };
    }
    const hv = convexHull(pts.map((p) => p.v));
    const o2v = T.continuous.o2_mole_fraction as number;
    const pv = T.continuous.pressure as number;
    const tv: Vec2 = { x: o2v / so, y: pv / sp };
    const inside = hullContains(tv, hv) || hullNearBox(hv, tv, (MEASUREMENT_TOLERANCE_REL * Math.abs(o2v)) / so, (MEASUREMENT_TOLERANCE_REL * Math.abs(pv)) / sp);
    if (!inside) {
      const near = nearestPointOnHull(tv, hv);
      if (near) {
        const newO2 = sig10(near.point.x * so);
        const newP = sig10(near.point.y * sp);
        const vertexRecs = near.vertices.flatMap((vx) => pts.filter((q) => q.v.x === vx.x && q.v.y === vx.y).flatMap((q) => [...recordsAt(q.test, 'o2_mole_fraction', q.o2), ...recordsAt(q.test, 'pressure', q.p)]));
        const cites = citationsOf(vertexRecs);
        if (newO2 !== o2v) moved.push({ axis: 'o2_mole_fraction', from: o2v, to: newO2 });
        if (newP !== pv) moved.push({ axis: 'pressure', from: pv, to: newP });
        moveCitations.set('o2_mole_fraction', cites);
        moveCitations.set('pressure', cites);
      }
    }
  }
  for (const a of stated) {
    if (usesPlane && planeAxes.includes(a)) {
      // The per-axis range of a plane axis is covered by the hull move; check it anyway after the move.
      continue;
    }
    const values = pool.flatMap((t) => t.continuous[a].values);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const tv = T.continuous[a] as number;
    if (!inRange(tv, lo, hi)) {
      const to = tv < lo ? lo : hi;
      moved.push({ axis: a, from: tv, to });
      moveCitations.set(a, citationsOf(pool.flatMap((t) => recordsAt(t, a, to))));
    }
  }
  for (const m of moved) {
    T.continuous[m.axis] = m.to;
    // A move smaller than the measurement tolerance is not a change: say nothing about that axis.
    if (Math.abs(m.to - m.from) <= MEASUREMENT_TOLERANCE_REL * Math.abs(m.from)) continue;
    changes.push({
      kind: 'move',
      axis: m.axis,
      from: m.from,
      to: m.to,
      sentence: `Move ${axisLabel(m.axis)} from ${formatAxisValue(m.axis, m.from)} to ${formatAxisValue(m.axis, m.to)}, the nearest condition tested in ${acc}.`,
      citations: moveCitations.get(m.axis) ?? [],
    });
  }

  if (changes.length === 0) return { route: null, why: `${acc}: no change of the kinds this tool offers is needed or possible.` };

  // ---- verify with the engine's own judgement ----
  const finalTarget = canonicalTarget(T);
  const verdict = judgeCluster(cluster, finalTarget, scales).verdict;
  if (verdict !== 'APPLICABLE') {
    return { route: null, why: `${acc}: no change of the kinds this tool offers makes it comparable (the engine's answer is: ${verdictLabel(verdict)}).` };
  }

  const distance = Math.sqrt(moved.reduce((s, m) => s + (((m.to - m.from) / (scales.get(m.axis) as AxisScale).scale) ** 2), 0));
  const hasSwitch = changes.some((c) => c.kind === 'switch_regime');
  const kinds = new Set(changes.map((c) => c.kind));
  const kind: RouteKind = hasSwitch ? 'different_regime' : kinds.size > 1 ? 'combined' : kinds.has('move') ? 'move' : 'leave_open';
  // Order the sentence: leave-open, moves, then regime switches last.
  const order: Record<RouteChangeKind, number> = { leave_open: 0, move: 1, switch_regime: 2 };
  changes.sort((a, b) => order[a.kind] - order[b.kind]);
  return {
    route: {
      accession: acc,
      clusterKey: cluster.key,
      kind,
      changes,
      changeCount: changes.length,
      distance,
      target: finalTarget,
      sentence: changes.map((c) => c.sentence).join(' '),
    },
  };
}

function testedRegimes(clusters: Cluster[]): NonNullable<Route['testedRegimes']> {
  const out: NonNullable<Route['testedRegimes']> = [];
  for (const c of clusters) {
    const r: Record<string, string> = {};
    for (const s of c.regime) if (s.state === 'known') r[s.axis] = s.values[0];
    out.push(r);
  }
  return out;
}

function compareRoutes(a: Route, b: Route): number {
  const tier = (r: Route) => (r.kind === 'different_regime' ? 1 : 0);
  return tier(a) - tier(b) || a.changeCount - b.changeCount || a.distance - b.distance || compareAccession(a.accession, b.accession) || (a.clusterKey < b.clusterKey ? -1 : a.clusterKey > b.clusterKey ? 1 : 0);
}

/**
 * For every investigation that is not APPLICABLE under evaluate(), the smallest change that makes it APPLICABLE,
 * ranked by (kind tier, number of changes, distance). Every route is verified against the engine's own
 * judgement before it is returned. The target is not modified.
 */
export function routesToEvidence(records: readonly ConditionRecord[], target: Target, options: EngineOptions = {}): RouteSet {
  validateTarget(target);
  const opts: Required<EngineOptions> = { minimumStatus: options.minimumStatus ?? 'extracted' };
  const notes: string[] = [];
  const tgt = canonicalTarget(target);
  if (tgt.continuous.gravity_level !== undefined) {
    // No condition record carries gravity_level: it selects the regime and is only shown, never compared.
    tgt.informational = { ...tgt.informational, gravity_level: tgt.continuous.gravity_level };
    delete tgt.continuous.gravity_level;
    notes.push('The gravity level is shown, not compared: no condition record carries it, so it is not an axis a route can move or leave open.');
  }
  const corpus = buildCorpus(records, opts);
  const scales = new Map(corpus.normalization.map((s) => [s.axis, s] as const));

  const byAccession = new Map<string, Cluster[]>();
  for (const c of corpus.clusters) byAccession.set(c.accession, [...(byAccession.get(c.accession) ?? []), c]);

  const routes: Route[] = [];
  const unreachable: RouteSet['unreachable'] = [];
  for (const [accession, clusters] of byAccession) {
    const verdicts = clusters.map((c) => judgeCluster(c, tgt, scales).verdict);
    if (verdicts.includes('APPLICABLE')) continue;
    const plans = clusters.map((c) => planCluster(c, tgt, scales));
    const ok = plans.flatMap((p) => (p.route ? [p.route] : []));
    if (ok.length === 0) {
      unreachable.push({ accession, reason: plans.map((p) => p.why).filter((x): x is string => !!x)[0] ?? `${accession}: no route found.` });
      continue;
    }
    ok.sort(compareRoutes);
    const best = ok[0];
    if (best.kind === 'different_regime') best.testedRegimes = testedRegimes(clusters);
    routes.push(best);
  }
  routes.sort(compareRoutes);
  unreachable.sort((a, b) => compareAccession(a.accession, b.accession));
  return { engine: { name: ENGINE_NAME, version: ENGINE_VERSION }, target: tgt, routes, unreachable, notes };
}

// ---------- N2: the evidence map ----------

export interface EvidenceMapGrid {
  /** [min, max, n]: n values from min to max inclusive (n = 1 gives min). O2 as a mole fraction. */
  o2: readonly [number, number, number];
  /** [min, max, n], pressure in kPa. */
  pressure: readonly [number, number, number];
}

export interface EvidenceCell {
  o2: number;
  pressure: number;
  /** Investigations APPLICABLE at this (O2, pressure), in accession order. */
  applicable: string[];
  /** Investigations EXTRAPOLATION here (nothing better), in accession order. */
  extrapolation: string[];
}

export interface EvidenceMap {
  engine: { name: string; version: string };
  regime: Target['regime'];
  o2Values: number[];
  pressureValues: number[];
  /** Row-major: pressure index outer, O2 index inner (cells[i * o2Values.length + j]). */
  cells: EvidenceCell[];
  maxApplicable: number;
  maxExtrapolation: number;
}

function linspace([lo, hi, n]: readonly [number, number, number], name: string): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !Number.isInteger(n) || n < 1 || hi < lo) throw new RangeError(`grid.${name}: need finite min <= max and an integer n >= 1`);
  if (n === 1) return [lo];
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? hi : lo + ((hi - lo) * i) / (n - 1)));
}

interface PreparedCluster {
  accession: string;
  /** Fixed by the regime selection: 'barrier' | 'unknown' | 'incomplete' | 'ok'. */
  state: 'barrier' | 'unknown' | 'incomplete' | 'ok';
  o2: [number, number];
  p: [number, number];
  hull: Vec2[];
  hasPoints: boolean;
}

const VERDICT_RANK: Record<string, number> = { APPLICABLE: 0, EXTRAPOLATION: 1, INSUFFICIENT_EVIDENCE: 2, REGIME_BARRIER: 3 };

/**
 * For each cell of an (O2 × pressure) grid, which investigations are APPLICABLE and which EXTRAPOLATION, with the
 * regime axes of `regime` fixed (axes it leaves open are not compared). Each cell equals evaluate() for the target
 * {regime, continuous: {o2, pressure}}: the hulls are built once and every cell is a cheap test against them.
 * Other continuous axes are not part of the map.
 */
export function evidenceMap(records: readonly ConditionRecord[], regime: Target['regime'], grid: EvidenceMapGrid, options: EngineOptions = {}): EvidenceMap {
  validateTarget({ regime, continuous: {} });
  const o2Values = linspace(grid.o2, 'o2');
  const pressureValues = linspace(grid.pressure, 'pressure');
  const opts: Required<EngineOptions> = { minimumStatus: options.minimumStatus ?? 'extracted' };
  const corpus = buildCorpus(records, opts);
  const so = (corpus.normalization.find((s) => s.axis === 'o2_mole_fraction') as AxisScale).scale;
  const sp = (corpus.normalization.find((s) => s.axis === 'pressure') as AxisScale).scale;
  const planeAxes: ContinuousAxis[] = ['o2_mole_fraction', 'pressure'];

  const prepared: PreparedCluster[] = corpus.clusters.map((c) => {
    let barrier = false;
    let unknown = false;
    for (const st of c.regime) {
      const t = regime[st.axis];
      if (t === undefined) continue;
      if (st.state === 'missing' || st.state === 'conflicting') unknown = true;
      else if (!st.values.includes(t)) barrier = true;
    }
    const complete = c.tests.filter((t) => planeAxes.every((a) => t.continuous[a].values.length > 0));
    const base = { accession: c.accession, o2: [0, 0] as [number, number], p: [0, 0] as [number, number], hull: [] as Vec2[], hasPoints: false };
    if (barrier) return { ...base, state: 'barrier' as const };
    if (unknown) return { ...base, state: 'unknown' as const };
    if (complete.length === 0) return { ...base, state: 'incomplete' as const };
    const o2v = complete.flatMap((t) => t.continuous.o2_mole_fraction.values);
    const pv = complete.flatMap((t) => t.continuous.pressure.values);
    const pts: Vec2[] = [];
    for (const t of complete) {
      const tp = testPoints(t, planeAxes);
      if (tp !== null) for (const [o2, p] of tp) pts.push({ x: o2 / so, y: p / sp });
    }
    return { ...base, state: 'ok' as const, o2: [Math.min(...o2v), Math.max(...o2v)], p: [Math.min(...pv), Math.max(...pv)], hull: pts.length > 0 ? convexHull(pts) : [], hasPoints: pts.length > 0 };
  });

  const accessions = [...new Set(prepared.map((c) => c.accession))].sort(compareAccession);
  const byAcc = new Map(accessions.map((a) => [a, prepared.filter((c) => c.accession === a)] as const));

  const cells: EvidenceCell[] = [];
  let maxA = 0;
  let maxE = 0;
  for (const p of pressureValues) {
    for (const o2 of o2Values) {
      const tv: Vec2 = { x: o2 / so, y: p / sp };
      const hx = (MEASUREMENT_TOLERANCE_REL * Math.abs(o2)) / so;
      const hy = (MEASUREMENT_TOLERANCE_REL * Math.abs(p)) / sp;
      const applicable: string[] = [];
      const extrapolation: string[] = [];
      for (const acc of accessions) {
        let best = 3;
        for (const c of byAcc.get(acc) as PreparedCluster[]) {
          let v: number;
          if (c.state === 'barrier') v = 3;
          else if (c.state !== 'ok') v = 2;
          else {
            const outside = !inRange(o2, c.o2[0], c.o2[1]) || !inRange(p, c.p[0], c.p[1]);
            const outsideHull = c.hasPoints && !(hullContains(tv, c.hull) || hullNearBox(c.hull, tv, hx, hy));
            v = outside || outsideHull ? 1 : !c.hasPoints ? 2 : 0;
          }
          if (v < best) best = v;
          if (best === 0) break;
        }
        if (best === VERDICT_RANK.APPLICABLE) applicable.push(acc);
        else if (best === VERDICT_RANK.EXTRAPOLATION) extrapolation.push(acc);
      }
      maxA = Math.max(maxA, applicable.length);
      maxE = Math.max(maxE, extrapolation.length);
      cells.push({ o2, pressure: p, applicable, extrapolation });
    }
  }
  return { engine: { name: ENGINE_NAME, version: ENGINE_VERSION }, regime: { ...regime }, o2Values, pressureValues, cells, maxApplicable: maxA, maxExtrapolation: maxE };
}
