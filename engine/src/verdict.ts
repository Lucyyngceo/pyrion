// The applicability verdict. Pure, deterministic: same records and target in, same bytes out.
// No randomness, no clock, no locale, no model. See engine/README.md for every rule used here.

import {
  buildCorpus,
  citationsOf,
  compareAccession,
  recordsAt,
  testPoints,
  type Cluster,
  type TestEvidence,
} from './evidence.ts';
import { convexHull, distanceToHull, hullContains, hullNearBox, type Vec2 } from './geometry.ts';
import {
  AXIS_UNITS,
  CONTINUOUS_AXES,
  ENGINE_NAME,
  ENGINE_VERSION,
  MEASUREMENT_TOLERANCE_NOTE,
  MEASUREMENT_TOLERANCE_REL,
  REGIME_AXES,
  REGIME_VALUES,
  type AxisCheck,
  type AxisScale,
  type Citation,
  type ClusterVerdict,
  type ConditionRecord,
  type ContinuousAxis,
  type EngineOptions,
  type Evaluation,
  type HullCheck,
  type InvestigationVerdict,
  type Reason,
  type ReasonCode,
  type Target,
  type Verdict,
} from './types.ts';

const VERDICT_ORDER: readonly Verdict[] = ['APPLICABLE', 'EXTRAPOLATION', 'INSUFFICIENT_EVIDENCE', 'REGIME_BARRIER'];

/** Number format for messages only (structured fields keep full precision). */
export function fmt(n: number): string {
  return String(Number(n.toPrecision(6)));
}

function unitSuffix(axis: ContinuousAxis): string {
  const u = AXIS_UNITS[axis];
  return u === '1' ? '' : ` ${u}`;
}

function reason(
  code: ReasonCode,
  informational: boolean,
  axis: string | null,
  message: string,
  citations: Citation[] = [],
): Reason {
  return { code, informational, axis, message, citations };
}

/** Throws on a malformed target. A target is input, so it is checked like a record. */
export function validateTarget(target: Target): void {
  for (const [axis, value] of Object.entries(target.regime)) {
    if (!(REGIME_AXES as readonly string[]).includes(axis)) throw new TypeError(`target: unknown regime axis "${axis}"`);
    if (value !== undefined && !REGIME_VALUES[axis as keyof typeof REGIME_VALUES].includes(value)) {
      throw new TypeError(`target: ${axis} "${value}" is not an allowed value`);
    }
  }
  for (const [axis, value] of Object.entries(target.continuous)) {
    if (!(CONTINUOUS_AXES as readonly string[]).includes(axis)) throw new TypeError(`target: unknown axis "${axis}"`);
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`target: ${axis} must be a finite number`);
    if ((axis === 'o2_mole_fraction' || axis === 'burner_o2_mole_fraction') && (value < 0 || value > 1)) {
      throw new TypeError(`target: ${axis} is a fraction (0 to 1)`);
    }
  }
}

/** Canonical copy of the target: fixed key order, undefined entries dropped. */
/** Internal (used by the navigator). */
export function canonicalTarget(target: Target): Target {
  const regime: Target['regime'] = {};
  for (const a of REGIME_AXES) if (target.regime[a] !== undefined) regime[a] = target.regime[a];
  const continuous: Target['continuous'] = {};
  for (const a of CONTINUOUS_AXES) if (target.continuous[a] !== undefined) continuous[a] = target.continuous[a];
  const out: Target = { regime, continuous };
  if (target.informational) out.informational = { ...target.informational };
  return out;
}

