// CSV reading, record validation, geometry, presets and envelope export.
// Inline CSV rows below are SYNTHETIC test input, not NASA data.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { convexHull, distanceToHull, hullContains } from '../src/geometry.ts';
import {
  KPA_PER_PSI,
  PRESETS,
  buildEnvelopes,
  canonicalJson,
  evaluate,
  locateTarget,
  parseConditionCsv,
  parseCsv,
  presetTarget,
} from '../src/index.ts';
import { fixtureRecords, shuffled } from './helpers.ts';

const HEADER = 'accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note';
const row = (variable: string, value: string, unit: string, extra: Partial<Record<'status' | 'method' | 'quote' | 'accession', string>> = {}) =>
  [
    extra.accession ?? 'PSI-9999',
    'T1',
    variable,
    value,
    unit,
    value,
    unit,
    extra.method ?? 'table',
    'SYNTHETIC/x.csv',
    'row=1;column=X',
    extra.quote ?? 'SYNTHETIC',
    extra.status ?? 'verified',
    'SYNTHETIC',
  ].join(',');

describe('CSV reader', () => {
  it('handles quotes, doubled quotes, commas and newlines inside quotes, CRLF and BOM', () => {
    const rows = parseCsv('﻿a,b,c\r\n"x, y","he said ""hi""","line1\nline2"\r\n\r\nlast,,\n');
    assert.deepEqual(
      rows.map((r) => r.cells),
      [
        ['a', 'b', 'c'],
        ['x, y', 'he said "hi"', 'line1\nline2'],
        ['last', '', ''],
      ],
    );
    assert.deepEqual(
      rows.map((r) => r.line),
      [1, 2, 5],
    );
  });

  it('rejects an unterminated quote', () => {
    assert.throws(() => parseCsv('a\n"open'), /unterminated/);
  });
});

describe('record validation (schema rules)', () => {
  const parse = (...rows: string[]) => parseConditionCsv([HEADER, ...rows].join('\n'), 'PSI-9999.csv', 'PSI-9999');

  it('accepts a valid row and keeps where it came from', () => {
    const r = parse(row('o2_mole_fraction', '0.21', '1'));
    assert.equal(r.rejected.length, 0);
    assert.deepEqual(r.records[0].origin, { file: 'PSI-9999.csv', line: 2 });
  });

  it('rejects O2 given in percent, pressure not in kPa, unknown variables and bad regime terms', () => {
    const r = parse(
      row('o2_mole_fraction', '21', '%'),
      row('o2_mole_fraction', '21', '1'),
      row('pressure', '14.7', 'psi'),
      row('oxygen', '0.21', '1'),
      row('gravity_regime', 'lunar', ''),
      row('flow_velocity', 'about 5', 'cm/s'),
      row('flow_velocity', '5', 'm/s'),
    );
    assert.equal(r.records.length, 0);
    assert.equal(r.rejected.length, 7);
  });

  it('rejects rows without a source, with an unknown status, or under another accession', () => {
    const noQuote = [HEADER, row('o2_mole_fraction', '0.21', '1', { quote: '' })].join('\n');
    assert.equal(parseConditionCsv(noQuote, 'f', 'PSI-9999').rejected.length, 1);
    assert.equal(parse(row('o2_mole_fraction', '0.21', '1', { status: 'guessed' })).rejected.length, 1);
    assert.equal(parse(row('o2_mole_fraction', '0.21', '1', { accession: 'PSI-1' })).rejected.length, 1);
  });

  it('keeps a flagged row even when its value is not a plain number (it is never used as a number)', () => {
    const r = parse(row('flow_velocity', '5 to 10', 'cm/s', { status: 'insufficient_evidence' }));
    assert.equal(r.records.length, 1);
    assert.equal(r.records[0].status, 'insufficient_evidence');
  });

  it('reads a range lo..hi as its two ends, and rejects a descending range', () => {
    const r = parse(row('flow_velocity', '1.5..5', 'cm/s'), row('flow_velocity', '5..1.5', 'cm/s'), row('burner_o2_mole_fraction', '0.4', '1'));
    assert.equal(r.records.length, 2);
    assert.equal(r.rejected.length, 1);
    assert.match(r.rejected[0].reason, /ascending range/);
  });

  it('rejects a header without the schema fields', () => {
    const r = parseConditionCsv('accession,value\nPSI-9999,1\n', 'f');
    assert.equal(r.records.length, 0);
    assert.match(r.rejected[0].reason, /header lacks/);
  });

  it('loads every synthetic fixture without a rejected row', () => {
    assert.ok(fixtureRecords().length > 50);
  });
});

describe('geometry', () => {
  it('hull of a square with an interior point, in any input order', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0.5, y: 0.5 },
    ];
    const h = convexHull(pts);
    assert.deepEqual(h, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]);
    assert.deepEqual(convexHull(shuffled(pts, 7)), h);
    assert.equal(hullContains({ x: 0.5, y: 0.5 }, h), true);
    assert.equal(hullContains({ x: 1, y: 0.5 }, h), true, 'on an edge counts as inside');
    assert.equal(hullContains({ x: 1.5, y: 0.5 }, h), false);
    assert.ok(Math.abs(distanceToHull({ x: 1.5, y: 0.5 }, h) - 0.5) < 1e-12);
  });

  it('degenerate hulls: one point and a segment', () => {
    assert.deepEqual(convexHull([{ x: 1, y: 1 }, { x: 1, y: 1 }]), [{ x: 1, y: 1 }]);
    const seg = convexHull([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 0 }]);
    assert.deepEqual(seg, [{ x: 0, y: 0 }, { x: 2, y: 0 }]);
    assert.equal(hullContains({ x: 1, y: 0 }, seg), true);
    assert.equal(hullContains({ x: 1, y: 0.1 }, seg), false);
  });
});

