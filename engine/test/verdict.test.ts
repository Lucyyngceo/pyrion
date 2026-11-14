// Required cases for the applicability verdict. All data here is SYNTHETIC (test/fixtures/synthetic).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { canonicalJson, evaluate, parseConditionCsv, presetTarget, type Target } from '../src/index.ts';
import { FIXTURES, MICRO_SOLID_N2, clustersOf, fixtureRecords, onlyCluster, shuffled } from './helpers.ts';

const records = fixtureRecords();
const inRange: Target = { regime: { ...MICRO_SOLID_N2 }, continuous: { o2_mole_fraction: 0.22, pressure: 90 } };
const micro = (o2: number, pressure: number): Target => ({ regime: { ...MICRO_SOLID_N2 }, continuous: { o2_mole_fraction: o2, pressure } });

describe('determinism', () => {
  it('same input gives byte-identical output', () => {
    const a = canonicalJson(evaluate(records, inRange));
    const b = canonicalJson(evaluate(records, inRange));
    assert.equal(a, b);
  });

  it('record order does not change a single byte', () => {
    const a = canonicalJson(evaluate(records, inRange));
    for (const seed of [1, 2, 3, 99, 2026]) {
      assert.equal(canonicalJson(evaluate(shuffled(records, seed), inRange)), a);
    }
  });

  it('parsing the files again and evaluating gives identical bytes for every preset', () => {
    const load = () =>
      ['PSI-9001', 'PSI-9002', 'PSI-9003', 'PSI-9004', 'PSI-9005', 'PSI-9006', 'PSI-9007'].flatMap(
        (acc) => parseConditionCsv(readFileSync(join(FIXTURES, `${acc}.csv`), 'utf8'), `${acc}.csv`, acc).records,
      );
    for (const id of ['challenge-lunar-base', 'nesc-10.2psia-26.5o2-lunar', 'nesc-8.2psia-34o2-lunar']) {
      assert.equal(canonicalJson(evaluate(load(), presetTarget(id))), canonicalJson(evaluate(load(), presetTarget(id))));
    }
  });

  it('target key order does not matter', () => {
    const t2: Target = {
      continuous: { pressure: 90, o2_mole_fraction: 0.22 },
      regime: { diluent: 'N2', fuel_phase: 'solid', gravity_regime: 'microgravity' },
    };
    assert.equal(canonicalJson(evaluate(records, t2)), canonicalJson(evaluate(records, inRange)));
  });
});

describe('REGIME_BARRIER', () => {
  const ev = evaluate(records, presetTarget('challenge-lunar-base'));

  it('a partial-gravity lunar target against microgravity evidence is a regime barrier', () => {
    const c = onlyCluster(ev, 'PSI-9001');
    assert.equal(c.verdict, 'REGIME_BARRIER');
    const r = c.reasons.find((x) => x.code === 'regime_barrier');
    assert.ok(r, 'barrier reason present');
    assert.equal(r.axis, 'gravity_regime');
    assert.equal(r.informational, false);
    assert.equal(r.citations[0].variable, 'gravity_regime');
    assert.equal(r.citations[0].value, 'microgravity');
    assert.equal(r.citations[0].source_file, 'SYNTHETIC/PSI-9001-fixture.csv');
  });

  it('distance across a barrier is undefined (null), never a number, and it is never ranked', () => {
    const barriers = [...ev.ranked, ...ev.unranked].filter((x) => x.verdict === 'REGIME_BARRIER');
    assert.ok(barriers.length > 0);
    for (const c of barriers) {
      assert.equal(c.distance, null);
      assert.equal(c.rank, null);
      assert.match(c.distanceNote, /regime barrier/);
    }
    assert.ok(ev.ranked.every((c) => c.verdict === 'APPLICABLE' || c.verdict === 'EXTRAPOLATION'));
    assert.ok(!canonicalJson(ev).includes('Infinity'));
  });

  it('continuous checks behind a barrier are context only', () => {
    const c = onlyCluster(ev, 'PSI-9001');
    const ctx = c.reasons.filter((x) => ['inside_range', 'outside_range', 'inside_hull', 'outside_hull'].includes(x.code));
    assert.ok(ctx.length > 0);
    for (const r of ctx) assert.equal(r.informational, true);
  });

  it('a different fuel phase is a barrier too', () => {
    const c = onlyCluster(evaluate(records, inRange), 'PSI-9002');
    assert.equal(c.verdict, 'REGIME_BARRIER');
    assert.ok(c.reasons.some((r) => r.code === 'regime_barrier' && r.axis === 'fuel_phase'));
  });

  it('two clusters in one investigation get one verdict each', () => {
    const cs = clustersOf(evaluate(records, inRange), 'PSI-9005');
    assert.equal(cs.length, 2);
    const byGravity = Object.fromEntries(cs.map((c) => [c.regime[0].values[0], c.verdict]));
    assert.deepEqual(byGravity, { microgravity: 'APPLICABLE', normal_gravity: 'REGIME_BARRIER' });
  });
});

