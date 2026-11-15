// Mission planner: bands, coverage, hypothetical experiments, minimum test set, ranking. Synthetic fixtures and the real records.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  KPA_PER_PSI,
  MOON_BASE_BAND,
  SOURCES,
  bandIsConvex,
  candidateFromPoints,
  coverage,
  coverageGained,
  fm2Hypothetical,
  luciHypothetical,
  minimumTestSet,
  rankExperiments,
  type DesignBand,
} from '../src/index.ts';
import { loadConditionDir } from '../src/load.ts';
import { fixtureRecords } from './helpers.ts';

const fixtures = fixtureRecords();
const REAL = join(import.meta.dirname, '..', '..', 'data', 'conditions');
const vertexPoints = MOON_BASE_BAND.vertices.map((v) => ({ o2_mole_fraction: v.o2_mole_fraction, pressure_kpa: v.pressure_kpa }));

describe('the Moon Base design band', () => {
  it('is built from sourced vertices, each with its source, and says how it is closed', () => {
    const b = MOON_BASE_BAND;
    const sourced = b.vertices.filter((v) => v.sourced);
    assert.equal(sourced.length, 2);
    for (const v of sourced) {
      assert.equal(v.source, SOURCES.nescSurface);
      assert.match(v.source?.quote ?? '', /10\.2 psia\/26\.5% O2 and 8\.2 psia\/34% O2/);
    }
    assert.equal(b.edgePoints[0].source, SOURCES.challenge);
    assert.match(b.edgePoints[0].source?.quote ?? '', /30% or greater, with a corresponding pressure of 10\.2 psi or less/);
    assert.match(b.closure, /Bounding rectangle of the two NESC Exploration Atmospheres/);
    assert.match(b.convention, /PYRION convention/);
    assert.match(b.convention, /not stated by any source/);
  });

  it('uses the preset numbers (26.5 and 34 % O2; 8.2 and 10.2 psia in kPa) and lunar partial gravity', () => {
    const vs = MOON_BASE_BAND.vertices;
    assert.deepEqual([...new Set(vs.map((v) => v.o2_mole_fraction))].sort(), [0.265, 0.34]);
    assert.deepEqual([...new Set(vs.map((v) => v.pressure_kpa))].sort((a, b) => a - b), [8.2 * KPA_PER_PSI, 10.2 * KPA_PER_PSI]);
    assert.equal(MOON_BASE_BAND.gravity.regime, 'partial_gravity');
    assert.equal(MOON_BASE_BAND.gravity.source, SOURCES.lunarGravity);
  });

  it('the challenge corner (30 % O2 at 10.2 psi) lies on the top edge of the polygon', () => {
    const c = MOON_BASE_BAND.edgePoints[0];
    const top = MOON_BASE_BAND.vertices.filter((v) => v.pressure_kpa === c.pressure_kpa);
    assert.equal(top.length, 2);
    assert.ok(c.o2_mole_fraction > Math.min(...top.map((v) => v.o2_mole_fraction)) && c.o2_mole_fraction < Math.max(...top.map((v) => v.o2_mole_fraction)));
    assert.equal(bandIsConvex(MOON_BASE_BAND), true);
  });
});

describe('coverage', () => {
  it('today PSI covers 0 % of the band (fixtures)', () => {
    const c = coverage(fixtures, MOON_BASE_BAND);
    assert.equal(c.total, 81);
    assert.equal(c.covered, 0);
    assert.equal(c.fraction, 0);
    assert.deepEqual(c.investigations, []);
  });

  it('a candidate that tests the four vertices covers the whole band, for its fuel phase only', () => {
    const cand = candidateFromPoints('corners', 'four corners', vertexPoints, { fuelPhase: 'solid' });
    const all = coverage(fixtures, MOON_BASE_BAND, { extraRecords: cand.records });
    assert.equal(all.fraction, 1);
    assert.equal(coverage(fixtures, MOON_BASE_BAND, { extraRecords: cand.records, fuelPhase: 'solid' }).fraction, 1);
    assert.equal(coverage(fixtures, MOON_BASE_BAND, { extraRecords: cand.records, fuelPhase: 'liquid' }).fraction, 0);
  });

  it('only the grid inside the band counts, and the grid size is respected', () => {
    const c = coverage(fixtures, MOON_BASE_BAND, { grid: { o2: 3, pressure: 5 } });
    assert.equal(c.total, 15);
    assert.deepEqual(c.grid, { o2: 3, pressure: 5 });
    const corner = c.cells.find((x) => x.o2_mole_fraction === 0.265 && Math.abs(x.pressure_kpa - 8.2 * KPA_PER_PSI) < 1e-6);
    assert.ok(corner, 'band corners are grid cells');
  });

  it('a non-convex band is refused', () => {
    const bad: DesignBand = { ...MOON_BASE_BAND, id: 'bad', vertices: [MOON_BASE_BAND.vertices[0], MOON_BASE_BAND.vertices[1], { ...MOON_BASE_BAND.vertices[2], o2_mole_fraction: 0.3, pressure_kpa: 62 }, MOON_BASE_BAND.vertices[3]] };
    assert.equal(bandIsConvex(bad), false);
    assert.throws(() => coverage(fixtures, bad), /not convex/);
  });

  it('is deterministic', () => {
    assert.equal(JSON.stringify(coverage(fixtures, MOON_BASE_BAND)), JSON.stringify(coverage(fixtures, MOON_BASE_BAND)));
  });
});

