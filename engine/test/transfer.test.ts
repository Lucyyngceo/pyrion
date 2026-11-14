// TRANSFER_HYPOTHESIS. Test inputs below are SYNTHETIC (invented to exercise the rules, not NASA data),
// except the one check that reads the real derived table when it exists.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { canonicalJson, evaluate, presetTarget } from '../src/index.ts';
import { GRAVITY_TARGETS, TRANSFER_LIMITS, transferHypotheses, transferTestsFromFlowSteps, withGravity, type TransferTest } from '../src/transfer.ts';
import { fixtureRecords } from './helpers.ts';

// SYNTHETIC rod tests, accession PSI-9101 (does not exist in PSI). R = 3.175 mm = 0.3175 cm.
const synth = (test_id: string, flow: { lo: number; hi: number }, extra: Partial<TransferTest> = {}): TransferTest => ({
  accession: 'PSI-9101',
  test_id,
  gravity_regime: 'microgravity',
  material: 'SYNTHETIC PMMA rod',
  geometry: 'rod_tip',
  geometryBasis: 'SYNTHETIC',
  radiusCm: 0.3175,
  flowCmS: flow,
  regime: {},
  o2_mole_fraction: 0.21,
  inputRecords: [{ file: 'SYNTHETIC/PSI-9101-fixture.csv', location: `test ${test_id}`, note: 'SYNTHETIC TEST FIXTURE - not NASA data' }],
  ...extra,
});

const moon = withGravity(presetTarget('challenge-lunar-base'), 'moon');
const earth = withGravity(presetTarget('challenge-lunar-base'), 'earth');

describe('TRANSFER_HYPOTHESIS', () => {
  it('a test whose stretch rate falls inside the Moon band is a candidate; one far outside is not', () => {
    const r = transferHypotheses(moon, [synth('IN', { lo: 3.9, hi: 3.9 }), synth('OUT', { lo: 10, hi: 10 }), synth('PART', { lo: 3, hi: 5 })]);
    const by = Object.fromEntries(r.hypotheses.map((h) => [h.test_id, h]));
    assert.equal(by.IN.relation, 'within');
    assert.equal(by.OUT.relation, 'outside');
    assert.equal(by.PART.relation, 'overlap');
    assert.equal(by.IN.isAnalog, true);
    assert.equal(by.OUT.isAnalog, false);
    assert.equal(by.PART.isAnalog, false);
    assert.match(by.OUT.blockers[0], /outside the target band/);
  });

  it('the same test is not in the Earth band: a bigger gravity needs a bigger flow', () => {
    const r = transferHypotheses(earth, [synth('IN', { lo: 3.9, hi: 3.9 }), synth('E', { lo: 9.7, hi: 9.7 })]);
    const by = Object.fromEntries(r.hypotheses.map((h) => [h.test_id, h.relation]));
    assert.deepEqual(by, { E: 'within', IN: 'outside' });
  });

  it('never counts as evidence or as APPLICABLE, and each result carries formula, sources, inputs and the spec limits', () => {
    const r = transferHypotheses(moon, [synth('IN', { lo: 3.9, hi: 3.9 })]);
    const h = r.hypotheses[0];
    assert.equal(h.kind, 'TRANSFER_HYPOTHESIS');
    assert.equal(h.evidenceClass, 'hypothesis');
    assert.equal(h.countsAsApplicable, false);
    assert.equal(h.testStretch.formulaId, 'OF2015-af-rod-tip');
    assert.equal(h.targetStretch.formulaId, 'OT2000-ab-eq1');
    assert.ok(h.sources.some((s) => s.page === 11) && h.sources.some((s) => s.page === 7));
    assert.ok(h.sources.some((s) => s.quote === 'Lunar-g = 0.165 gE'));
    assert.deepEqual(h.inputRecords[0].file, 'SYNTHETIC/PSI-9101-fixture.csv');
    assert.equal(h.limits, TRANSFER_LIMITS);
    assert.equal(h.limits.length, 5);
    assert.ok(h.targetStretch.value.lo < h.targetStretch.value.hi, 'the target stretch is a band');
  });

  it('is reported in addition to REGIME_BARRIER: evaluate() is untouched by it', () => {
    const records = fixtureRecords();
    const before = canonicalJson(evaluate(records, moon));
    transferHypotheses(moon, [synth('IN', { lo: 3.9, hi: 3.9 })]);
    assert.equal(canonicalJson(evaluate(records, moon)), before);
    const ev = evaluate(records, moon);
    assert.ok(ev.unranked.some((c) => c.verdict === 'REGIME_BARRIER'));
    assert.ok(ev.ranked.every((c) => c.verdict !== ('TRANSFER_HYPOTHESIS' as never)));
  });

  it('only microgravity tests with a stated regime are used', () => {
    const r = transferHypotheses(moon, [synth('A', { lo: 4, hi: 4 }, { gravity_regime: undefined }), synth('B', { lo: 4, hi: 4 }, { gravity_regime: 'normal_gravity' })]);
    assert.equal(r.hypotheses.length, 0);
    assert.match(r.excluded[0].reason, /not stated/);
    assert.match(r.excluded[1].reason, /not microgravity/);
  });

  it('a microgravity target has nothing to transfer; a target without gravity_level is not computable', () => {
    const micro = { regime: { gravity_regime: 'microgravity' as const }, continuous: {} };
    assert.match(transferHypotheses(micro, [synth('A', { lo: 4, hi: 4 })]).notComputable ?? '', /nothing to transfer/);
    assert.match(transferHypotheses({ regime: { gravity_regime: 'partial_gravity' }, continuous: {} }, []).notComputable ?? '', /gravity_level/);
  });

  it('a material other than PMMA needs a density factor from the caller; the source gives none', () => {
    const t = synth('N', { lo: 4, hi: 4 }, { material: 'Nomex rod' });
    assert.match(transferHypotheses(moon, [t]).excluded[0].reason, /no density factor/);
    assert.equal(transferHypotheses(moon, [t], { densityFactor: { lo: 0.6, hi: 0.7 } }).hypotheses.length, 1);
  });

  it('a regime axis stated by the target and different or unknown for the test blocks the analog', () => {
    const t = { ...moon, regime: { ...moon.regime, fuel_phase: 'solid', diluent: 'N2' } };
    const r = transferHypotheses(t, [synth('A', { lo: 3.9, hi: 3.9 }, { regime: { fuel_phase: 'solid', diluent: 'He' } }), synth('B', { lo: 3.9, hi: 3.9 })]);
    const by = Object.fromEntries(r.hypotheses.map((h) => [h.test_id, h]));
    assert.equal(by.A.relation, 'within');
    assert.equal(by.A.isAnalog, false);
    assert.ok(by.A.blockers.some((b) => b.startsWith('diluent')));
    assert.ok(by.B.blockers.some((b) => b.includes('not stated for the test')));
  });

  it('reports the atmosphere difference but does not gate on it', () => {
    const h = transferHypotheses(moon, [synth('A', { lo: 3.9, hi: 3.9 }, { o2_mole_fraction: 0.2 })]).hypotheses[0];
    assert.ok(Math.abs((h.atmosphere.o2_mole_fraction.difference as number) - 0.1) < 1e-12);
    assert.equal(h.atmosphere.pressure_kpa.test, null);
    assert.equal(h.isAnalog, true);
  });

  it('is deterministic and independent of test order', () => {
    const ts = [synth('T2', { lo: 3.9, hi: 3.9 }), synth('T10', { lo: 10, hi: 10 }), synth('T1', { lo: 3, hi: 5 })];
    const a = canonicalJson(transferHypotheses(moon, ts));
    assert.equal(canonicalJson(transferHypotheses(moon, [...ts].reverse())), a);
    assert.deepEqual(transferHypotheses(moon, ts).hypotheses.map((h) => h.test_id), ['T1', 'T2', 'T10']);
  });

  it('Mars is 1/3 g with the source quote, not 0.38', () => {
    const m = GRAVITY_TARGETS.mars;
    assert.equal(m.level, 1 / 3);
    assert.ok('quote' in m.source && m.source.quote.includes('Mars (1/3 g)') && m.source.page === 3);
  });
});