describe('APPLICABLE', () => {
  const ev = evaluate(records, inRange);

  it('an in-range target is applicable, with every axis inside and inside the hull', () => {
    const c = onlyCluster(ev, 'PSI-9001');
    assert.equal(c.verdict, 'APPLICABLE');
    assert.ok(c.axes.every((a) => a.status === 'inside' && a.gap === 0));
    assert.equal(c.hull?.inside, true);
    assert.equal(typeof c.distance, 'number');
    assert.equal(typeof c.rank, 'number');
  });

  it('applicable clusters are ranked by distance, nearest first', () => {
    const ap = ev.ranked.filter((c) => c.verdict === 'APPLICABLE');
    assert.ok(ap.length >= 2);
    for (let i = 1; i < ap.length; i += 1) assert.ok((ap[i - 1].distance as number) <= (ap[i].distance as number));
    assert.deepEqual(
      ev.ranked.map((c) => c.rank),
      ev.ranked.map((_, i) => i + 1),
    );
  });

  it('the receipt cites the records that bound each axis', () => {
    const c = onlyCluster(ev, 'PSI-9001');
    const o2 = c.axes.find((a) => a.axis === 'o2_mole_fraction');
    assert.deepEqual(
      o2?.minCitations.map((x) => `${x.test_id}=${x.value}`),
      ['T1=0.17'],
    );
    assert.deepEqual(
      o2?.maxCitations.map((x) => `${x.test_id}=${x.value}`),
      ['T3=0.30'],
    );
  });

  it('evidence status says when unverified records were used', () => {
    assert.equal(onlyCluster(ev, 'PSI-9001').evidenceStatus, 'includes_unverified');
  });

  it('the investigation verdict comes from its best cluster', () => {
    const inv = ev.investigations.find((i) => i.accession === 'PSI-9005');
    assert.equal(inv?.verdict, 'APPLICABLE');
    assert.match(inv?.decidingCluster ?? '', /microgravity/);
  });
});

