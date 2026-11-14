// parseQuantity / targetFromQuantities. Inputs are text a person or a model might write; expected values
// are computed from the factors of validation/run_all.py (checked below against the file itself).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { KPA_PER_PSI, QUANTITY_FACTORS, parseQuantity, targetFromQuantities, type Quantity, type QuantityVariable } from '../src/index.ts';

const ok = (text: string, variable: QuantityVariable): Quantity => {
  const r = parseQuantity(text, variable);
  assert.ok(r.ok, JSON.stringify(r));
  return r;
};
const err = (text: string, variable: QuantityVariable | string) => {
  const r = parseQuantity(text, variable as QuantityVariable);
  assert.ok(!r.ok, `expected an error for "${text}", got ${JSON.stringify(r)}`);
  return r;
};
const close = (a: number, b: number, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

describe('the factor table is the one in validation/run_all.py', () => {
  it('every factor in this file appears in run_all.py', () => {
    const file = join(import.meta.dirname, '..', '..', 'validation', 'run_all.py');
    if (!existsSync(file)) return;
    const py = readFileSync(file, 'utf8');
    for (const [unit, f] of Object.entries(QUANTITY_FACTORS.TO_KPA)) {
      assert.match(py, new RegExp(`"${unit}": ${String(f).replace('.', '\\.')}`), `TO_KPA ${unit}`);
    }
    for (const [unit, f] of Object.entries({ ...QUANTITY_FACTORS.TO_CM_S, ...QUANTITY_FACTORS.TO_MM })) {
      assert.match(py, new RegExp(`"${unit}": ${String(f).replace('.', '\\.')}`), unit);
    }
    assert.match(py, /"%": 0\.01/);
    assert.match(py, /v \+ 273\.15/);
  });

  it('psi factor agrees with the engine KPA_PER_PSI to 1e-7 (run_all.py rounds to 6 decimals and is the authority)', () => {
    assert.ok(Math.abs(QUANTITY_FACTORS.TO_KPA.psia / KPA_PER_PSI - 1) < 1e-7);
  });
});

describe('the Gemma case: 8.2 psia', () => {
  it('is 56.537 kPa, shown as 56.54, not 56.21', () => {
    const q = ok('8.2 psia', 'pressure');
    close(q.value, 8.2 * 6.894757);
    assert.equal(q.unit, 'kPa');
    assert.equal(q.factor, 6.894757);
    assert.equal(q.factor_or_formula, '×6.894757');
    assert.equal(q.display, '8.2 psia → 56.54 kPa (×6.894757)');
    assert.ok(Math.abs(q.value - 56.21) > 0.3);
    assert.equal(q.source.table, 'validation/run_all.py (TO_KPA, CONVERSIONS)');
    assert.equal(q.original, '8.2 psia');
  });
});

describe('pressure', () => {
  const cases: Array<[string, number]> = [
    ['56.5 kPa', 56.5],
    ['5000 Pa', 5],
    ['1 atm', 101.325],
    ['0.5 bar', 50],
    ['500 mbar', 50],
    ['10.2 psi', 10.2 * 6.894757],
    ['10.2 psia', 10.2 * 6.894757],
    ['760 mmHg', 760 * 0.1333224],
    ['760 torr', 760 * 0.1333224],
    ['  8.2PSIA ', 8.2 * 6.894757],
    ['1.5e1 kPa', 15],
  ];
  for (const [text, kpa] of cases) {
    it(`${text} → ${kpa} kPa`, () => close(ok(text, 'pressure').value, kpa, 1e-9));
  }
  it('psi is taken as absolute and says so; psia does not', () => {
    assert.ok(ok('10.2 psi', 'pressure').notes.some((n) => n.includes('absolute')));
    assert.equal(ok('10.2 psia', 'pressure').notes.length, 0);
  });
  it('rejects gauge pressure with a clear error', () => {
    for (const t of ['10 psig', '10 PSIG', '10 psi(g)', '10 psi g', '1 barg', '10 psid']) {
      const e = err(t, 'pressure');
      assert.equal(e.ok === false && e.code, 'gauge_pressure', t);
      assert.match(e.ok === false ? e.message : '', /absolute/);
    }
  });
  it('rejects a missing unit, an unknown unit and megapascal/millipascal ambiguity', () => {
    assert.equal(err('8.2', 'pressure').ok === false && (err('8.2', 'pressure') as { code: string }).code, 'missing_unit');
    assert.equal((err('8.2 hPa', 'pressure') as { code: string }).code, 'unknown_unit');
    assert.equal((err('1 MPa', 'pressure') as { code: string }).code, 'unknown_unit');
  });
  it('rejects values outside the plausible range (a unit slip)', () => {
    assert.equal((err('8.2 atm x 1000', 'pressure') as { code: string }).code, 'unknown_unit');
    assert.equal((err('50000 kPa', 'pressure') as { code: string }).code, 'out_of_range');
    assert.equal((err('0.01 kPa', 'pressure') as { code: string }).code, 'out_of_range');
  });
});

describe('oxygen', () => {
  it('"34 %", "34%", "34 vol%", "34 vol %", "34% by vol" are all 0.34', () => {
    for (const t of ['34 %', '34%', '34 vol%', '34 vol %', '34 % by vol', '34 percent']) close(ok(t, 'o2_mole_fraction').value, 0.34, 1e-12);
  });
  it('bare number: > 1 is percent, <= 1 is a fraction, and the rule is stated', () => {
    const a = ok('34', 'o2_mole_fraction');
    close(a.value, 0.34);
    assert.match(a.rule ?? '', /> 1, read as percent/);
    const b = ok('0.34', 'o2_mole_fraction');
    close(b.value, 0.34);
    assert.match(b.rule ?? '', /<= 1, read as a mole fraction/);
    close(ok('21', 'o2_mole_fraction').value, 0.21);
  });
  it('bare 1 is the fraction 1 and warns; "1 %" is 0.01', () => {
    const a = ok('1', 'o2_mole_fraction');
    assert.equal(a.value, 1);
    assert.ok(a.notes.some((n) => n.includes('1 %')));
    close(ok('1 %', 'o2_mole_fraction').value, 0.01);
  });
  it('a written unit wins over the bare-number rule: "0.34 %" is 0.0034, with a note', () => {
    const q = ok('0.34 %', 'o2_mole_fraction');
    close(q.value, 0.0034);
    assert.ok(q.notes.length === 1);
  });
  it('"mole fraction" and "fraction" units read the number as written', () => {
    close(ok('0.34 mole fraction', 'o2_mole_fraction').value, 0.34);
    assert.equal((err('34 fraction', 'o2_mole_fraction') as { code: string }).code, 'percent_out_of_range');
  });
  it('rejects > 100, negatives, ranges, comma decimals and text', () => {
    assert.equal((err('340', 'o2_mole_fraction') as { code: string }).code, 'percent_out_of_range');
    assert.equal((err('150 %', 'o2_mole_fraction') as { code: string }).code, 'percent_out_of_range');
    assert.equal((err('-5', 'o2_mole_fraction') as { code: string }).code, 'percent_out_of_range');
    assert.equal((err('30-34 %', 'o2_mole_fraction') as { code: string }).code, 'range_not_supported');
    assert.equal((err('0,34', 'o2_mole_fraction') as { code: string }).code, 'ambiguous_decimal_separator');
    assert.equal((err('about a third', 'o2_mole_fraction') as { code: string }).code, 'not_a_number');
    assert.equal((err('34 ppm', 'o2_mole_fraction') as { code: string }).code, 'unknown_unit');
  });
});

describe('flow velocity', () => {
  it('cm/s, mm/s, m/s', () => {
    close(ok('5 cm/s', 'flow_velocity').value, 5);
    close(ok('50 mm/s', 'flow_velocity').value, 5);
    close(ok('0.05 m/s', 'flow_velocity').value, 5);
    assert.equal(ok('0.05 m/s', 'flow_velocity').unit, 'cm/s');
  });
  it('rejects a missing unit, km/h and negative speeds', () => {
    assert.equal((err('5', 'flow_velocity') as { code: string }).code, 'missing_unit');
    assert.equal((err('5 km/h', 'flow_velocity') as { code: string }).code, 'unknown_unit');
    assert.equal((err('-5 cm/s', 'flow_velocity') as { code: string }).code, 'out_of_range');
  });
});

describe('sample thickness', () => {
  it('mm, cm, µm, in', () => {
    close(ok('0.4 mm', 'sample_thickness').value, 0.4);
    close(ok('0.04 cm', 'sample_thickness').value, 0.4);
    close(ok('400 µm', 'sample_thickness').value, 0.4);
    close(ok('400 μm', 'sample_thickness').value, 0.4); // Greek mu U+03BC
    close(ok('400 um', 'sample_thickness').value, 0.4);
    close(ok('0.5 in', 'sample_thickness').value, 12.7);
  });
  it('rejects a missing unit and an unknown one', () => {
    assert.equal((err('0.4', 'sample_thickness') as { code: string }).code, 'missing_unit');
    assert.equal((err('0.4 mil', 'sample_thickness') as { code: string }).code, 'unknown_unit');
  });
});

describe('gravity', () => {
  it('"0.165 g" and "1/6 g"', () => {
    const a = ok('0.165 g', 'gravity_level');
    assert.equal(a.value, 0.165);
    assert.equal(a.gravity_regime, 'partial_gravity');
    const b = ok('1/6 g', 'gravity_level');
    close(b.value, 1 / 6);
    assert.equal(b.gravity_regime, 'partial_gravity');
  });
  it('"1 g" is normal gravity; above 1 g has no regime inferred', () => {
    assert.equal(ok('1 g', 'gravity_level').gravity_regime, 'normal_gravity');
    assert.equal(ok('2 g', 'gravity_level').gravity_regime, undefined);
  });
  it('"lunar" is the existing Moon preset level with its source', () => {
    const q = ok('Lunar', 'gravity_level');
    assert.equal(q.value, 0.165);
    assert.equal(q.gravity_regime, 'partial_gravity');
    assert.equal(q.source.document?.page, 13);
    assert.equal(q.source.document?.quote, 'Lunar-g = 0.165 gE');
  });
  it('"mars" is 1/3 g with the source quote', () => {
    const q = ok('mars', 'gravity_level');
    assert.equal(q.value, 1 / 3);
    assert.match(q.source.document?.quote ?? '', /Mars \(1\/3 g\)/);
  });
  it('"microgravity" sets the regime and asserts no level', () => {
    const q = ok('microgravity', 'gravity_level');
    assert.equal(q.gravity_regime, 'microgravity');
    assert.match(q.display, /no gravity level asserted/);
  });
  it('rejects a bare number, m/s², division by zero and 4 g', () => {
    assert.equal((err('0.165', 'gravity_level') as { code: string }).code, 'missing_unit');
    assert.equal((err('1.62 m/s2', 'gravity_level') as { code: string }).code, 'unknown_unit');
    assert.equal((err('1/0 g', 'gravity_level') as { code: string }).code, 'not_a_number');
    assert.equal((err('4 g', 'gravity_level') as { code: string }).code, 'out_of_range');
  });
});

describe('ambient temperature', () => {
  it('K and °C', () => {
    close(ok('295 K', 'ambient_temperature').value, 295);
    close(ok('22 °C', 'ambient_temperature').value, 295.15);
    close(ok('22°C', 'ambient_temperature').value, 295.15);
    close(ok('22 C', 'ambient_temperature').value, 295.15);
    close(ok('22 degC', 'ambient_temperature').value, 295.15);
    assert.equal(ok('22 °C', 'ambient_temperature').factor_or_formula, 'K = °C + 273.15');
  });
  it('rejects a missing unit, Fahrenheit and temperatures below the plausible range', () => {
    assert.equal((err('22', 'ambient_temperature') as { code: string }).code, 'missing_unit');
    assert.equal((err('72 °F', 'ambient_temperature') as { code: string }).code, 'unknown_unit');
    assert.equal((err('-300 °C', 'ambient_temperature') as { code: string }).code, 'out_of_range');
  });
});

describe('general errors', () => {
  it('empty text and unknown variables', () => {
    assert.equal((err('', 'pressure') as { code: string }).code, 'empty');
    assert.equal((err('   ', 'o2_mole_fraction') as { code: string }).code, 'empty');
    assert.equal((err('5 cm', 'humidity') as { code: string }).code, 'unknown_variable');
  });
  it('every error names the variable and the original text', () => {
    const e = err('8.2 xx', 'pressure');
    assert.equal(e.ok === false && e.variable, 'pressure');
    assert.equal(e.ok === false && e.original, '8.2 xx');
  });
  it('is deterministic', () => {
    assert.deepEqual(parseQuantity('8.2 psia', 'pressure'), parseQuantity('8.2 psia', 'pressure'));
  });
});

describe('targetFromQuantities', () => {
  it('builds a validated Target and lists the conversions for the UI', () => {
    const r = targetFromQuantities({ gravity: 'lunar', o2: '34 %', pressure: '8.2 psia' });
    assert.ok(r.ok);
    close(r.target.continuous.pressure as number, 8.2 * 6.894757);
    close(r.target.continuous.o2_mole_fraction as number, 0.34);
    assert.equal(r.target.continuous.gravity_level, 0.165);
    assert.equal(r.target.regime.gravity_regime, 'partial_gravity');
    assert.deepEqual(r.conversions.map((c) => c.display), ['lunar → 0.165 g (Moon, 0.165 g)', '34 % → 0.34 (×0.01)', '8.2 psia → 56.54 kPa (×6.894757)']);
  });
  it('microgravity sets the regime and no gravity level', () => {
    const r = targetFromQuantities({ gravity: 'microgravity', o2: '21' });
    assert.ok(r.ok);
    assert.equal(r.target.regime.gravity_regime, 'microgravity');
    assert.equal(r.target.continuous.gravity_level, undefined);
  });
  it('passes regime axes through and validates them', () => {
    const good = targetFromQuantities({ gravity: '0.165 g', fuel_phase: 'solid', diluent: 'N2', flame_type: 'normal' });
    assert.ok(good.ok && good.target.regime.fuel_phase === 'solid');
    const bad = targetFromQuantities({ diluent: 'neon' });
    assert.ok(!bad.ok);
    assert.equal(bad.errors[0].code, 'invalid_target');
  });
  it('collects every error, with the field name; no partial target', () => {
    const r = targetFromQuantities({ o2: '340', pressure: '8.2 psig', flow_velocity: '5' });
    assert.ok(!r.ok);
    assert.deepEqual(r.errors.map((e) => [e.field, e.code]), [['o2', 'percent_out_of_range'], ['pressure', 'gauge_pressure'], ['flow_velocity', 'missing_unit']]);
  });
  it('a stated gravity_regime that disagrees with the gravity is refused; one that agrees is kept', () => {
    const bad = targetFromQuantities({ gravity: 'lunar', gravity_regime: 'microgravity' });
    assert.ok(!bad.ok && bad.errors[0].code === 'regime_conflict');
    assert.ok(targetFromQuantities({ gravity: 'lunar', gravity_regime: 'partial_gravity' }).ok);
  });
  it('empty strings and absent fields leave the axis open', () => {
    const r = targetFromQuantities({ o2: '', pressure: undefined });
    assert.ok(r.ok);
    assert.deepEqual(r.target, { regime: {}, continuous: {} });
    assert.deepEqual(r.conversions, []);
  });
});

describe('habitat plausibility warnings (never errors)', () => {
  it('0.34 % O2 is converted to 0.0034 and warned, with the "did you mean 34 %" hint', () => {
    const q = ok('0.34 %', 'o2_mole_fraction');
    close(q.value, 0.0034);
    assert.equal(q.warnings.length, 1);
    assert.match(q.warnings[0], /far below any breathable atmosphere/);
    assert.match(q.warnings[0], /did you mean 34 %\?/);
  });
  it('O2 outside 0.05–0.60 warns; inside does not', () => {
    assert.equal(ok('34 %', 'o2_mole_fraction').warnings.length, 0);
    assert.equal(ok('0.05', 'o2_mole_fraction').warnings.length, 0);
    assert.equal(ok('0.6', 'o2_mole_fraction').warnings.length, 0);
    assert.equal(ok('70 %', 'o2_mole_fraction').warnings.length, 1);
    assert.equal(ok('3 %', 'o2_mole_fraction').warnings.length, 1);
  });
  it('pressure outside 20–120 kPa warns; inside does not', () => {
    assert.equal(ok('8.2 psia', 'pressure').warnings.length, 0);
    assert.equal(ok('1 atm', 'pressure').warnings.length, 0);
    assert.match(ok('5 kPa', 'pressure').warnings[0], /outside 20–120 kPa/);
    assert.equal(ok('2 atm', 'pressure').warnings.length, 1);
  });
  it('other variables never warn, and targetFromQuantities keeps the warnings in the conversions', () => {
    assert.deepEqual(ok('5 cm/s', 'flow_velocity').warnings, []);
    const r = targetFromQuantities({ o2: '0.34 %', pressure: '8.2 psia' });
    assert.ok(r.ok);
    assert.equal(r.conversions[0].warnings.length, 1);
    close(r.target.continuous.o2_mole_fraction as number, 0.0034);
  });
});

describe('audit fix 4: microgravity below 0.01 g', () => {
  it('"0 g" and levels below 0.01 g are microgravity, with the note; the number is kept', () => {
    for (const t of ['0 g', '0.000001 g', '1e-4 g', '0.009 g']) {
      const q = ok(t, 'gravity_level');
      assert.equal(q.gravity_regime, 'microgravity', t);
      assert.match(q.notes[0], /below 0\.01 g are treated as microgravity; ISS ≈ 1e-6 to 1e-4 g/);
    }
    assert.equal(ok('1e-4 g', 'gravity_level').value, 1e-4);
  });
  it('0.01 up to < 1 is partial, 1 is normal; negative and > 3 are rejected', () => {
    assert.equal(ok('0.01 g', 'gravity_level').gravity_regime, 'partial_gravity');
    assert.equal(ok('0.165 g', 'gravity_level').gravity_regime, 'partial_gravity');
    assert.equal(ok('0.999 g', 'gravity_level').gravity_regime, 'partial_gravity');
    assert.equal(ok('1 g', 'gravity_level').gravity_regime, 'normal_gravity');
    assert.equal((err('-0.1 g', 'gravity_level') as { code: string }).code, 'out_of_range');
    assert.equal((err('3.5 g', 'gravity_level') as { code: string }).code, 'out_of_range');
    assert.equal(ok('3 g', 'gravity_level').gravity_regime, undefined);
  });
  it('a numeric microgravity level keeps its level in the Target; the name "microgravity" does not assert one', () => {
    const n = targetFromQuantities({ gravity: '0.0001 g' });
    assert.ok(n.ok);
    assert.equal(n.target.regime.gravity_regime, 'microgravity');
    assert.equal(n.target.continuous.gravity_level, 1e-4);
    const m = targetFromQuantities({ gravity: 'microgravity' });
    assert.ok(m.ok && m.target.continuous.gravity_level === undefined);
  });
});

describe('audit fix 12: vocabulary', () => {
  it('normal/standard/sea-level air pressure, one atmosphere, 1 atm → 101.325 kPa with a note', () => {
    for (const t of ['normal air pressure', 'Standard air pressure', 'sea-level air pressure', 'sea level pressure', 'normal pressure', '1 atmosphere', 'one atmosphere', '1 atm', 'the standard atmosphere']) {
      const q = ok(t, 'pressure');
      close(q.value, 101.325, 1e-9);
      assert.equal(q.unit, 'kPa');
      assert.ok(q.notes.some((n) => n.includes('101.325 kPa')), t);
    }
    close(ok('2 atmospheres', 'pressure').value, 202.65, 1e-9);
  });
  it('trailing oxygen words after a percent are stripped', () => {
    for (const t of ['34% O2', '34 % oxygen', '34 vol% of oxygen', '34% O₂', '34 percent O2', '34 % of oxygen']) {
      const q = ok(t, 'o2_mole_fraction');
      close(q.value, 0.34, 1e-12);
      assert.ok(q.notes.some((n) => n.includes('ignored')), t);
    }
    assert.equal(ok('34% O2', 'o2_mole_fraction').original, '34% O2');
    close(ok('0.34 oxygen', 'o2_mole_fraction').value, 0.34);
  });
  it('lunar gravity, the Moon, Moon gravity → Moon preset; Martian gravity → Mars preset', () => {
    for (const t of ['lunar gravity', 'the Moon', 'Moon gravity', 'the moon gravity', 'Lunar']) {
      const q = ok(t, 'gravity_level');
      assert.equal(q.value, 0.165, t);
      assert.equal(q.source.document?.page, 13);
    }
    for (const t of ['Martian gravity', 'Mars', 'Mars gravity']) assert.equal(ok(t, 'gravity_level').value, 1 / 3, t);
  });
  it('22 degrees C, 22 degrees Celsius, 22 °C → 295.15 K; 300 kelvin → 300 K', () => {
    for (const t of ['22 degrees C', '22 degrees Celsius', '22 °C', '22 celsius', '22 deg C']) close(ok(t, 'ambient_temperature').value, 295.15, 1e-9);
    close(ok('300 kelvin', 'ambient_temperature').value, 300);
    assert.equal((err('22 degrees', 'ambient_temperature') as { code: string }).code, 'unknown_unit');
  });
});

describe('the three AskBox example questions, with the strings a model would copy from them', () => {
  const file = join(import.meta.dirname, '..', '..', 'web', 'components', 'AskBox.tsx');
  const questions = existsSync(file) ? [...readFileSync(file, 'utf8').matchAll(/^\s*"([^"]+\?)",?$/gm)].map((m) => m[1]) : [];
  // [question index, strings copied from it, expected]
  const copied: Array<{ q: string; input: Parameters<typeof targetFromQuantities>[0]; expect: { o2: number; kpa: number; regime: string } }> = [
    { q: '30% oxygen', input: { gravity: 'lunar', o2: '30% oxygen', pressure: '10.2 psi' }, expect: { o2: 0.3, kpa: 10.2 * 6.894757, regime: 'partial_gravity' } },
    { q: '21% oxygen', input: { gravity: 'microgravity', o2: '21% oxygen', pressure: 'normal air pressure' }, expect: { o2: 0.21, kpa: 101.325, regime: 'microgravity' } },
    { q: '34% oxygen', input: { o2: '34% oxygen', pressure: '8.2 psia' }, expect: { o2: 0.34, kpa: 8.2 * 6.894757, regime: '' } },
  ];
  it('finds three examples in AskBox.tsx (skipped when the web folder is absent)', () => {
    if (!existsSync(file)) return;
    assert.equal(questions.length, 3);
  });
  for (const c of copied) {
    it(`"${c.q}" question converts without error or warning`, () => {
      const r = targetFromQuantities(c.input);
      assert.ok(r.ok, JSON.stringify(r));
      close(r.target.continuous.o2_mole_fraction as number, c.expect.o2, 1e-12);
      close(r.target.continuous.pressure as number, c.expect.kpa, 1e-9);
      if (c.expect.regime) assert.equal(r.target.regime.gravity_regime, c.expect.regime);
      for (const q of r.conversions) assert.deepEqual(q.warnings, []);
      if (questions.length === 3) {
        const text = questions.find((x) => x.includes(c.q));
        assert.ok(text, `no example contains "${c.q}"`);
        for (const piece of [c.input.o2, c.input.pressure, c.input.gravity]) {
          if (piece && ['10.2 psi', '8.2 psia', 'normal air pressure', '30% oxygen', '21% oxygen', '34% oxygen'].includes(piece)) assert.ok(text.includes(piece), `"${piece}" is not in "${text}"`);
        }
      }
    });
  }
});
