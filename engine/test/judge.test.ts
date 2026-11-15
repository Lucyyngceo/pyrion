// "Same physics in different words must give identical verdicts" (judge battery).
// SYNTHETIC records (PSI-9201, PSI-9202, PSI-9203), not NASA data: every test at exactly 1 atm, like PSI-23.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildEnvelopes,
  locateTarget,
  MEASUREMENT_TOLERANCE_NOTE,
  MEASUREMENT_TOLERANCE_REL,
  MICROGRAVITY_CONVENTION_NOTE,
  evaluate,
  parseConditionCsv,
  parseQuantity,
  targetFromQuantities,
  type ConditionRecord,
  type Quantity,
  type QuantityVariable,
} from '../src/index.ts';

const HEAD = 'accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note';
const row = (acc: string, test: string, variable: string, value: string, unit = '') =>
  `${acc},${test},${variable},${value},${unit},${value},${unit},table,SYNTHETIC/${acc}.csv,row=0,SYNTHETIC TEST FIXTURE,verified,SYNTHETIC - not NASA data`;
function records(): ConditionRecord[] {
  const lines = [HEAD];
  for (const acc of ['PSI-9201', 'PSI-9202']) {
    lines.push(row(acc, '*', 'gravity_regime', 'microgravity'), row(acc, '*', 'fuel_phase', 'solid'), row(acc, '*', 'diluent', 'N2'));
  }
  // PSI-9201: one point (21 %, 1 atm). PSI-9202: a zero-width segment in pressure (17 % to 30 % O2, all at 1 atm).
  lines.push(row('PSI-9201', 'T1', 'o2_mole_fraction', '0.21', '1'), row('PSI-9201', 'T1', 'pressure', '101.325', 'kPa'));
  lines.push(row('PSI-9202', 'T1', 'o2_mole_fraction', '0.17', '1'), row('PSI-9202', 'T1', 'pressure', '101.325', 'kPa'));
  lines.push(row('PSI-9202', 'T2', 'o2_mole_fraction', '0.30', '1'), row('PSI-9202', 'T2', 'pressure', '101.325', 'kPa'));
  const r = parseConditionCsv(lines.join('\n'), 'synthetic.csv');
  assert.deepEqual(r.rejected, []);
  return r.records;
}
const q = (t: string, v: QuantityVariable) => {
  const r = parseQuantity(t, v);
  assert.ok(r.ok, JSON.stringify(r));
  return r as Quantity;
};
const verdictFor = (acc: string, pressure: string, o2 = '21 %') => {
  const t = targetFromQuantities({ gravity: 'microgravity', o2, pressure });
  assert.ok(t.ok, JSON.stringify(t));
  const ev = evaluate(records(), t.target);
  return [...ev.ranked, ...ev.unranked].find((c) => c.accession === acc)!;
};