describe('EXTRAPOLATION', () => {
  it('out-of-range O2 is extrapolation and names the axis and the gap', () => {
    const c = onlyCluster(evaluate(records, micro(0.45, 90)), 'PSI-9001');
    assert.equal(c.verdict, 'EXTRAPOLATION');
    const o2 = c.axes.find((a) => a.axis === 'o2_mole_fraction');
    assert.equal(o2?.status, 'above');
    assert.ok(Math.abs((o2?.gap as number) - 0.15) < 1e-12);
    const r = c.reasons.find((x) => x.code === 'outside_range');
    assert.equal(r?.axis, 'o2_mole_fraction');
    assert.equal(r?.informational, false);
    assert.match(r?.message ?? '', /above the measured 0\.17 to 0\.3, by 0\.15/);
    assert.equal(c.axes.find((a) => a.axis === 'pressure')?.status, 'inside');
  });

  it('inside every per-axis range but outside the 2-D hull is extrapolation', () => {
    const c = onlyCluster(evaluate(records, micro(0.18, 60)), 'PSI-9001');
    assert.ok(c.axes.every((a) => a.status === 'inside'));
    assert.equal(c.hull?.inside, false);
    assert.equal(c.verdict, 'EXTRAPOLATION');
    assert.ok(c.reasons.some((r) => r.code === 'outside_hull' && !r.informational));
  });

  it('extrapolations rank after every applicable cluster', () => {
    const ev = evaluate(records, micro(0.25, 75));
    const kinds = ev.ranked.map((c) => c.verdict);
    assert.ok(kinds.includes('APPLICABLE') && kinds.includes('EXTRAPOLATION'));
    assert.equal(kinds.lastIndexOf('APPLICABLE') < kinds.indexOf('EXTRAPOLATION'), true);
  });
});

describe('INSUFFICIENT_EVIDENCE', () => {
  const ev = evaluate(records, inRange);

  it('missing O2 is insufficient evidence', () => {
    const c = onlyCluster(ev, 'PSI-9003');
    assert.equal(c.verdict, 'INSUFFICIENT_EVIDENCE');
    assert.ok(c.reasons.some((r) => r.code === 'axis_missing' && r.axis === 'o2_mole_fraction' && !r.informational));
    assert.equal(c.distance, null);
    assert.equal(c.rank, null);
  });

  it('an unstated gravity regime is insufficient evidence', () => {
    const c = onlyCluster(ev, 'PSI-9004');
    assert.equal(c.verdict, 'INSUFFICIENT_EVIDENCE');
    assert.ok(c.reasons.some((r) => r.code === 'regime_missing' && r.axis === 'gravity_regime'));
  });

  it('several O2 and pressure values with no stated pairing do not form a 2-D envelope', () => {
    const c = onlyCluster(evaluate(records, micro(0.3, 80)), 'PSI-9007');
    assert.equal(c.verdict, 'INSUFFICIENT_EVIDENCE');
    assert.ok(c.reasons.some((r) => r.code === 'unpaired_values' && !r.informational));
  });

  it('a regime axis the target states but the evidence does not is insufficient evidence', () => {
    const t: Target = { regime: { ...MICRO_SOLID_N2, flame_type: 'normal' }, continuous: { o2_mole_fraction: 0.22, pressure: 90 } };
    const ev = evaluate(records, t);
    assert.equal(onlyCluster(ev, 'PSI-9001').verdict, 'APPLICABLE');
    const c = onlyCluster(ev, 'PSI-9003');
    assert.equal(c.verdict, 'INSUFFICIENT_EVIDENCE');
    assert.ok(c.reasons.some((r) => r.code === 'regime_missing' && r.axis === 'flame_type' && !r.informational));
  });
});

describe('regime axes the target leaves open', () => {
  it('are not compared, and every verdict says so', () => {
    const t: Target = { regime: { gravity_regime: 'microgravity', fuel_phase: 'solid' }, continuous: { o2_mole_fraction: 0.22, pressure: 90 } };
    const ev = evaluate(records, t);
    assert.deepEqual(ev.openRegimeAxes, ['diluent', 'flame_type']);
    const c = onlyCluster(ev, 'PSI-9001');
    assert.equal(c.verdict, 'APPLICABLE');
    const open = c.reasons.filter((r) => r.code === 'target_regime_unstated');
    assert.deepEqual(
      open.map((r) => [r.axis, r.informational]),
      [
        ['diluent', true],
        ['flame_type', true],
      ],
    );
    assert.match(open[0].message, /left open by the target, so not compared \(evidence is N2\)/);
  });

  it('a stated flame type that differs is a barrier', () => {
    const t: Target = { regime: { ...MICRO_SOLID_N2, flame_type: 'inverse' }, continuous: { o2_mole_fraction: 0.22, pressure: 90 } };
    const c = onlyCluster(evaluate(records, t), 'PSI-9001');
    assert.equal(c.verdict, 'REGIME_BARRIER');
    assert.ok(c.reasons.some((r) => r.code === 'regime_barrier' && r.axis === 'flame_type'));
  });

  it('a barrier decides alone: a missing axis next to it is context', () => {
    const t: Target = { regime: { gravity_regime: 'partial_gravity', fuel_phase: 'solid', diluent: 'N2', flame_type: 'normal' }, continuous: { o2_mole_fraction: 0.3, pressure: 70 } };
    const c = onlyCluster(evaluate(records, t), 'PSI-9003');
    assert.equal(c.verdict, 'REGIME_BARRIER');
    const missing = c.reasons.find((r) => r.code === 'regime_missing' && r.axis === 'flame_type');
    assert.equal(missing?.informational, true);
  });
});

