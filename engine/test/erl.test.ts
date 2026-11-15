// ERL: a relabelling of the engine's verdicts. Synthetic fixtures plus the real records when they are present.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ERL_NOTE, ERL_OF_EXTRAPOLATION, ERL_SCALE, erlBoard, erlFor, erlOfVerdict, evaluate, materialsOf, presetTarget, recordsForMaterial, type Target } from '../src/index.ts';
import { loadConditionDir } from '../src/load.ts';
import { MICRO_SOLID_N2, fixtureRecords } from './helpers.ts';

const records = fixtureRecords();
const micro = (o2: number, pressure: number): Target => ({ regime: { ...MICRO_SOLID_N2 }, continuous: { o2_mole_fraction: o2, pressure } });
const REAL = join(import.meta.dirname, '..', '..', 'data', 'conditions');

describe('ERL scale and mapping', () => {
  it('has five levels, 4 down to 0, and the PYRION-convention note', () => {
    assert.deepEqual(ERL_SCALE.map((s) => s.level), [4, 3, 2, 1, 0]);
    assert.match(ERL_NOTE, /PYRION convention, like NASA's TRL, for evidence/);
    assert.match(ERL_NOTE, /never safety/);
  });

  it('maps verdicts and extrapolation levels', () => {
    assert.equal(erlOfVerdict('APPLICABLE'), 4);
    assert.equal(erlOfVerdict('EXTRAPOLATION', 'just_outside'), 3);
    assert.equal(erlOfVerdict('EXTRAPOLATION', 'combination'), 3);
    assert.equal(erlOfVerdict('EXTRAPOLATION', 'outside'), 2);
    assert.equal(erlOfVerdict('EXTRAPOLATION', 'far_outside'), 2);
    assert.equal(erlOfVerdict('REGIME_BARRIER'), 1);
    assert.equal(erlOfVerdict('INSUFFICIENT_EVIDENCE'), null);
    assert.deepEqual(Object.keys(ERL_OF_EXTRAPOLATION).sort(), ['combination', 'far_outside', 'just_outside', 'outside']);
  });
});

describe('erlFor on the synthetic fixtures', () => {
  it('a condition inside tested data is ERL 4, and agrees with evaluate()', () => {
    const t = micro(0.22, 90);
    const e = erlFor(records, t);
    const ev = evaluate(records, t);
    assert.equal(ev.counts.investigations.APPLICABLE > 0, true);
    assert.equal(e.level, 4);
    assert.equal(e.name, 'inside the tested-point envelope');
    assert.equal(e.perInvestigation.length, ev.investigations.length);
    assert.ok(e.perInvestigation.every((p) => p.level === (p.verdict === 'APPLICABLE' ? 4 : p.level)));
    assert.equal(e.note, ERL_NOTE);
  });

  it('the level never exceeds what the verdicts give: no APPLICABLE means at most 3', () => {
    for (const [o2, p] of [[0.4, 90], [0.9, 10], [0.22, 500], [0.3, 40]] as const) {
      const t = micro(o2, p);
      const e = erlFor(records, t);
      const ev = evaluate(records, t);
      if (ev.counts.investigations.APPLICABLE === 0) assert.ok(e.level <= 3, `${o2},${p}`);
    }
  });

  it('a gravity regime nobody tested is ERL 0 with the reason', () => {
    const e = erlFor(records, { regime: { gravity_regime: 'partial_gravity' }, continuous: { o2_mole_fraction: 0.3, pressure: 70 } });
    assert.equal(e.level, 0);
    assert.match(e.reason, /No PSI test in partial gravity anywhere/);
  });

  it('comparable only in another regime is ERL 1', () => {
    const t: Target = { regime: { gravity_regime: 'normal_gravity', fuel_phase: 'liquid' }, continuous: { o2_mole_fraction: 0.22, pressure: 90 } };
    assert.equal(evaluate(records, t).counts.investigations.REGIME_BARRIER, 7);
    const e = erlFor(records, t);
    assert.equal(e.level, 1);
    assert.equal(e.name, 'different regime');
    assert.match(e.reason, /another regime/);
  });

  it('an extrapolation gives ERL 3 or 2 by its level, never 4', () => {
    const t: Target = { regime: { gravity_regime: 'normal_gravity', fuel_phase: 'solid' }, continuous: { o2_mole_fraction: 0.22, pressure: 90 } };
    const ev = evaluate(records, t);
    assert.equal(ev.counts.investigations.APPLICABLE, 0);
    const e = erlFor(records, t);
    const lvl = ev.investigations.find((i) => i.verdict === 'EXTRAPOLATION')?.extrapolationLevel;
    assert.equal(e.level, ERL_OF_EXTRAPOLATION[lvl ?? 'far_outside']);
    assert.ok(e.level === 2 || e.level === 3);
  });

  it('is deterministic', () => {
    assert.equal(JSON.stringify(erlFor(records, micro(0.22, 90))), JSON.stringify(erlFor(records, micro(0.22, 90))));
  });
});

describe('erlBoard', () => {
  const habitats = [
    { id: 'air', label: 'air', target: micro(0.22, 90) },
    { id: 'far', label: 'far', target: micro(0.9, 10) },
  ];

  it('one cell per habitat x material, with an any-material column', () => {
    const mats = materialsOf(records);
    const b = erlBoard(records, habitats);
    assert.equal(b.materials[0], null);
    assert.equal(b.cells.length, habitats.length * (mats.length + 1));
    assert.ok(b.cells.every((c) => c.level >= 0 && c.level <= 4));
    assert.equal(b.note, ERL_NOTE);
  });

  it('a material no investigation states is ERL 0, never a guess', () => {
    const b = erlBoard(records, habitats, ['Unobtainium']);
    const cell = b.cells.find((c) => c.material === 'Unobtainium' && c.habitat === 'air');
    assert.equal(cell?.level, 0);
    assert.match(cell?.reason ?? '', /No investigation in the extracted records states the material "Unobtainium"/);
  });

  it('a material column uses only the investigations that state that material', () => {
    const mats = materialsOf(records);
    if (mats.length === 0) return;
    const sub = recordsForMaterial(records, mats[0]);
    assert.ok(sub.length > 0 && sub.length <= records.length);
    const cell = erlBoard(records, habitats, [mats[0]]).cells.find((c) => c.material === mats[0] && c.habitat === 'air');
    assert.equal(cell?.level, erlFor(sub, habitats[0].target).level);
  });

  it('legs override the gravity of the habitat target', () => {
    const b = erlBoard(records, [habitats[0]], undefined, [
      { id: 'transit', label: 'transit', gravity_regime: 'microgravity' },
      { id: 'surface', label: 'surface', gravity_regime: 'partial_gravity', gravity_level: 0.16 },
    ]);
    const any = (leg: string) => b.cells.find((c) => c.leg === leg && c.material === null);
    assert.equal(any('surface')?.level, 0);
    assert.ok((any('transit')?.level ?? 0) >= 1);
  });
});

describe('ERL on the real records', { skip: !existsSync(REAL) }, () => {
  const real = existsSync(REAL) ? loadConditionDir(REAL).records : [];
  it('every Moon preset is ERL 0: no PSI test in partial gravity anywhere', () => {
    for (const id of ['challenge-lunar-base', 'nesc-10.2psia-26.5o2-lunar', 'nesc-8.2psia-34o2-lunar']) {
      const e = erlFor(real, presetTarget(id));
      assert.equal(e.level, 0, id);
      assert.match(e.reason, /partial gravity/);
    }
  });
});

describe('recordsForMaterial keeps only the tests that state the material', () => {
  const rec = (test_id: string, variable: string, value: string) =>
    ({ accession: 'PSI-1', test_id, variable, value, unit: '', status: 'extracted', source_file: 'x', source_location: 'x', quote: 'x' }) as never;
  const records = [
    rec('T1', 'material', 'rod A'),
    rec('T1', 'o2_mole_fraction', '0.21'),
    rec('T2', 'material', 'film B'),
    rec('T2', 'o2_mole_fraction', '0.40'),
    rec('*', 'gravity_regime', 'microgravity'),
  ];
  it('drops the other material of the same investigation and keeps investigation-wide records', () => {
    const r = recordsForMaterial(records, 'rod A') as unknown as { test_id: string; value: string }[];
    assert.deepEqual(r.map((x) => `${x.test_id}:${x.value}`).sort(), ['*:microgravity', 'T1:0.21', 'T1:rod A']);
  });
});
