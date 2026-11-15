// Gravity keywords in parseQuantity and the deterministic extractor extractQuantities.
// The battery is validation/judge_battery/questions.json (EN + ES); the tests skip it if the file is absent.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { extractQuantities, findGravityKeywords, parseQuantity, targetFromQuantities } from '../src/index.ts';

const grav = (t: string) => parseQuantity(t, 'gravity_level');

describe('gravity keywords anywhere in the text', () => {
  const cases: Array<[string, 'partial_gravity' | 'normal_gravity' | 'microgravity', number | undefined]> = [
    ['base lunar', 'partial_gravity', 0.165],
    ['lunar habitat', 'partial_gravity', 0.165],
    ['in a Moon base', 'partial_gravity', 0.165],
    ['on the ground', 'normal_gravity', 1],
    ['ground', 'normal_gravity', 1],
    ['hábitat en Marte', 'partial_gravity', 0.38],
    ['martian habitat', 'partial_gravity', 0.38],
    ['terrestrial conditions', 'normal_gravity', 1],
    ['en la Tierra', 'normal_gravity', 1],
    ['a flame in free fall', 'microgravity', undefined],
    ['aboard the ISS', 'microgravity', undefined],
    ['en caída libre', 'microgravity', undefined],
    ['weightless cabin', 'microgravity', undefined],
    ['zero-g experiment', 'microgravity', undefined],
    ['condiciones de ingravidez', 'microgravity', undefined],
  ];
  for (const [text, regime, value] of cases) {
    it(`"${text}" → ${regime}`, () => {
      const r = grav(text);
      assert.ok(r.ok, JSON.stringify(r));
      assert.equal(r.gravity_regime, regime);
      if (value !== undefined) assert.equal(r.value, value);
      assert.equal(r.original, text);
      assert.ok(r.notes.some((n) => n.startsWith('gravity read from the keyword')));
      assert.ok(r.display.startsWith(`${text} → `));
    });
  }
  it('two different classes are a typed error naming both: "Moon and Mars"', () => {
    const e = grav('Moon and Mars');
    assert.ok(!e.ok);
    assert.equal(e.code, 'ambiguous_gravity');
    assert.match(e.message, /moon \("Moon"\) and mars \("Mars"\)/);
    assert.ok(!grav('microgravity on Earth').ok);
  });
  it('words that merely contain a keyword do not match; no keyword keeps the old error', () => {
    for (const t of ['background', 'lunarian', 'marsh', 'issue', 'luna park']) {
      const r = grav(t);
      if (t === 'luna park') assert.ok(r.ok); // "luna" is a whole word here: a known limit of keyword search
      else assert.ok(!r.ok && r.code === 'not_a_number', t);
    }
    const e = grav('something unrelated');
    assert.ok(!e.ok && e.code === 'not_a_number');
  });
  it('a text that starts with a number is never read by keyword', () => {
    const e = grav('0.165 lunar');
    assert.ok(!e.ok && e.code === 'unknown_unit');
  });
  it('findGravityKeywords reports the word as written, accent-insensitively', () => {
    const t = 'Una llama en CAÍDA LIBRE';
    const h = findGravityKeywords(t);
    assert.equal(h.length, 1);
    assert.equal(t.slice(h[0].index, h[0].index + h[0].length), 'CAÍDA LIBRE');
  });
});