describe('E1: measurement tolerance on a zero-width envelope', () => {
  for (const acc of ['PSI-9201', 'PSI-9202']) {
    it(`${acc}: 101.325, 101.3, 101.33, 760 mmHg, 14.7 psia, 1 atm all give the same verdict (APPLICABLE)`, () => {
      for (const p of ['101.325 kPa', '101.3 kPa', '101.33 kPa', '760 mmHg', '14.7 psia', '1 atm', 'sea level']) {
        assert.equal(verdictFor(acc, p).verdict, 'APPLICABLE', `${acc} ${p}`);
      }
    });
  }
  it('101.325024 kPa (760 mmHg via 0.1333224) is the same as 101.325', () => {
    assert.ok(Math.abs(q('760 mmHg', 'pressure').value - 101.325024) < 1e-6);
    assert.equal(verdictFor('PSI-9201', '760 mmHg').verdict, 'APPLICABLE');
  });
  it('a value clearly outside is still EXTRAPOLATION (110 kPa, 8.6 % off)', () => {
    for (const acc of ['PSI-9201', 'PSI-9202']) assert.equal(verdictFor(acc, '110 kPa').verdict, 'EXTRAPOLATION', acc);
  });
  it('just outside the tolerance is EXTRAPOLATION; just inside is APPLICABLE', () => {
    const edge = 101.325 * (1 + MEASUREMENT_TOLERANCE_REL);
    assert.equal(verdictFor('PSI-9201', `${edge - 0.01} kPa`).verdict, 'APPLICABLE');
    assert.equal(verdictFor('PSI-9201', `${edge + 0.01} kPa`).verdict, 'EXTRAPOLATION');
  });
  it('the tolerance applies to O2 as well: 21.05 % counts as the tested 21 %, 22 % does not', () => {
    assert.equal(verdictFor('PSI-9201', '1 atm', '21.05 %').verdict, 'APPLICABLE');
    assert.equal(verdictFor('PSI-9201', '1 atm', '22 %').verdict, 'EXTRAPOLATION');
  });
  it('a region whose tests all sit at one pressure is called a line: "inside the tested oxygen span, at one pressure"', () => {
    const msgs = verdictFor('PSI-9201', '1 atm').reasons.map((r) => r.message).join(' ');
    assert.match(msgs, /Inside the tested oxygen span, at one pressure: all \d+ tested conditions? (is|are) at/);
  });
  it('the reason says the tolerance is what made it count as inside, and names the convention', () => {
    const c = verdictFor('PSI-9201', '101.3 kPa');
    const msgs = c.reasons.map((r) => r.message).join('\n');
    assert.match(msgs, /within the 0\.5 % measurement tolerance of the tested 101\.3 kPa/);
    assert.match(msgs, /within the 0\.5 % measurement tolerance of the region covered by/);
    assert.ok(msgs.includes(MEASUREMENT_TOLERANCE_NOTE));
    assert.match(MEASUREMENT_TOLERANCE_NOTE, /PYRION convention, not a NASA value/);
    assert.equal(c.axes.find((a) => a.axis === 'pressure')?.viaTolerance, true);
    assert.equal(c.hull?.viaTolerance, true);
  });
  it('an exact hit does not mention the tolerance and carries no flag', () => {
    const c = verdictFor('PSI-9201', '101.325 kPa');
    assert.ok(!c.reasons.some((r) => r.message.includes('tolerance')));
    assert.equal(c.axes.find((a) => a.axis === 'pressure')?.viaTolerance, undefined);
  });
  it('a normal (non-degenerate) hull gets the same tolerance at its edge', () => {
    const lines = [HEAD, row('PSI-9203', '*', 'gravity_regime', 'microgravity')];
    for (const [t, o2, p] of [['T1', '0.17', '70'], ['T2', '0.30', '70'], ['T3', '0.25', '101.325']]) {
      lines.push(row('PSI-9203', t, 'o2_mole_fraction', o2, '1'), row('PSI-9203', t, 'pressure', p, 'kPa'));
    }
    const recs = parseConditionCsv(lines.join('\n'), 's.csv').records;
    const at = (o2: number, p: number) =>
      evaluate(recs, { regime: { gravity_regime: 'microgravity' }, continuous: { o2_mole_fraction: o2, pressure: p } }).investigations[0].verdict;
    assert.equal(at(0.25, 101.325), 'APPLICABLE'); // a vertex
    assert.equal(at(0.25, 101.5), 'APPLICABLE'); // 0.17 % above the apex, inside the tolerance
    assert.equal(at(0.25, 103), 'EXTRAPOLATION'); // 1.7 % above
    assert.equal(at(0.22, 90), 'APPLICABLE'); // plainly inside
  });
  it('the verdict does not depend on how the same pressure is written', () => {
    const v = ['101.325 kPa', '101.3 kPa', '1 atm', '14.7 psia', '760 mmHg', '760 torr', 'normal air pressure'].map((p) => verdictFor('PSI-9202', p).verdict);
    assert.equal(new Set(v).size, 1);
  });
});