describe('derived flow-steps table adapter', () => {
  const HEADER = 'accession,test_id,material,geometry_class,size_original,sample_radius_mm,radius_basis,o2_initial,o2_final,flow_steps,flow_unit,flow_unit_source,flow_min_with_flame,ended_in_extinction,cell_mentions_extinction,parse_status,parse_reason,air_display_original,source_file,source_row';
  // SYNTHETIC rows with the real column names.
  const row = (id: string, geo: string, radius: string, flow: string, status = 'ok') =>
    `PSI-9102,${id},SYNTHETIC PMMA,${geo},SYNTHETIC,${radius},"SYNTHETIC basis",0.21,0.2,${flow},cm/s,SYNTHETIC,,false,false,${status},,${flow},SYNTHETIC/x.csv,${id.slice(1)}`;
  const csv = [HEADER, row('R1', 'rod', '3.175', '5 3 2'), row('R2', 'rod', '', '5'), row('R3', 'film', '', '5'), row('R4', 'rod', '3.175', '5 3', 'ambiguous')].join('\n');

  it('keeps rods with a radius and parsed flow; says why it skipped the others', () => {
    const { tests, skipped } = transferTestsFromFlowSteps(csv, { gravityRegime: 'microgravity' });
    assert.equal(tests.length, 1);
    assert.deepEqual(tests[0].flowCmS, { lo: 2, hi: 5 });
    assert.equal(tests[0].radiusCm, 0.3175);
    assert.equal(tests[0].geometry, 'rod_tip');
    assert.deepEqual(skipped.map((s) => s.test_id), ['R2', 'R3', 'R4']);
    assert.match(skipped[0].reason, /without a stated radius/);
    assert.match(skipped[1].reason, /no sample radius/);
  });

  it('without a stated gravity regime the tests are listed but never used', () => {
    const { tests } = transferTestsFromFlowSteps(csv);
    const r = transferHypotheses(moon, tests);
    assert.equal(r.hypotheses.length, 0);
    assert.match(r.excluded[0].reason, /not stated/);
  });

  it('the rod formula is an explicit choice', () => {
    assert.equal(transferTestsFromFlowSteps(csv, { rodFormula: 'cylinder' }).tests[0].geometry, 'cylinder');
  });

  it('a table without the expected columns is refused, not guessed', () => {
    assert.throws(() => transferTestsFromFlowSteps('a,b\n1,2\n'), /lacks column/);
  });

  it('reads the real derived table when present: every test has a radius and a flow band', () => {
    const file = join(import.meta.dirname, '..', '..', 'data', 'derived', 'bass2_flow_steps.csv');
    if (!existsSync(file)) return;
    const { tests } = transferTestsFromFlowSteps(readFileSync(file, 'utf8'));
    assert.ok(tests.length > 0);
    for (const t of tests) {
      assert.ok(t.radiusCm > 0 && t.flowCmS.lo >= 0 && t.flowCmS.hi >= t.flowCmS.lo);
      assert.equal(t.accession, 'PSI-25');
    }
  });
});