describe('status = insufficient_evidence never counts as evidence', () => {
  it('a flagged O2 value does not widen the envelope', () => {
    // T5 has O2 = 0.50 flagged insufficient_evidence. Counted, it would make (0.45, 101.3) applicable.
    const c = onlyCluster(evaluate(records, micro(0.45, 101.3)), 'PSI-9001');
    assert.equal(c.verdict, 'EXTRAPOLATION');
    assert.equal(c.axes.find((a) => a.axis === 'o2_mole_fraction')?.max, 0.3);
    assert.ok(c.reasons.some((r) => r.code === 'incomplete_tests' && r.message.includes('T5')));
    const flagged = c.reasons.find((r) => r.code === 'flagged_records_ignored');
    assert.ok(flagged?.citations.some((x) => x.test_id === 'T5' && x.status === 'insufficient_evidence'));
  });

  it('the same record relabeled as extracted would change the verdict (the flag is what keeps it out)', () => {
    const relabeled = records.map((r) =>
      r.status === 'insufficient_evidence' && r.accession === 'PSI-9001' ? { ...r, status: 'extracted' as const } : r,
    );
    const c = onlyCluster(evaluate(relabeled, micro(0.45, 101.3)), 'PSI-9001');
    assert.equal(c.verdict, 'APPLICABLE');
  });

  it('a flagged gravity record leaves the regime missing', () => {
    const c = onlyCluster(evaluate(records, inRange), 'PSI-9006');
    assert.equal(c.verdict, 'INSUFFICIENT_EVIDENCE');
    const r = c.reasons.find((x) => x.code === 'regime_missing');
    assert.equal(r?.citations[0].status, 'insufficient_evidence');
  });

  it('flagged records never bound an axis, a hull or a nearest point', () => {
    for (const t of [inRange, micro(0.45, 101.3), presetTarget('challenge-lunar-base')]) {
      const ev = evaluate(records, t);
      for (const c of [...ev.ranked, ...ev.unranked]) {
        const cited = [
          ...c.axes.flatMap((a) => [...a.minCitations, ...a.maxCitations]),
          ...c.reasons
            .filter((r) => !['flagged_records_ignored', 'regime_missing', 'axis_missing'].includes(r.code))
            .flatMap((r) => r.citations),
        ];
        assert.ok(
          cited.every((x) => x.status !== 'insufficient_evidence'),
          `${c.accession} ${c.clusterKey}`,
        );
      }
    }
  });

  it("minimumStatus 'verified' drops extracted records too", () => {
    const c = onlyCluster(evaluate(records, inRange, { minimumStatus: 'verified' }), 'PSI-9001');
    // T3 (O2 0.30, 70 kPa) is only extracted: without it the O2 range ends at 0.25.
    assert.equal(c.axes.find((a) => a.axis === 'o2_mole_fraction')?.max, 0.25);
    assert.equal(c.evidenceStatus, 'verified');
  });
});
