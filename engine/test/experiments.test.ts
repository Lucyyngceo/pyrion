// experimentsNeeded (NAVIGATOR N10). Inline records are SYNTHETIC; real records and the FM2 page are used when present.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  EXPERIMENT_LABEL,
  PLANNED_SOURCES,
  TEST_MATRIX_O2_OFFSETS_POINTS,
  TEST_MATRIX_PRESSURE_FRACTIONS,
  canonicalJson,
  experimentsNeeded,
  parseConditionCsv,
  parseInvestigationCatalog,
  presetTarget,
  type ConditionRecord,
  type ExperimentsNeeded,
  type Target,
} from '../src/index.ts';
import { loadConditionDir } from '../src/load.ts';

const HEAD = 'accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note';
const row = (acc: string, test: string, variable: string, value: string, unit = '') =>
  `${acc},${test},${variable},${value},${unit},${value},${unit},table,SYNTHETIC/${acc}.csv,row=0,SYNTHETIC TEST FIXTURE,verified,SYNTHETIC - not NASA data`;
function synthetic(): ConditionRecord[] {
  const L = [HEAD];
  const inv = (acc: string, phase: string, regime: string, o2: string, p: string, extra: string[] = []) =>
    L.push(row(acc, '*', 'gravity_regime', regime), row(acc, '*', 'fuel_phase', phase), row(acc, 'T1', 'o2_mole_fraction', o2, '1'), row(acc, 'T1', 'pressure', p, 'kPa'), ...extra);
  // Gas: exactly 21 % and 1 atm in microgravity. Solid: 21 % at 95 kPa in microgravity (just outside 101 kPa).
  inv('PSI-9801', 'gas', 'microgravity', '0.21', '101.325');
  inv('PSI-9802', 'solid', 'microgravity', '0.21', '95', [row('PSI-9802', 'T1', 'flow_velocity', '5', 'cm/s'), row('PSI-9802', 'T1', 'outcome:burn_time', '30', 's'), row('PSI-9802', '*', 'platform', 'SYNTHETIC glovebox')]);
  const r = parseConditionCsv(L.join('\n'), 's.csv');
  assert.deepEqual(r.rejected, []);
  return r.records;
}
const CATALOG = parseInvestigationCatalog('accession,acronym,title,doi\nPSI-9802,SYN-S,Synthetic solid study,10.0000/synthetic-1\nPSI-9801,SYN-G,Synthetic gas study,10.0000/synthetic-2\n');

const sentencesOf = (e: ExperimentsNeeded): string[] => [
  e.gap.sentence,
  ...e.gap.detail,
  e.testMatrix.sentence,
  e.configuration.sentence,
  e.measurements.sentence,
  ...e.plannedCoverage.statements.map((s) => s.sentence),
  e.remainingGap.sentence,
  ...e.priority.map((p) => p.sentence),
];