/** Internal (used by the navigator): the verdict of one cluster against one target. */
export function judgeCluster(cluster: Cluster, target: Target, scales: Map<ContinuousAxis, AxisScale>): ClusterVerdict {
  const reasons: Reason[] = [];
  const usedRecords: ConditionRecord[] = [];
  const excludedRelevant: ConditionRecord[] = [];

  // ---- 1. Regime axes: barriers, never distances ----
  // A regime axis the target leaves open is not compared (reported as context).
  // A stated axis must be stated by the evidence too, and be the same, or there is no verdict on it.
  let barrier = false;
  let regimeUnknown = false;
  const regimeReasons: Reason[] = [];
  for (const state of cluster.regime) {
    const axis = state.axis;
    const t = target.regime[axis];
    const recs = cluster.tests.flatMap((x) => x.regime[axis].records);
    const excl = cluster.tests.flatMap((x) => x.regime[axis].excluded);
    if (t === undefined && axis === 'gravity_regime' && target.informational?.gravity_not_covered) {
      // The target states a gravity that no regime of this dataset covers: never a silent open axis.
      regimeUnknown = true;
      regimeReasons.push(reason('regime_missing', false, axis, `${axis}: ${target.informational.gravity_not_covered}`, []));
      continue;
    }
    if (t === undefined) {
      const ev = state.state === 'missing' ? 'not stated by the evidence either' : `evidence is ${state.values.join(' / ')}`;
      regimeReasons.push(reason('target_regime_unstated', true, axis, `${axis}: left open by the target, so not compared (${ev}).`, citationsOf(recs)));
      continue;
    }
    excludedRelevant.push(...excl);
    if (state.state !== 'missing') usedRecords.push(...recs);
    if (state.state === 'missing') {
      regimeUnknown = true;
      const extra = excl.length > 0 ? ` ${excl.length} record(s) exist but are excluded (status ${[...new Set(excl.map((r) => r.status))].join(', ')}).` : '';
      regimeReasons.push(reason('regime_missing', false, axis, `${axis}: no usable record states it for these tests.${extra}`, citationsOf(excl)));
      continue;
    }
    if (!state.values.includes(t)) {
      barrier = true;
      regimeReasons.push(
        reason(
          'regime_barrier',
          false,
          axis,
          `${axis}: target is ${t}, evidence is ${state.values.join(' / ')}. Different regime: no distance is defined across it.`,
          citationsOf(recs),
        ),
      );
      continue;
    }
    if (state.state === 'conflicting') {
      regimeUnknown = true;
      regimeReasons.push(
        reason('regime_conflicting', false, axis, `${axis}: records disagree (${state.values.join(' / ')}); the regime cannot be fixed.`, citationsOf(recs)),
      );
      continue;
    }
    regimeReasons.push(reason('regime_match', true, axis, `${axis}: target and evidence are both ${t}.`, citationsOf(recs)));
  }
  // A barrier decides alone: a missing or conflicting value on another axis is then context.
  for (const r of regimeReasons) {
    reasons.push(barrier && (r.code === 'regime_missing' || r.code === 'regime_conflicting') ? { ...r, informational: true } : r);
  }

  // ---- 2. Continuous axes ----
  const axes = CONTINUOUS_AXES.filter((a) => target.continuous[a] !== undefined);
  const complete = cluster.tests.filter((t) => axes.every((a) => t.continuous[a].values.length > 0));
  const incomplete = cluster.tests.filter((t) => !complete.includes(t));
  for (const t of cluster.tests) for (const a of axes) excludedRelevant.push(...t.continuous[a].excluded);
  // Context only (does not decide) when a regime barrier or an unknown regime already decided.
  const decided = barrier || regimeUnknown;

  const axisChecks: AxisCheck[] = [];
  let outside = false;
  let missingAxis = false;
  // With no complete test the per-axis ranges are still reported, from the tests that have the axis,
  // but only as context: the verdict is then INSUFFICIENT_EVIDENCE.
  const axisContext = decided || complete.length === 0;
  for (const axis of axes) {
    const tv = target.continuous[axis] as number;
    const scale = (scales.get(axis) as AxisScale).scale;
    const pool = complete.length > 0 ? complete : cluster.tests.filter((t) => t.continuous[axis].values.length > 0);
    if (pool.length === 0) {
      missingAxis = true;
      axisChecks.push({ axis, unit: AXIS_UNITS[axis], target: tv, min: null, max: null, status: 'missing', gap: null, gapNormalized: null, minCitations: [], maxCitations: [] });
      const excl = cluster.tests.flatMap((t) => t.continuous[axis].excluded);
      const extra = excl.length > 0 ? ` ${excl.length} record(s) exist but are excluded (status ${[...new Set(excl.map((r) => r.status))].join(', ')}).` : '';
      reasons.push(reason('axis_missing', decided, axis, `No usable ${axis} value for any of the ${cluster.tests.length} test(s).${extra}`, citationsOf(excl)));
      continue;
    }
    const values = pool.flatMap((t) => t.continuous[axis].values);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const minRecs = pool.flatMap((t) => recordsAt(t, axis, min));
    const maxRecs = pool.flatMap((t) => recordsAt(t, axis, max));
    usedRecords.push(...pool.flatMap((t) => t.continuous[axis].records));
    const tol = MEASUREMENT_TOLERANCE_REL * Math.abs(tv);
    let status: 'below' | 'above' | 'inside' = tv < min ? 'below' : tv > max ? 'above' : 'inside';
    let tolBound: number | null = null;
    if (status === 'below' && min - tv <= tol) {
      status = 'inside';
      tolBound = min;
    } else if (status === 'above' && tv - max <= tol) {
      status = 'inside';
      tolBound = max;
    }
    const gap = status === 'below' ? min - tv : status === 'above' ? tv - max : 0;
    axisChecks.push({
      axis,
      unit: AXIS_UNITS[axis],
      target: tv,
      min,
      max,
      status,
      gap,
      gapNormalized: gap / scale,
      minCitations: citationsOf(minRecs),
      maxCitations: citationsOf(maxRecs),
      ...(tolBound !== null ? { viaTolerance: true as const } : {}),
    });
    const range = `measured ${fmt(min)} to ${fmt(max)}${unitSuffix(axis)}`;
    if (status === 'inside') {
      const msg =
        tolBound !== null
          ? `${axis}: target ${fmt(tv)}${unitSuffix(axis)} is within the ${MEASUREMENT_TOLERANCE_REL * 100} % measurement tolerance of the tested ${fmt(tolBound)}${unitSuffix(axis)} (${range}). ${MEASUREMENT_TOLERANCE_NOTE}`
          : `${axis}: target ${fmt(tv)}${unitSuffix(axis)} is inside the ${range}.`;
      reasons.push(reason('inside_range', axisContext, axis, msg, citationsOf([...minRecs, ...maxRecs])));
    } else {
      outside = true;
      const bound = status === 'below' ? minRecs : maxRecs;
      reasons.push(
        reason(
          'outside_range',
          axisContext,
          axis,
          `${axis}: target ${fmt(tv)}${unitSuffix(axis)} is ${status} the ${range}, by ${fmt(gap)}${unitSuffix(axis)} (${fmt(gap / scale)} of the axis scale).`,
          citationsOf(bound),
        ),
      );
    }
  }
  if (complete.length === 0 && !missingAxis) {
    reasons.push(
      reason(
        'axis_missing',
        decided,
        null,
        `No test has usable values for all of ${axes.join(', ')} at once, so no measured point can be placed against the target.`,
      ),
    );
  }
  if (complete.length > 0 && incomplete.length > 0) {
    const lackingAxes = axes.filter((a) => incomplete.some((t) => t.continuous[a].values.length === 0));
    reasons.push(
      reason(
        'incomplete_tests',
        true,
        null,
        `${incomplete.length} of ${cluster.tests.length} test(s) lack a usable value for ${lackingAxes.join(', ')} and are not part of this envelope: ${incomplete.map((t) => t.test_id).join(', ')}.`,
      ),
    );
  }

  // ---- 3. 2-D envelope in the (O2, pressure) plane ----
  let hull: HullCheck | null = null;
  let hullUnknown = false;
  let outsideHull = false;
  const usesPlane = target.continuous.o2_mole_fraction !== undefined && target.continuous.pressure !== undefined;
  if (usesPlane && complete.length > 0) {
    const so = (scales.get('o2_mole_fraction') as AxisScale).scale;
    const sp = (scales.get('pressure') as AxisScale).scale;
    const plane: ContinuousAxis[] = ['o2_mole_fraction', 'pressure'];
    const pts: { v: Vec2; test: TestEvidence; o2: number; p: number }[] = [];
    const unpaired: TestEvidence[] = [];
    for (const t of complete) {
      const tp = testPoints(t, plane);
      if (tp === null) unpaired.push(t);
      else for (const [o2, p] of tp) pts.push({ v: { x: o2 / so, y: p / sp }, test: t, o2, p });
    }
    if (unpaired.length > 0) {
      reasons.push(
        reason(
          'unpaired_values',
          decided || pts.length > 0,
          null,
          `${unpaired.length} test(s) list several O2 and several pressure values without saying which go together; they bound the per-axis ranges but not the 2-D envelope: ${unpaired.map((t) => t.test_id).join(', ')}.`,
        ),
      );
    }
    if (pts.length === 0) {
      hullUnknown = true;
    } else {
      const hv = convexHull(pts.map((p) => p.v));
      const tv: Vec2 = { x: (target.continuous.o2_mole_fraction as number) / so, y: (target.continuous.pressure as number) / sp };
      const exactInside = hullContains(tv, hv);
      const tolInside =
        !exactInside &&
        hullNearBox(
          hv,
          tv,
          (MEASUREMENT_TOLERANCE_REL * Math.abs(target.continuous.o2_mole_fraction as number)) / so,
          (MEASUREMENT_TOLERANCE_REL * Math.abs(target.continuous.pressure as number)) / sp,
        );
      const inside = exactInside || tolInside;
      const dist = inside ? 0 : distanceToHull(tv, hv);
      const vertexRecs: ConditionRecord[] = [];
      for (const v of hv) {
        for (const p of pts.filter((q) => q.v.x === v.x && q.v.y === v.y)) {
          vertexRecs.push(...recordsAt(p.test, 'o2_mole_fraction', p.o2), ...recordsAt(p.test, 'pressure', p.p));
        }
      }
      hull = {
        hull: hv.map((v) => ({ o2_mole_fraction: v.x * so, pressure: v.y * sp })),
        inside,
        distanceNormalized: dist,
        pointCount: pts.length,
        ...(tolInside ? { viaTolerance: true as const } : {}),
      };
      if (inside) {
        const msg = tolInside
          ? `(O2, pressure) is within the ${MEASUREMENT_TOLERANCE_REL * 100} % measurement tolerance of the convex hull of ${pts.length} measured point(s). ${MEASUREMENT_TOLERANCE_NOTE}`
          : `(O2, pressure) is inside the convex hull of ${pts.length} measured point(s).`;
        reasons.push(reason('inside_hull', decided, 'o2_mole_fraction+pressure', msg, citationsOf(vertexRecs)));
      } else {
        outsideHull = true;
        reasons.push(
          reason(
            'outside_hull',
            decided,
            'o2_mole_fraction+pressure',
            `(O2, pressure) is outside the convex hull of ${pts.length} measured point(s), at normalized distance ${fmt(dist)}.`,
            citationsOf(vertexRecs),
          ),
        );
      }
    }
  }

  // ---- 4. Verdict ----
  let verdict: Verdict;
  if (barrier) verdict = 'REGIME_BARRIER';
  else if (regimeUnknown || missingAxis || complete.length === 0) verdict = 'INSUFFICIENT_EVIDENCE';
  else if (outside || outsideHull) verdict = 'EXTRAPOLATION';
  else if (hullUnknown) verdict = 'INSUFFICIENT_EVIDENCE';
  else verdict = 'APPLICABLE';

  // ---- 5. Distance (only for APPLICABLE and EXTRAPOLATION) ----
  let distance: number | null = null;
  let distanceNote: string;
  if (verdict === 'REGIME_BARRIER') {
    distanceNote = 'undefined: the target is across a regime barrier from this evidence';
  } else if (verdict === 'INSUFFICIENT_EVIDENCE') {
    distanceNote = 'undefined: insufficient evidence to place the target';
  } else if (axes.length === 0) {
    distance = 0;
    distanceNote = 'the target states no continuous axis';
  } else {
    let best: { d: number; test: TestEvidence; point: number[] } | null = null;
    for (const t of complete) {
      const tp = testPoints(t, axes);
      if (tp === null) continue;
      for (const point of tp) {
        let s = 0;
        axes.forEach((a, i) => {
          const z = ((target.continuous[a] as number) - point[i]) / (scales.get(a) as AxisScale).scale;
          s += z * z;
        });
        const d = Math.sqrt(s);
        if (best === null || d < best.d) best = { d, test: t, point };
      }
    }
    if (best === null) {
      distanceNote = 'undefined: no test pairs its values on these axes unambiguously';
    } else {
      distance = best.d;
      distanceNote = `normalized Euclidean distance to the nearest measured point (test ${best.test.test_id})`;
      const b = best;
      const recs = axes.flatMap((a, i) => recordsAt(b.test, a, b.point[i]));
      reasons.push(
        reason(
          'nearest_point',
          true,
          null,
          `Nearest measured point: test ${b.test.test_id} (${axes.map((a, i) => `${a} ${fmt(b.point[i])}${unitSuffix(a)}`).join(', ')}), normalized distance ${fmt(b.d)}.`,
          citationsOf(recs),
        ),
      );
    }
  }

  if (excludedRelevant.length > 0) {
    reasons.push(
      reason(
        'flagged_records_ignored',
        true,
        null,
        `${citationsOf(excludedRelevant).length} record(s) on the axes of this target were not counted as evidence (status insufficient_evidence, or not verified when only verified records count).`,
        citationsOf(excludedRelevant),
      ),
    );
  }

  const used = citationsOf(usedRecords);
  const descriptors: Record<string, string[]> = {};
  for (const t of cluster.tests) {
    for (const [k, vals] of Object.entries(t.descriptors)) descriptors[k] = [...new Set([...(descriptors[k] ?? []), ...vals])];
  }
  for (const k of Object.keys(descriptors)) descriptors[k].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const sortedDescriptors: Record<string, string[]> = {};
  for (const k of Object.keys(descriptors).sort()) sortedDescriptors[k] = descriptors[k];

  return {
    accession: cluster.accession,
    clusterKey: cluster.key,
    regime: cluster.regime,
    tests: cluster.tests.map((t) => t.test_id),
    verdict,
    rank: null,
    distance,
    distanceNote,
    axes: axisChecks,
    hull,
    evidenceStatus: used.length === 0 ? 'none' : used.every((c) => c.status === 'verified') ? 'verified' : 'includes_unverified',
    descriptors: sortedDescriptors,
    reasons,
  };
}

