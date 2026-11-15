// evidenceMap (NAVIGATOR N2): every cell equals evaluate(); fast on the real records.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { REGIME_VALUES, canonicalJson, evaluate, evidenceMap, type ConditionRecord, type Target } from '../src/index.ts';
import { loadConditionDir } from '../src/load.ts';
import { fixtureRecords } from './helpers.ts';

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const randomRegime = (rnd: () => number): Target['regime'] => {
  const r: Target['regime'] = {};
  for (const axis of ['gravity_regime', 'fuel_phase', 'diluent', 'flame_type'] as const) {
    if (rnd() < 0.5) r[axis] = REGIME_VALUES[axis][Math.floor(rnd() * REGIME_VALUES[axis].length)];
  }
  return r;
};

function compareWithEvaluate(label: string, recs: readonly ConditionRecord[], seed: number) {
  const rnd = lcg(seed);
  let cellsChecked = 0;
  while (cellsChecked < 200) {
    const regime = randomRegime(rnd);
    const grid = { o2: [0.05, 0.6, 12] as const, pressure: [10, 150, 15] as const };
    const map = evidenceMap(recs, regime, grid);
    assert.equal(map.cells.length, 12 * 15);
    for (let k = 0; k < 20; k += 1) {
      const cell = map.cells[Math.floor(rnd() * map.cells.length)];
      const ev = evaluate(recs, { regime, continuous: { o2_mole_fraction: cell.o2, pressure: cell.pressure } });
      const app = ev.investigations.filter((i) => i.verdict === 'APPLICABLE').map((i) => i.accession);
      const ext = ev.investigations.filter((i) => i.verdict === 'EXTRAPOLATION').map((i) => i.accession);
      assert.deepEqual(cell.applicable, app, `${label} ${canonicalJson(regime)} o2=${cell.o2} p=${cell.pressure}`);
      assert.deepEqual(cell.extrapolation, ext, `${label} ${canonicalJson(regime)} o2=${cell.o2} p=${cell.pressure} (extrapolation)`);
      cellsChecked += 1;
    }
  }
}

describe('evidenceMap equals evaluate()', () => {
  it('200+ random cells on the synthetic fixtures', () => compareWithEvaluate('fixtures', fixtureRecords(), 1));
  const dir = join(import.meta.dirname, '..', '..', 'data', 'conditions');
  const real = existsSync(dir) ? loadConditionDir(dir).records : null;
  if (real) it('200+ random cells on the real records', () => compareWithEvaluate('real', real, 2));
  it('cells that sit exactly on a measured point or within the tolerance of one are APPLICABLE like evaluate()', () => {
    const recs = fixtureRecords();
    const regime = { gravity_regime: 'microgravity', fuel_phase: 'solid', diluent: 'N2' };
    const map = evidenceMap(recs, regime, { o2: [0.17, 0.3, 14], pressure: [70, 101.3, 12] });
    for (const cell of map.cells) {
      const ev = evaluate(recs, { regime, continuous: { o2_mole_fraction: cell.o2, pressure: cell.pressure } });
      assert.deepEqual(cell.applicable, ev.investigations.filter((i) => i.verdict === 'APPLICABLE').map((i) => i.accession));
    }
  });
});

describe('evidenceMap shape and limits', () => {
  it('grid values run from min to max inclusive, row-major with pressure outer', () => {
    const m = evidenceMap(fixtureRecords(), {}, { o2: [0.1, 0.5, 5], pressure: [20, 100, 3] });
    assert.deepEqual(m.o2Values, [0.1, 0.2, 0.30000000000000004, 0.4, 0.5].map((x, i, a) => (i === a.length - 1 ? 0.5 : x)));
    assert.deepEqual(m.pressureValues, [20, 60, 100]);
    assert.deepEqual([m.cells[0].o2, m.cells[0].pressure], [0.1, 20]);
    assert.deepEqual([m.cells[5].o2, m.cells[5].pressure], [0.1, 60]);
    assert.ok(m.maxApplicable >= 0 && m.maxExtrapolation >= 0);
  });
  it('n = 1 gives a single value; bad grids are refused', () => {
    assert.deepEqual(evidenceMap(fixtureRecords(), {}, { o2: [0.21, 0.5, 1], pressure: [101.3, 200, 1] }).cells.length, 1);
    assert.throws(() => evidenceMap(fixtureRecords(), {}, { o2: [0.5, 0.1, 5], pressure: [1, 2, 2] }), RangeError);
    assert.throws(() => evidenceMap(fixtureRecords(), {}, { o2: [0.1, 0.5, 0], pressure: [1, 2, 2] }), RangeError);
    assert.throws(() => evidenceMap(fixtureRecords(), { gravity_regime: 'moonlight' }, { o2: [0.1, 0.5, 2], pressure: [1, 2, 2] }), TypeError);
  });
  it('is deterministic and independent of record order', () => {
    const recs = fixtureRecords();
    const g = { o2: [0.05, 0.6, 8] as const, pressure: [10, 150, 8] as const };
    assert.equal(canonicalJson(evidenceMap(recs, { gravity_regime: 'microgravity' }, g)), canonicalJson(evidenceMap([...recs].reverse(), { gravity_regime: 'microgravity' }, g)));
  });
  const dir = join(import.meta.dirname, '..', '..', 'data', 'conditions');
  if (existsSync(dir)) {
    it('60 x 60 on the real records takes under 150 ms (hulls built once)', () => {
      const recs = loadConditionDir(dir).records;
      const g = { o2: [0.05, 0.6, 60] as const, pressure: [10, 150, 60] as const };
      evidenceMap(recs, { gravity_regime: 'microgravity' }, g); // warm-up (JIT)
      const t0 = performance.now();
      const m = evidenceMap(recs, { gravity_regime: 'microgravity' }, g);
      const ms = performance.now() - t0;
      assert.equal(m.cells.length, 3600);
      assert.ok(ms < 150, `took ${ms.toFixed(1)} ms`);
    });
  }
});