describe('presets', () => {
  it('every preset value carries a source with a verbatim quote, and the original value', () => {
    for (const p of PRESETS) {
      for (const v of [...Object.values(p.regime), ...Object.values(p.continuous)]) {
        assert.ok(v, p.id);
        assert.ok(v.source.quote.length > 10, `${p.id}: quote`);
        assert.ok(v.source.url.startsWith('https://'), `${p.id}: url`);
        assert.ok(v.source.locator.length > 0, `${p.id}: locator`);
        assert.ok(v.value_original.length > 0, `${p.id}: original value`);
      }
    }
  });

  it('the quoted words contain the original values', () => {
    for (const p of PRESETS) {
      for (const v of Object.values(p.continuous)) {
        if (v) assert.ok(v.source.quote.includes(v.value_original), `${p.id}: "${v.value_original}" in quote`);
      }
    }
  });

  it('unit conversions', () => {
    const lunar = presetTarget('challenge-lunar-base');
    assert.equal(lunar.regime.gravity_regime, 'partial_gravity');
    assert.equal(lunar.continuous.o2_mole_fraction, 0.3);
    assert.ok(Math.abs((lunar.continuous.pressure as number) - 70.3265) < 1e-3);
    assert.equal(lunar.continuous.gravity_level, 0.16);
    assert.ok(Math.abs((presetTarget('nesc-8.2psia-34o2-lunar').continuous.pressure as number) - 8.2 * KPA_PER_PSI) < 1e-12);
    assert.equal(presetTarget('nesc-10.2psia-26.5o2-lunar').continuous.o2_mole_fraction, 0.265);
  });

  it('overrides fill what the source leaves open; unknown ids throw', () => {
    assert.equal(presetTarget('challenge-lunar-base', { fuel_phase: 'solid' }).regime.fuel_phase, 'solid');
    assert.throws(() => presetTarget('mars-base'), /unknown preset/);
  });
});

describe('envelope export for the chart', () => {
  const env = buildEnvelopes(fixtureRecords());
  const byThree = buildEnvelopes(fixtureRecords(), { groupBy: ['gravity_regime', 'fuel_phase', 'diluent'] });

  it('one envelope per regime combination (all four axes by default), with points, hull and citations', () => {
    assert.deepEqual(env.groupBy, ['gravity_regime', 'fuel_phase', 'diluent', 'flame_type']);
    const micro = env.regimes.find((r) => r.key === 'gravity_regime=microgravity|fuel_phase=solid|diluent=N2|flame_type=normal');
    assert.ok(micro);
    assert.equal(micro.regimeComplete, true);
    // PSI-9001 T1-T4 (T5's O2 is flagged) and PSI-9005 G1-G3.
    assert.equal(micro.points.length, 7);
    assert.ok(micro.points.every((p) => p.citations.length === 2));
    assert.ok(micro.hull.length >= 3);
    assert.deepEqual(micro.ranges.o2_mole_fraction, [0.17, 0.3]);
    assert.deepEqual(
      micro.investigations.map((i) => i.accession),
      ['PSI-9001', 'PSI-9005'],
    );
  });

  it('groupBy merges combinations that differ only on the other axes', () => {
    const micro = byThree.regimes.find((r) => r.key === 'gravity_regime=microgravity|fuel_phase=solid|diluent=N2');
    assert.ok(micro);
    assert.equal(micro.points.length, 7);
    assert.deepEqual(micro.unpairedTests, [{ accession: 'PSI-9007', test_id: '*' }]);
    assert.ok(micro.testsWithoutPlaneData.some((t) => t.accession === 'PSI-9003'));
  });

  it('regime combinations with a missing axis are exported but marked incomplete', () => {
    const unknown = byThree.regimes.filter((r) => !r.regimeComplete).map((r) => r.key);
    assert.ok(unknown.includes('gravity_regime=?|fuel_phase=solid|diluent=N2'));
  });

  it('the hull of one investigation is the hull its verdict uses', () => {
    const ev = evaluate(fixtureRecords(), { regime: { gravity_regime: 'microgravity', fuel_phase: 'solid', diluent: 'N2' }, continuous: { o2_mole_fraction: 0.22, pressure: 90 } });
    const verdictHull = ev.ranked.find((c) => c.accession === 'PSI-9001')?.hull?.hull;
    const micro = env.regimes.find((r) => r.key === 'gravity_regime=microgravity|fuel_phase=solid|diluent=N2|flame_type=normal');
    assert.deepEqual(micro?.investigations.find((i) => i.accession === 'PSI-9001')?.hull, verdictHull);
  });

  it('locateTarget places the lunar preset: no same-regime envelope exists in the fixtures', () => {
    const loc = locateTarget(presetTarget('challenge-lunar-base'), env);
    assert.ok(loc.every((l) => l.sameRegime !== true));
    const micro = loc.find((l) => l.key === 'gravity_regime=microgravity|fuel_phase=solid|diluent=N2|flame_type=normal');
    assert.equal(micro?.sameRegime, false);
    assert.equal(typeof micro?.insideHull, 'boolean');
  });

  it('is deterministic', () => {
    assert.equal(canonicalJson(buildEnvelopes(shuffled(fixtureRecords(), 3))), canonicalJson(env));
  });
});