describe('extractQuantities', () => {
  it('returns the raw strings exactly as written, and nothing else', () => {
    const q = 'PMMA burning at 0.165 g, 34% O2 and 8.2 psia';
    const e = extractQuantities(q);
    assert.deepEqual(e, { gravity: '0.165 g', o2: '34%', pressure: '8.2 psia', leftover: [], issues: [] });
    for (const v of [e.gravity, e.o2, e.pressure]) assert.ok(q.includes(v as string));
  });
  it('is deterministic', () => {
    const q = 'hábitat en Marte a 30% de oxígeno y 10,2 psia';
    assert.equal(JSON.stringify(extractQuantities(q)), JSON.stringify(extractQuantities(q)));
  });
  it('oxygen needs an oxygen word near the percent; otherwise the number is left over', () => {
    const e = extractQuantities('humidity 50 % and 1 atm');
    assert.equal(e.o2, undefined);
    assert.deepEqual(e.leftover, ['50 %']);
    assert.equal(e.pressure, '1 atm');
  });
  it('"oxygen fraction of 0.34" gives the bare number; Spanish "fracción molar de oxígeno de 0,34" too', () => {
    assert.equal(extractQuantities('an oxygen fraction of 0.34 at 1 atm').o2, '0.34');
    assert.equal(extractQuantities('fracción molar de oxígeno de 0,34 a 1 atm').o2, '0,34');
  });
  it('a partial pressure is not the total pressure: issue and leftover, no pressure', () => {
    const e = extractQuantities('A cabin with a ppO2 of 21 kPa');
    assert.equal(e.pressure, undefined);
    assert.deepEqual(e.leftover, ['21 kPa']);
    assert.equal(e.issues[0].code, 'partial_pressure');
  });
  it('gauge pressure is extracted as written so parseQuantity can refuse it', () => {
    const e = extractQuantities('34% O2 at 8.2 psig on the Moon');
    assert.equal(e.pressure, '8.2 psig');
    const t = targetFromQuantities(e);
    assert.ok(!t.ok && t.errors[0].code === 'gauge_pressure');
  });
  it('a length is not a thickness without the word "thick"; a velocity is not a flow without a flow word', () => {
    const a = extractQuantities('a 2 mm PMMA sheet at 21 % oxygen and 1 atm in microgravity');
    assert.equal(a.sample_thickness, undefined);
    assert.deepEqual(a.leftover, ['2 mm']);
    assert.equal(a.o2, '21 %');
    const b = extractQuantities('a 2 mm thick PMMA sheet in a 10 cm/s flow at 21 % oxygen');
    assert.equal(b.sample_thickness, '2 mm');
    assert.equal(b.flow_velocity, '10 cm/s');
    assert.equal(extractQuantities('a flame spreading at 3 cm/s').flow_velocity, undefined);
  });
  it('ambient temperature needs the word "ambient"; a flame temperature is left over', () => {
    assert.equal(extractQuantities('ambient temperature 22 °C, 21 % oxygen').ambient_temperature, '22 °C');
    const e = extractQuantities('a flame at 1200 K and 21 % oxygen');
    assert.equal(e.ambient_temperature, undefined);
    assert.deepEqual(e.leftover, ['1200 K']);
  });
  it('two different values for one quantity are never resolved: issue and leftover', () => {
    const e = extractQuantities('21 % oxygen at 8.2 psia or 14.7 psia');
    assert.equal(e.pressure, undefined);
    assert.equal(e.issues[0].code, 'multiple_values');
    assert.deepEqual(e.leftover, ['8.2 psia', '14.7 psia']);
  });
  it('two spellings of the same value are fine: "8.2 psia (56.54 kPa)"', () => {
    assert.equal(extractQuantities('34% oxygen at 8.2 psia (56.54 kPa)').pressure, '8.2 psia');
  });
  it('ambiguous or conflicting gravity: nothing assigned, issue raised', () => {
    const a = extractQuantities('Moon and Mars at 30% oxygen');
    assert.equal(a.gravity, undefined);
    assert.equal(a.issues[0].code, 'ambiguous_gravity');
    const b = extractQuantities('lunar base at 1 g and 30% oxygen');
    assert.equal(b.gravity, undefined);
    assert.equal(b.issues[0].code, 'gravity_conflict');
    assert.equal(extractQuantities('lunar base at 0.165 g and 30% oxygen').gravity, '0.165 g');
  });
  it('fraction gravity "1/6 g" is one value; codes like "PSI-12" are not numbers', () => {
    const e = extractQuantities('at 1/6 g, 30% oxygen; PSI-12 says nothing');
    assert.equal(e.gravity, '1/6 g');
    assert.deepEqual(e.leftover, []);
  });
  it('numbers with no recognised unit go to leftover', () => {
    const e = extractQuantities('test 7 at 21 % oxygen');
    assert.deepEqual(e.leftover, ['7']);
  });
});