describe('hypothetical FM2 and LUCI', () => {
  it('FM2 as planned: four tests at one pressure, a LINE, flagged, one fabric, nothing written', () => {
    const f = fm2Hypothetical();
    assert.equal(f.hypothetical, true);
    assert.match(f.flag, /HYPOTHETICAL/);
    assert.equal(f.tests, 4);
    assert.deepEqual(f.points.map((p) => p.o2_mole_fraction), [0.37, 0.33, 0.29, 0.25]);
    assert.ok(f.points.every((p) => p.pressure_kpa === 8.2 * KPA_PER_PSI));
    assert.equal(f.shape, 'line');
    assert.match(f.material ?? '', /Synergy Pro "Navy"/);
    assert.ok(f.records.length > 0 && f.records.every((r) => r.accession === 'HYPO-FM2' && r.note.startsWith('HYPOTHETICAL') && r.source_file.startsWith('HYPOTHETICAL/') && r.origin.file === 'hypothetical'));
    assert.ok(f.sources.some((s) => s.id === 'fm2-conditions' && s.page === 10));
  });

  it('FM2 covers only the bottom edge of the band: a line (9 of 81 cells, zero area)', () => {
    const g = coverageGained(fixtures, MOON_BASE_BAND, fm2Hypothetical());
    assert.equal(g.shape, 'line');
    assert.equal(g.cellsGained, 9);
    assert.equal(g.withFraction, 9 / 81);
    assert.equal(g.hullAreaFraction, 0);
    assert.match(g.note, /no area/);
    const cov = coverage(fixtures, MOON_BASE_BAND, { extraRecords: fm2Hypothetical().records, fuelPhase: 'solid' });
    assert.ok(cov.cells.filter((c) => c.covered).every((c) => Math.abs(c.pressure_kpa - 8.2 * KPA_PER_PSI) < 1e-6), 'every covered cell is on the 8.2 psia line');
  });

  it('FM2 is solid fuel only: for liquid it adds nothing', () => {
    assert.equal(coverage(fixtures, MOON_BASE_BAND, { extraRecords: fm2Hypothetical().records, fuelPhase: 'liquid' }).covered, 0);
  });

  it('the tolerance what-if (7.9 and 8.5 psia) spans an area, reported apart as optimistic', () => {
    const t = fm2Hypothetical({ withToleranceBounds: true });
    assert.equal(t.shape, 'area');
    assert.equal(t.tests, 8);
    assert.match(t.reason, /not eight tests/);
    const g = coverageGained(fixtures, MOON_BASE_BAND, t);
    assert.ok(g.hullAreaFraction > 0 && g.hullAreaFraction < 0.5);
    assert.ok(g.cellsGained > coverageGained(fixtures, MOON_BASE_BAND, fm2Hypothetical()).cellsGained);
  });

  it('LUCI cannot be placed: no pressure figure, so no records and no coverage; the reason says it does not guess', () => {
    const l = luciHypothetical();
    assert.equal(l.placeable, false);
    assert.equal(l.records.length, 0);
    assert.match(l.reason, /does not guess/);
    const g = coverageGained(fixtures, MOON_BASE_BAND, l);
    assert.equal(g.cellsGained, 0);
    assert.equal(g.gainPerTest, 0);
  });
});