function compareRanked(a: ClusterVerdict, b: ClusterVerdict): number {
  const v = VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict);
  if (v !== 0) return v;
  if (a.distance !== b.distance) {
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  }
  return compareAccession(a.accession, b.accession) || (a.clusterKey < b.clusterKey ? -1 : a.clusterKey > b.clusterKey ? 1 : 0);
}

function emptyCounts(): Record<Verdict, number> {
  return { APPLICABLE: 0, EXTRAPOLATION: 0, INSUFFICIENT_EVIDENCE: 0, REGIME_BARRIER: 0 };
}

/**
 * Judge every investigation and every cluster inside it against one target.
 * @param records validated condition records (see parseConditionCsv / loadConditionDir)
 */
export function evaluate(records: readonly ConditionRecord[], target: Target, options: EngineOptions = {}): Evaluation {
  validateTarget(target);
  const opts: Required<EngineOptions> = { minimumStatus: options.minimumStatus ?? 'extracted' };
  const tgt = canonicalTarget(target);
  const corpus = buildCorpus(records, opts);
  const scales = new Map(corpus.normalization.map((s) => [s.axis, s] as const));

  const all = corpus.clusters.map((c) => judgeCluster(c, tgt, scales));

  const ranked = all.filter((v) => v.verdict === 'APPLICABLE' || v.verdict === 'EXTRAPOLATION').sort(compareRanked);
  ranked.forEach((v, i) => {
    v.rank = i + 1;
  });
  const unranked = all.filter((v) => v.verdict === 'INSUFFICIENT_EVIDENCE' || v.verdict === 'REGIME_BARRIER').sort(compareRanked);

  const investigations: InvestigationVerdict[] = [];
  const accessions = [...new Set(all.map((v) => v.accession))].sort(compareAccession);
  for (const accession of accessions) {
    const mine = all.filter((v) => v.accession === accession);
    const best = [...mine].sort(compareRanked)[0];
    investigations.push({
      accession,
      verdict: best.verdict,
      decidingCluster: best.clusterKey,
      clusters: mine.map((v) => ({ clusterKey: v.clusterKey, verdict: v.verdict })),
    });
  }

  const invCounts = emptyCounts();
  for (const inv of investigations) invCounts[inv.verdict] += 1;
  const clusterCounts = emptyCounts();
  for (const v of all) clusterCounts[v.verdict] += 1;

  return {
    engine: { name: ENGINE_NAME, version: ENGINE_VERSION },
    target: tgt,
    openRegimeAxes: REGIME_AXES.filter((a) => tgt.regime[a] === undefined),
    options: opts,
    normalization: corpus.normalization,
    counts: {
      investigations: invCounts,
      clusters: clusterCounts,
      recordsUsed: corpus.recordsUsed,
      recordsFlaggedInsufficient: corpus.recordsFlaggedInsufficient,
      recordsBelowMinimumStatus: corpus.recordsBelowMinimumStatus,
    },
    investigations,
    ranked,
    unranked,
  };
}