describe('experimentsNeeded: Moon Base (partial gravity untested)', () => {
  const moon: Target = { regime: { gravity_regime: 'partial_gravity' }, continuous: { o2_mole_fraction: 0.3, pressure: 70.33 }, informational: { gravity_level: 0.165 } };
  const e = experimentsNeeded(synthetic(), moon, { catalog: CATALOG });

  it('the gap is the untested regime', () => {
    assert.equal(e.gap.kind, 'regime_untested');
    assert.match(e.gap.sentence, /^No PSI test was run in partial gravity; the investigations state only microgravity\.$/);
    assert.equal(e.label, 'PYRION proposal (a testable plan, not a NASA plan)');
    assert.equal(e.label, EXPERIMENT_LABEL);
  });
  it('the matrix is the target plus the stated bracketing grid, at partial gravity', () => {
    assert.deepEqual([...TEST_MATRIX_O2_OFFSETS_POINTS], [-8, -4, 0, 4, 8]);
    assert.deepEqual([...TEST_MATRIX_PRESSURE_FRACTIONS], [-0.15, 0, 0.15]);
    assert.equal(e.testMatrix.pointCount, 15);
    assert.equal(e.testMatrix.points.filter((p) => p.isTarget).length, 1);
    const t = e.testMatrix.points.find((p) => p.isTarget)!;
    assert.equal(t.o2_mole_fraction, 0.3);
    assert.equal(t.pressure_kpa, 70.33);
    assert.deepEqual(e.testMatrix.gravity, { regime: 'partial_gravity', level: 0.165 });
    assert.deepEqual([...new Set(e.testMatrix.points.map((p) => p.o2_mole_fraction))].sort(), [0.22, 0.26, 0.3, 0.34, 0.38]);
    assert.match(e.testMatrix.note, /PYRION design convention, not a NASA design/);
    assert.match(e.testMatrix.sentence, /^15 test points in partial gravity: oxygen from 22 % to 38 % and pressure from 59\.8 kPa \(8\.67 psia\) to 80\.9 kPa \(11\.7 psia\), around the target\.$/);
  });
  it('priority: the untested regime first, then solids', () => {
    assert.deepEqual(e.priority.map((p) => p.kind), ['regime_untested', 'solid_fuel']);
    assert.deepEqual(e.priority.map((p) => p.rank), [1, 2]);
    assert.equal(e.priority[0].sentence, 'Run at least one test in partial gravity: PSI has none.');
    assert.deepEqual(e.zeroCoveragePhases, ['solid', 'liquid', 'gas']);
  });
  it('FM2 and LUCI are quoted verbatim with file and page; FM2 stated conditions leave every point uncovered; LUCI coverage is "not stated by the source"', () => {
    const ids = e.plannedCoverage.sources.map((s) => s.id);
    assert.ok(ids.includes('fm2-web') && ids.includes('fm2-conditions') && ids.includes('luci-conditions') && ids.includes('luci-data'));
    const web = e.plannedCoverage.sources.find((s) => s.id === 'fm2-web')!;
    assert.equal(web.quote, 'The experiment burns four fuel samples individually in atmospheric conditions planned for future lunar habitats or vehicles.');
    assert.ok(web.file.includes('fm2'));
    const cond = e.plannedCoverage.sources.find((s) => s.id === 'fm2-conditions')!;
    assert.equal(cond.page, 10);
    assert.match(cond.quote, /Test 1: 8\.2 psia \(\+\/- 0\.3 psi\), 37% O2/);
    const luci = e.plannedCoverage.sources.find((s) => s.id === 'luci-conditions')!;
    assert.equal(luci.file, 'ntrs-20250010653/ASGSR 2025-LUCI-Ferkul-Presentation-v2-20250010653.pdf');
    assert.match(luci.quote, /in air at normal pressure/);
    const fm2 = e.plannedCoverage.statements.find((s) => s.source === 'FM2')!;
    assert.equal(fm2.covered.length, 0);
    assert.match(fm2.sentence, /none of the 15 test points falls on those conditions/);
    assert.match(e.plannedCoverage.statements.find((s) => s.source === 'LUCI')!.sentence, /not stated by the source/);
    assert.equal(e.remainingGap.points.length, 15);
    assert.match(e.remainingGap.sentence, /15 of 15 test points are not stated to be covered by FM2; for LUCI, coverage is not stated by the source\./);
  });
  it('a target on FM2\'s stated conditions is reported as covered for those points only', () => {
    const fm2: Target = { regime: { gravity_regime: 'partial_gravity' }, continuous: { o2_mole_fraction: 0.33, pressure: 8.2 * 6.894757293168361 }, informational: { gravity_level: 0.165 } };
    const r = experimentsNeeded(synthetic(), fm2);
    const st = r.plannedCoverage.statements.find((s) => s.source === 'FM2')!;
    assert.ok(st.covered.length >= 1 && st.covered.length < r.testMatrix.pointCount);
    for (const p of st.covered) {
      assert.ok([0.37, 0.33, 0.29, 0.25].some((x) => Math.abs((p.o2_mole_fraction as number) - x) <= 0.005 * x), `oxygen ${p.o2_mole_fraction}`);
      const psia = (p.pressure_kpa as number) / 6.894757293168361;
      assert.ok(psia >= 7.9 - 1e-9 && psia <= 8.5 + 1e-9, `pressure ${psia} psia`);
    }
    assert.equal(r.remainingGap.points.length, r.testMatrix.pointCount - st.covered.length);
  });
});