describe('extractQuantities over the judge battery (validation/judge_battery/questions.json)', () => {
  const file = join(import.meta.dirname, '..', '..', 'validation', 'judge_battery', 'questions.json');
  if (!existsSync(file)) {
    it('battery file absent: skipped', () => {});
    return;
  }
  const battery = JSON.parse(readFileSync(file, 'utf8')) as {
    groups: { id: string; expect: { gravity_regime?: string; o2_mole_fraction: number; pressure_kpa?: number; unstated?: string[] }; questions: string[] }[];
    traps: { id: string; question: string; expect: string }[];
  };
  it('has the 31 member questions and 11 traps this test was written for (EN + ES)', () => {
    assert.equal(battery.groups.reduce((n, g) => n + g.questions.length, 0), 31);
    assert.equal(battery.traps.length, 11);
  });
  for (const g of battery.groups) {
    for (const question of g.questions) {
      it(`[${g.id}] ${question}`, () => {
        const e = extractQuantities(question);
        const t = targetFromQuantities(e);
        assert.ok(t.ok, JSON.stringify(t));
        assert.equal(e.leftover.length, 0, `leftover: ${e.leftover}`);
        assert.equal(e.issues.length, 0);
        if (g.expect.gravity_regime) assert.equal(t.target.regime.gravity_regime, g.expect.gravity_regime);
        assert.ok(Math.abs((t.target.continuous.o2_mole_fraction as number) - g.expect.o2_mole_fraction) < 1e-9);
        if (g.expect.pressure_kpa !== undefined) {
          // 101.3 kPa or 14.7 psia for 1 atm: within the 0.5 % measurement tolerance the engine uses.
          assert.ok(Math.abs((t.target.continuous.pressure as number) - g.expect.pressure_kpa) <= 0.005 * g.expect.pressure_kpa);
        } else assert.equal(t.target.continuous.pressure, undefined);
      });
    }
  }
  it('every question of one group gives the same regime, O2 and pressure (within tolerance)', () => {
    for (const g of battery.groups) {
      const ts = g.questions.map((q) => targetFromQuantities(extractQuantities(q)));
      assert.ok(ts.every((t) => t.ok));
      const regimes = new Set(ts.map((t) => (t.ok ? t.target.regime.gravity_regime : '')));
      assert.equal(regimes.size, 1, g.id);
    }
  });
  const trap = (id: string) => battery.traps.find((t) => t.id === id)!.question;
  it('traps: gauge pressure and impossible values and an ambiguous comma fail with typed errors', () => {
    const codes = (id: string) => {
      const t = targetFromQuantities(extractQuantities(trap(id)));
      return t.ok ? [] : t.errors.map((x) => x.code);
    };
    assert.deepEqual(codes('gauge-pressure'), ['gauge_pressure']);
    assert.deepEqual(codes('impossible-values'), ['percent_out_of_range', 'out_of_range']);
    assert.deepEqual(codes('ambiguous-thousands-comma'), ['ambiguous_decimal_separator']);
  });
  it('traps: a partial pressure is not used; no-condition, out-of-scope and harmful questions extract nothing', () => {
    const pp = extractQuantities(trap('oxygen-partial-pressure'));
    assert.equal(pp.pressure, undefined);
    assert.equal(pp.issues[0].code, 'partial_pressure');
    for (const id of ['harmful', 'out-of-scope', 'harmful-spanish', 'no-condition']) {
      const e = extractQuantities(trap(id));
      assert.deepEqual([e.gravity, e.o2, e.pressure, e.leftover.length], [undefined, undefined, undefined, 0], id);
    }
  });
  it('traps: the injected PSI-12 is not a number; a 2 mm length is not oxygen; typos are never guessed', () => {
    const inj = extractQuantities(trap('prompt-injection'));
    assert.deepEqual([inj.gravity, inj.o2, inj.pressure, inj.leftover], ['microgravity', '21%', '1 atm', []]);
    const th = extractQuantities(trap('thickness-number-not-oxygen'));
    assert.deepEqual([th.gravity, th.o2, th.pressure, th.sample_thickness, th.leftover], ['microgravity', '21 %', '1 atm', undefined, ['2 mm']]);
    const ty = extractQuantities(trap('typos'));
    assert.equal(ty.o2, undefined);
    assert.equal(ty.gravity, undefined);
    assert.deepEqual(ty.leftover, ['21%']);
  });
});
