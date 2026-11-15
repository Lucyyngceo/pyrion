// Distance levels for EXTRAPOLATION. SYNTHETIC records for the exact cases; real records for the cross-checks.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  EXTRAPOLATION_LEVELS,
  EXTRAPOLATION_LEVEL_NOTE,
  EXTRAPOLATION_LEVEL_ORDER,
  REGIME_VALUES,
  bestLevel,
  evaluate,
  evidenceMap,
  levelRank,
  parseConditionCsv,
  type ConditionRecord,
  type ExtrapolationLevel,
  type Target,
} from '../src/index.ts';
import { levelSentence } from '../src/labels.ts';
import { loadConditionDir } from '../src/load.ts';
import { fixtureRecords } from './helpers.ts';

const HEAD = 'accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note';
const row = (acc: string, test: string, variable: string, value: string, unit = '') =>
  `${acc},${test},${variable},${value},${unit},${value},${unit},table,SYNTHETIC/${acc}.csv,row=0,SYNTHETIC TEST FIXTURE,verified,SYNTHETIC - not NASA data`;
function synthetic(): ConditionRecord[] {
  const L = [HEAD];
  // PSI-9701: one point (21 %, exactly 1 atm), like PSI-23.
  L.push(row('PSI-9701', '*', 'gravity_regime', 'microgravity'), row('PSI-9701', 'T1', 'o2_mole_fraction', '0.21', '1'), row('PSI-9701', 'T1', 'pressure', '101.325', 'kPa'));
  // PSI-9702: triangle (17 %, 70) (30 %, 70) (25 %, 101.325).
  L.push(row('PSI-9702', '*', 'gravity_regime', 'microgravity'));
  for (const [t, o2, p] of [['T1', '0.17', '70'], ['T2', '0.30', '70'], ['T3', '0.25', '101.325']]) L.push(row('PSI-9702', t, 'o2_mole_fraction', o2, '1'), row('PSI-9702', t, 'pressure', p, 'kPa'));
  const r = parseConditionCsv(L.join('\n'), 's.csv');
  assert.deepEqual(r.rejected, []);
  return r.records;
}
const micro = (o2: number, p: number): Target => ({ regime: { gravity_regime: 'microgravity' }, continuous: { o2_mole_fraction: o2, pressure: p } });
const inv = (recs: readonly ConditionRecord[], t: Target, acc: string) => evaluate(recs, t).investigations.find((i) => i.accession === acc)!;

describe('extrapolation levels', () => {
  const recs = synthetic();

  it('a zero-width envelope (all records at exactly 1 atm): 101.3 inside via tolerance, 110 kPa just_outside, 125 outside, 140 far_outside', () => {
    assert.equal(inv(recs, micro(0.21, 101.3), 'PSI-9701').verdict, 'APPLICABLE');
    const at = (p: number) => inv(recs, micro(0.21, p), 'PSI-9701');
    assert.equal(at(110).extrapolationLevel, 'just_outside'); // 8.6 %
    assert.equal(at(125).extrapolationLevel, 'outside'); // 23 %
    assert.equal(at(140).extrapolationLevel, 'far_outside'); // 38 %
    assert.equal(at(110).verdict, 'EXTRAPOLATION', 'the verdict itself does not change');
    assert.equal(at(101.3).extrapolationLevel, undefined, 'only EXTRAPOLATION carries a level');
  });

  it('thresholds are the exported constants (10 % and 30 % of the nearest tested value)', () => {
    assert.deepEqual({ ...EXTRAPOLATION_LEVELS }, { just_outside: 0.1, outside: 0.3 });
    const p = (rel: number) => inv(recs, micro(0.21, 101.325 * (1 + rel)), 'PSI-9701').extrapolationLevel;
    assert.equal(p(0.099), 'just_outside');
    assert.equal(p(0.101), 'outside');
    assert.equal(p(0.299), 'outside');
    assert.equal(p(0.301), 'far_outside');
  });

  it('the worst axis decides: pressure just outside but oxygen far outside is far_outside', () => {
    assert.equal(inv(recs, micro(0.21 * 1.5, 101.325 * 1.05), 'PSI-9701').extrapolationLevel, 'far_outside');
  });

  it('inside every tested range but outside the hull is "combination"', () => {
    const c = inv(recs, micro(0.17, 101.325), 'PSI-9702'); // O2 17-30 %, p 70-101.3 are both inside; the corner is not
    assert.equal(c.verdict, 'EXTRAPOLATION');
    assert.equal(c.extrapolationLevel, 'combination');
    assert.equal(inv(recs, micro(0.22, 90), 'PSI-9702').verdict, 'APPLICABLE');
  });

  it('the cluster verdict carries the level, with the plain sentence and the convention note', () => {
    const ev = evaluate(recs, micro(0.21, 110));
    const c = [...ev.ranked, ...ev.unranked].find((x) => x.accession === 'PSI-9701')!;
    assert.equal(c.extrapolationLevel, 'just_outside');
    const r = c.reasons.find((x) => x.code === 'extrapolation_level')!;
    assert.equal(r.message, 'Just outside the tested data.');
    assert.equal(r.informational, true);
    assert.ok((r.technicalNote ?? '').includes(EXTRAPOLATION_LEVEL_NOTE));
    assert.match(r.technicalNote ?? '', /Worst axis: pressure, 8\.6 % of the nearest tested value/);
    assert.equal(levelSentence('combination'), 'Inside each tested range, but this combination was not tested');
    assert.equal(levelSentence('outside'), 'Outside the tested data');
    assert.equal(levelSentence('far_outside'), 'Far outside the tested data');
    assert.match(EXTRAPOLATION_LEVEL_NOTE, /not how reliable or safe the condition is/);
  });

  it('a zero nearest-tested value does not divide by zero (axis floor)', () => {
    const L = [HEAD, row('PSI-9703', '*', 'gravity_regime', 'microgravity'), row('PSI-9703', 'T1', 'flow_velocity', '0', 'cm/s'), row('PSI-9703', 'T2', 'flow_velocity', '10', 'cm/s')];
    const r = parseConditionCsv(L.join('\n'), 's.csv').records;
    const t: Target = { regime: { gravity_regime: 'microgravity' }, continuous: { flow_velocity: 12 } };
    const level = evaluate(r, t).investigations[0].extrapolationLevel;
    assert.ok(level && EXTRAPOLATION_LEVEL_ORDER.includes(level));
    assert.ok(Number.isFinite(levelRank(level)));
  });
});