describe('E2: gravity words a judge will type', () => {
  const micro = ['freefall', 'free fall', 'free-fall', 'in freefall', 'Free Fall', 'weightless', 'in orbit', 'orbital', 'micro-g', 'µg', 'μg', 'ug', 'microgravedad', 'ingravidez', 'caída libre', 'caida libre', 'gravedad cero'];
  for (const t of micro) {
    it(`"${t}" is microgravity with the convention note`, () => {
      const r = q(t, 'gravity_level');
      assert.equal(r.gravity_regime, 'microgravity');
      assert.ok(r.notes.includes(MICROGRAVITY_CONVENTION_NOTE));
    });
  }
  it('Spanish Moon, Mars and Earth', () => {
    for (const t of ['Luna', 'luna', 'la Luna', 'lunar', 'gravedad lunar']) assert.equal(q(t, 'gravity_level').value, 0.165, t);
    for (const t of ['Marte', 'marciano', 'marciana', 'gravedad marciana', 'gravedad de Marte']) assert.equal(q(t, 'gravity_level').value, 0.38, t);
    for (const t of ['Tierra', 'gravedad normal', 'gravedad terrestre']) {
      const r = q(t, 'gravity_level');
      assert.equal(r.value, 1, t);
      assert.equal(r.gravity_regime, 'normal_gravity', t);
    }
  });
  it('"nivel del mar" and "presión normal" are 101.325 kPa; "por ciento" is percent', () => {
    for (const t of ['nivel del mar', 'presión normal', 'presion normal', 'Presión estándar']) assert.ok(Math.abs(q(t, 'pressure').value - 101.325) < 1e-9, t);
    assert.ok(Math.abs(q('34 por ciento', 'o2_mole_fraction').value - 0.34) < 1e-12);
    assert.ok(Math.abs(q('34 por ciento de oxígeno', 'o2_mole_fraction').value - 0.34) < 1e-12);
  });
  it('decimal comma: "8,2 psia" and "1,5 atm" work', () => {
    assert.ok(Math.abs(q('8,2 psia', 'pressure').value - 8.2 * 6.894757) < 1e-9);
    assert.ok(Math.abs(q('1,5 atm', 'pressure').value - 151.9875) < 1e-9);
    assert.ok(Math.abs(q('0,34', 'o2_mole_fraction').value - 0.34) < 1e-12);
    assert.ok(Math.abs(q('0,17 g', 'gravity_level').value - 0.17) < 1e-12);
  });
  it('a comma after a leading 0 is always decimal: "0,165 g", "0,38 g", "0,5 atm", "0,1234 atm"', () => {
    assert.ok(Math.abs(q('0,165 g', 'gravity_level').value - 0.165) < 1e-12);
    assert.ok(Math.abs(q('0,38 g', 'gravity_level').value - 0.38) < 1e-12);
    assert.ok(Math.abs(q('0,5 atm', 'pressure').value - 50.6625) < 1e-9);
    assert.ok(Math.abs(q('0,340', 'o2_mole_fraction').value - 0.34) < 1e-12);
    assert.ok(Math.abs(q('1,5000 atm', 'pressure').value - 151.9875) < 1e-9); // four digits cannot be a thousands group
  });
  it('a nonzero integer part with a comma and exactly three digits is still refused: "1,000", "101,325", "8,200 psia"', () => {
    for (const [t, v] of [['1,000 atm', 'pressure'], ['101,325 kPa', 'pressure'], ['8,200 psia', 'pressure'], ['1,340', 'o2_mole_fraction']] as const) {
      const e = parseQuantity(t, v);
      assert.ok(!e.ok && e.code === 'ambiguous_decimal_separator', t);
    }
  });
  it('"101,325" and other three-digit or repeated commas are refused with the advice to write 101.325 or 101325', () => {
    for (const t of ['101,325 kPa', '101,325', '1,000 Pa', '1,000,000 Pa']) {
      const e = parseQuantity(t, 'pressure');
      assert.ok(!e.ok, t);
      assert.equal(!e.ok && e.code, 'ambiguous_decimal_separator');
      assert.match(!e.ok ? e.message : '', /101\.325 \(decimal point\) or 101325/);
    }
  });
  it('anything else ambiguous still fails with a typed error', () => {
    for (const t of ['gravity', 'caída libre en Marte', 'the weather', 'g']) {
      const e = parseQuantity(t, 'gravity_level');
      assert.ok(!e.ok, t);
    }
  });
});

describe('locateTarget uses the same measurement tolerance as the verdict', () => {
  const place = (pressure: string) => {
    const t = targetFromQuantities({ gravity: 'microgravity', o2: '21 %', pressure });
    assert.ok(t.ok);
    const recs = records();
    const ev = evaluate(recs, t.target);
    const loc = locateTarget(t.target, buildEnvelopes(recs));
    return { ev, loc };
  };
  it('101.3 kPa: inside for evaluate() and for locateTarget(), flagged viaTolerance, on the edge (distance 0)', () => {
    const { ev, loc } = place('101.3 kPa');
    const v = [...ev.ranked, ...ev.unranked].filter((c) => c.accession.startsWith('PSI-92'));
    assert.ok(v.every((c) => c.verdict === 'APPLICABLE'));
    assert.equal(loc.length, 1);
    assert.equal(loc[0].insideHull, true);
    assert.equal(loc[0].insideRanges, true);
    assert.equal(loc[0].viaTolerance, true);
    assert.equal(loc[0].hullDistance, 0);
    assert.ok(loc[0].investigations.every((i) => i.insideHull === true && i.viaTolerance === true));
  });
  it('an exact 101.325 kPa is inside without the flag; 110 kPa is outside for both', () => {
    const a = place('101.325 kPa').loc[0];
    assert.equal(a.insideHull, true);
    assert.equal(a.viaTolerance, undefined);
    const b = place('110 kPa');
    assert.equal(b.loc[0].insideHull, false);
    assert.equal(b.loc[0].insideRanges, false);
    assert.ok((b.loc[0].hullDistance as number) > 0);
    assert.ok([...b.ev.ranked, ...b.ev.unranked].filter((c) => c.accession.startsWith('PSI-92')).every((c) => c.verdict === 'EXTRAPOLATION'));
  });
  it('for every spelling of 1 atm, the verdict and the chart agree', () => {
    for (const p of ['101.3 kPa', '101.33 kPa', '760 mmHg', '14.7 psia', '1 atm', '110 kPa', '120 kPa', '100 kPa']) {
      const { ev, loc } = place(p);
      const verdictInside = [...ev.ranked, ...ev.unranked].filter((c) => c.accession.startsWith('PSI-92')).every((c) => c.verdict === 'APPLICABLE');
      assert.equal(loc[0].insideHull, verdictInside, p);
    }
  });
});