describe('minimum test set', () => {
  it('is the four vertices of the band; FM2 contributes the two on its own line; the 10.2 psia ones are missing', () => {
    const m = minimumTestSet(fixtures, MOON_BASE_BAND, { fuelPhase: 'solid' });
    assert.equal(m.points.length, 4);
    assert.deepEqual(m.fm2Contributes.map((p) => p.pressure_kpa), [8.2 * KPA_PER_PSI, 8.2 * KPA_PER_PSI]);
    assert.deepEqual(m.missing.map((p) => p.pressure_kpa), [10.2 * KPA_PER_PSI, 10.2 * KPA_PER_PSI]);
    assert.match(m.rule, /vertices of the band polygon, deduplicated/);
    assert.ok(m.points.filter((p) => p.sourced).every((p) => p.source));
  });

  it('really covers the band: testing exactly those points gives 100 % coverage', () => {
    const m = minimumTestSet(fixtures, MOON_BASE_BAND, { fuelPhase: 'solid' });
    const cand = candidateFromPoints('min', 'minimum set', m.points, { fuelPhase: 'solid' });
    assert.equal(coverage(fixtures, MOON_BASE_BAND, { extraRecords: cand.records, fuelPhase: 'solid' }).fraction, 1);
  });

  it('FM2 contributes nothing for another fuel phase or another material', () => {
    assert.equal(minimumTestSet(fixtures, MOON_BASE_BAND, { fuelPhase: 'liquid' }).fm2Contributes.length, 0);
    assert.equal(minimumTestSet(fixtures, MOON_BASE_BAND, { fuelPhase: 'solid', material: 'Kapton' }).fm2Contributes.length, 0);
    assert.equal(minimumTestSet(fixtures, MOON_BASE_BAND, { fuelPhase: 'solid', material: 'Synergy Pro "Navy" fabric' }).fm2Contributes.length, 2);
  });

  it('vertices that coincide are listed once', () => {
    const dup: DesignBand = { ...MOON_BASE_BAND, vertices: [...MOON_BASE_BAND.vertices, MOON_BASE_BAND.vertices[0]] };
    assert.equal(minimumTestSet(fixtures, dup).points.length, 4);
  });
});

describe('rankExperiments', () => {
  it('ranks by coverage gained per test: the four corners beat FM2, which beats one centre point', () => {
    const corners = candidateFromPoints('corners', 'four corners', vertexPoints, { fuelPhase: 'solid' });
    const centre = candidateFromPoints('centre', 'one point', [{ o2_mole_fraction: 0.3025, pressure_kpa: 9.2 * KPA_PER_PSI }], { fuelPhase: 'solid' });
    const ranked = rankExperiments(fixtures, MOON_BASE_BAND, [centre, fm2Hypothetical(), corners, luciHypothetical()]);
    assert.deepEqual(ranked.map((r) => r.experiment), ['corners', 'fm2', 'centre', 'luci']);
    assert.equal(ranked[0].cellsGained, 81);
    assert.equal(ranked[0].gainPerTest, 81 / 4);
    assert.ok(ranked[1].gainPerTest > ranked[2].gainPerTest);
  });

  it('is stable: the same candidates give the same order whatever the input order', () => {
    const a = candidateFromPoints('a', 'a', vertexPoints, { fuelPhase: 'solid' });
    const b = fm2Hypothetical();
    const one = rankExperiments(fixtures, MOON_BASE_BAND, [a, b]).map((r) => r.experiment);
    const two = rankExperiments(fixtures, MOON_BASE_BAND, [b, a]).map((r) => r.experiment);
    assert.deepEqual(one, two);
  });
});

describe('on the real records', { skip: !existsSync(REAL) }, () => {
  const real = existsSync(REAL) ? loadConditionDir(REAL).records : [];

  it('PSI covers 0 % of the Moon Base band, for every fuel phase', () => {
    assert.equal(coverage(real, MOON_BASE_BAND).fraction, 0);
    for (const ph of ['solid', 'liquid', 'gas'] as const) assert.equal(coverage(real, MOON_BASE_BAND, { fuelPhase: ph }).covered, 0, ph);
  });

  it('adding FM2 to the real records gains exactly what it gains alone (the real records add nothing in partial gravity)', () => {
    const withReal = coverageGained(real, MOON_BASE_BAND, fm2Hypothetical(), { fuelPhase: 'solid' });
    const alone = coverageGained(fixtures, MOON_BASE_BAND, fm2Hypothetical(), { fuelPhase: 'solid' });
    assert.equal(withReal.cellsGained, alone.cellsGained);
    assert.equal(withReal.cellsGained, 9);
  });
});