describe('experimentsNeeded: ISS air (gas comparable, solid just outside)', () => {
  const iss: Target = { regime: { gravity_regime: 'microgravity' }, continuous: { o2_mole_fraction: 0.21, pressure: 101.325 } };
  const e = experimentsNeeded(synthetic(), iss, { catalog: CATALOG });
  it('coverage by fuel phase: gas applicable, solid just_outside, liquid none', () => {
    const by = Object.fromEntries(e.phaseCoverage.map((p) => [p.fuel_phase, p]));
    assert.equal(by.gas.best, 'APPLICABLE');
    assert.equal(by.solid.best, 'EXTRAPOLATION');
    assert.equal(by.solid.level, 'just_outside');
    assert.equal(by.liquid.best, 'NONE');
    assert.deepEqual(e.zeroCoveragePhases, ['liquid']);
  });
  it('the matrix is around 21 % and 101 kPa, solids first, at microgravity', () => {
    assert.equal(e.testMatrix.gravity.regime, 'microgravity');
    const t = e.testMatrix.points.find((p) => p.isTarget)!;
    assert.deepEqual([t.o2_mole_fraction, t.pressure_kpa], [0.21, 101.325]);
    assert.equal(e.priority[0].kind, 'solid_fuel');
    assert.match(e.priority[0].sentence, /^Solid fuel: just outside the tested data; solids are the case that matters for cabin fires\.$/);
    assert.equal(e.priority[1].kind, 'no_comparable_test');
    assert.equal(e.priority[1].fuel_phase, 'liquid');
  });
  it('the configuration to repeat is the nearest solid investigation, with PSI id and DOI', () => {
    const c = e.configuration.comparable[0];
    assert.equal(c.accession, 'PSI-9802');
    assert.equal(c.doi, '10.0000/synthetic-1');
    assert.equal(c.inTargetRegime, true);
    assert.deepEqual(c.flow_velocity, { min: 5, max: 5, unit: 'cm/s' });
    assert.deepEqual(c.descriptors.platform, ['SYNTHETIC glovebox']);
    assert.match(e.configuration.sentence, /Repeat the configuration of PSI-9802 SYN-S \(doi:10\.0000\/synthetic-1\)/);
  });
  it('measurements come only from the variables those records carry; FM2/LUCI products are quoted', () => {
    assert.deepEqual(e.measurements.recorded.map((m) => [m.variable, m.label, m.unit]), [['outcome:burn_time', 'burn time', 's']]);
    assert.match(e.measurements.sentence, /^What PSI records for these investigations: burn time \(s\)\./);
    assert.equal(e.measurements.plannedDataProducts[0].id, 'luci-data');
  });
  it('FM2 and LUCI are not stated to cover microgravity: the whole matrix remains', () => {
    assert.equal(e.remainingGap.points.length, e.testMatrix.pointCount);
    assert.match(e.remainingGap.sentence, /^All 15 test points remain/);
  });
});