describe('monotonicity: moving the target further from the tested data never lowers the level', () => {
  const rank = (recs: readonly ConditionRecord[], t: Target, acc: string): number => {
    const i = inv(recs, t, acc);
    if (i.verdict === 'APPLICABLE') return -1;
    assert.equal(i.verdict, 'EXTRAPOLATION', `${acc} at ${JSON.stringify(t.continuous)}`);
    return levelRank(i.extrapolationLevel as ExtrapolationLevel);
  };
  it('along pressure and along oxygen, away from a one-point envelope and from a triangle', () => {
    const recs = synthetic();
    const ps = [101.325, 104, 108, 111, 120, 131, 140, 200, 400];
    const os = [0.21, 0.215, 0.23, 0.24, 0.27, 0.3, 0.4, 0.6];
    for (const acc of ['PSI-9701', 'PSI-9702']) {
      const base = acc === 'PSI-9701' ? 0.21 : 0.25;
      let prev = -2;
      for (const p of ps) {
        const r = rank(recs, micro(base, p), acc);
        assert.ok(r >= prev, `${acc} pressure ${p}: ${r} < ${prev}`);
        prev = r;
      }
      prev = -2;
      for (const o of os.map((x) => x + (acc === 'PSI-9702' ? 0.09 : 0))) {
        const r = rank(recs, micro(o, acc === 'PSI-9701' ? 101.325 : 101.325), acc);
        assert.ok(r >= prev, `${acc} oxygen ${o}: ${r} < ${prev}`);
        prev = r;
      }
    }
  });
  it('along rays leaving the hull of the synthetic fixtures (random directions)', () => {
    const recs = fixtureRecords();
    let s = 99;
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const regime: Target['regime'] = { gravity_regime: 'microgravity', fuel_phase: 'solid', diluent: 'N2' };
    for (let k = 0; k < 15; k += 1) {
      const angle = rnd() * 2 * Math.PI;
      let prev = -2;
      for (let step = 0; step <= 12; step += 1) {
        const o2 = Math.min(0.99, Math.max(0.01, 0.22 + Math.cos(angle) * 0.03 * step));
        const p = Math.max(1, 85 + Math.sin(angle) * 8 * step);
        const i = inv(recs, { regime, continuous: { o2_mole_fraction: o2, pressure: p } }, 'PSI-9001');
        const r = i.verdict === 'APPLICABLE' ? -1 : i.verdict === 'EXTRAPOLATION' ? levelRank(i.extrapolationLevel as ExtrapolationLevel) : null;
        if (r === null) continue;
        assert.ok(r >= prev, `ray ${k} step ${step}: ${r} < ${prev}`);
        prev = r;
      }
    }
  });
});

describe('evidenceMap levels equal evaluate()', () => {
  function check(label: string, recs: readonly ConditionRecord[], seed: number) {
    let s = seed;
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    let checked = 0;
    while (checked < 200) {
      const regime: Target['regime'] = {};
      for (const a of ['gravity_regime', 'fuel_phase', 'diluent', 'flame_type'] as const) if (rnd() < 0.4) regime[a] = REGIME_VALUES[a][Math.floor(rnd() * REGIME_VALUES[a].length)];
      const map = evidenceMap(recs, regime, { o2: [0.05, 0.6, 12], pressure: [10, 150, 15] });
      for (let k = 0; k < 20; k += 1) {
        const cell = map.cells[Math.floor(rnd() * map.cells.length)];
        const ev = evaluate(recs, { regime, continuous: { o2_mole_fraction: cell.o2, pressure: cell.pressure } });
        const expected = bestLevel(ev.investigations.filter((i) => i.verdict === 'EXTRAPOLATION').map((i) => i.extrapolationLevel));
        assert.equal(cell.extrapolationLevel, expected, `${label} ${JSON.stringify(regime)} o2=${cell.o2} p=${cell.pressure}`);
        if (cell.extrapolation.length === 0) assert.equal(cell.extrapolationLevel, undefined);
        checked += 1;
      }
    }
  }
  it('200+ random cells on the fixtures', () => check('fixtures', fixtureRecords(), 5));
  const dir = join(import.meta.dirname, '..', '..', 'data', 'conditions');
  if (existsSync(dir)) {
    const real = loadConditionDir(dir).records;
    it('200+ random cells on the real records', () => check('real', real, 6));
    it('real records: microgravity air at 21 % oxygen: 60 % O2 at 20 kPa is not "just outside"', () => {
      const m = evidenceMap(real, { gravity_regime: 'microgravity' }, { o2: [0.21, 0.6, 2], pressure: [20, 101.325, 2] });
      const far = m.cells.find((c) => c.o2 === 0.6 && c.pressure === 20)!;
      assert.ok(far.extrapolationLevel === undefined || levelRank(far.extrapolationLevel) >= levelRank('just_outside'));
      const air = m.cells.find((c) => c.o2 === 0.21 && c.pressure === 101.325)!;
      assert.ok(air.applicable.length > 0);
    });
  }
});