describe('experimentsNeeded: general properties', () => {
  const recs = synthetic();
  const targets: Target[] = [
    { regime: { gravity_regime: 'partial_gravity' }, continuous: { o2_mole_fraction: 0.3, pressure: 70.33 } },
    { regime: { gravity_regime: 'microgravity' }, continuous: { o2_mole_fraction: 0.21, pressure: 101.325 } },
    { regime: { gravity_regime: 'microgravity' }, continuous: { o2_mole_fraction: 0.6, pressure: 20 } },
    { regime: {}, continuous: {} },
    { regime: { gravity_regime: 'microgravity' }, continuous: { o2_mole_fraction: 0.95 } },
  ];
  it('is deterministic and independent of record order', () => {
    for (const t of targets) {
      const a = canonicalJson(experimentsNeeded(recs, t, { catalog: CATALOG }));
      assert.equal(canonicalJson(experimentsNeeded(recs, t, { catalog: CATALOG })), a);
      assert.equal(canonicalJson(experimentsNeeded([...recs].reverse(), t, { catalog: CATALOG })), a);
    }
  });
  it('far outside is prioritised before outside, and the oxygen cannot exceed 100 % in the matrix', () => {
    const far = experimentsNeeded(recs, targets[2]);
    assert.ok(far.testMatrix.points.every((p) => (p.o2_mole_fraction ?? 0) <= 1));
    const high = experimentsNeeded(recs, targets[4]);
    assert.ok(high.testMatrix.points.every((p) => (p.o2_mole_fraction ?? 0) <= 1 && p.pressure_kpa === undefined));
    assert.equal(far.gap.kind, 'outside_tested_data');
    assert.equal(far.gap.level, 'far_outside');
  });
  it('a target with no oxygen and no pressure has no matrix and says so', () => {
    const e = experimentsNeeded(recs, targets[3]);
    assert.equal(e.testMatrix.pointCount, 0);
    assert.match(e.testMatrix.sentence, /neither oxygen nor pressure/);
  });
  it('a gravity level in continuous is treated as informational, never as an axis', () => {
    const t: Target = { regime: { gravity_regime: 'partial_gravity' }, continuous: { o2_mole_fraction: 0.3, pressure: 70.33, gravity_level: 0.165 } };
    const e = experimentsNeeded(recs, t);
    assert.equal(e.gap.kind, 'regime_untested');
    assert.equal(e.testMatrix.gravity.level, 0.165);
    assert.equal(e.target.continuous.gravity_level, undefined);
  });
  it('every sentence is plain: no snake_case, no ALL-CAPS codes, no "undefined", at most 4 significant figures', () => {
    for (const t of targets) {
      for (const s of sentencesOf(experimentsNeeded(recs, t, { catalog: CATALOG }))) {
        assert.ok(!/\b[a-z0-9]+_[a-z0-9_]+\b/.test(s), s);
        assert.ok(!/\b(?:APPLICABLE|EXTRAPOLATION|INSUFFICIENT_EVIDENCE|REGIME_BARRIER)\b/.test(s), s);
        assert.ok(!/undefined|NaN/.test(s), s);
        const text = s.replace(/PSI-\d+/g, '').replace(/doi:\S+/g, '').replace(/NTRS \d+/g, '');
        for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) {
          const digits = m[0].replace('.', '').replace(/^0+/, '').replace(/0+$/, m[0].includes('.') ? '' : '0');
          assert.ok(digits.length <= 4, `${m[0]} in: ${s}`);
        }
      }
    }
  });
  it('the planned-source quotes are the exact text of the FM2 page when it is in the repository', () => {
    const f = join(import.meta.dirname, '..', '..', 'data', 'raw', 'nasa', PLANNED_SOURCES.find((s) => s.id === 'fm2-web')!.file);
    if (!existsSync(f)) return;
    const text = readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert.ok(text.includes(PLANNED_SOURCES.find((s) => s.id === 'fm2-web')!.quote));
  });
  it('the catalog parser reads accession, acronym, title and DOI', () => {
    assert.deepEqual(CATALOG['PSI-9802'], { acronym: 'SYN-S', title: 'Synthetic solid study', doi: '10.0000/synthetic-1' });
  });
});

describe('experimentsNeeded on the real records', () => {
  const dir = join(import.meta.dirname, '..', '..', 'data', 'conditions');
  const manifest = join(import.meta.dirname, '..', '..', 'data', 'manifest', 'investigations.csv');
  if (!existsSync(dir)) return;
  const real = loadConditionDir(dir).records;
  const catalog = existsSync(manifest) ? parseInvestigationCatalog(readFileSync(manifest, 'utf8')) : {};
  it('Moon Base preset: untested regime first, solids second, FM2 attached, every investigation named with a DOI when the manifest is present', () => {
    const e = experimentsNeeded(real, presetTarget('challenge-lunar-base'), { catalog });
    assert.equal(e.gap.kind, 'regime_untested');
    assert.deepEqual(e.priority.slice(0, 2).map((p) => p.kind), ['regime_untested', 'solid_fuel']);
    assert.ok(e.plannedCoverage.sources.some((s) => s.id === 'fm2-conditions'));
    assert.equal(e.testMatrix.gravity.regime, 'partial_gravity');
    assert.equal(e.remainingGap.points.length, e.testMatrix.pointCount);
    if (Object.keys(catalog).length > 0) for (const c of e.configuration.comparable) assert.match(c.doi ?? '', /^10\.\d+\//);
  });
});
