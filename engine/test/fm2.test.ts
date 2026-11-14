// FM2 closed-chamber balance. The check case is the PMMA estimate in NTRS 20260001966 p. 26.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FM2_SOURCES, M_O2, PMMA_STOICH, fm2Balance, fm2Chamber, fm2FinalO2, stoichO2PerGramFuel } from '../src/fm2.ts';
import { KPA_PER_PSI } from '../src/presets.ts';

const close = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const ASSUME_T = { value: 295, unit: 'K', source: { note: 'ASSUMPTION for this test only: the source does not state the chamber temperature' } };

const chamber = (x0: number, L: number, T = ASSUME_T) =>
  fm2Chamber({
    temperatureK: T,
    startO2Fraction: { value: x0, unit: '1', source: FM2_SOURCES.checkCase },
    limitO2Fraction: { value: L, unit: '1', source: { note: 'hypothesis supplied by the caller' } },
    stoichGO2PerGFuel: PMMA_STOICH,
  });

describe('FM2 balance', () => {
  it('stoichiometry of PMMA: 1.9176 g O2 per g fuel', () => {
    close(PMMA_STOICH.value, (6 * 31.998) / (5 * 12.011 + 8 * 1.008 + 2 * 15.999));
    assert.ok(Math.abs(PMMA_STOICH.value - 1.9176) < 1e-3);
    // methane: CH4 + 2 O2 -> 4 g O2 per g
    assert.ok(Math.abs(stoichO2PerGramFuel({ C: 1, H: 4, O: 0 }) - (2 * 31.998) / 16.043) < 1e-9);
    assert.throws(() => stoichO2PerGramFuel({ C: 0, H: 0, O: 2 }), RangeError);
  });

  it('ideal-gas arithmetic: n = PV/RT, consumable = n (x0 - L)', () => {
    const b = fm2Balance(chamber(0.34, 0.24));
    close(b.nTotalMol, (8.2 * KPA_PER_PSI * 14.4) / (8.314462618 * 295));
    close(b.o2ConsumableMol, b.nTotalMol * 0.1);
    close(b.o2ConsumableG, b.o2ConsumableMol * M_O2);
    close(b.fuelBurnedG, b.o2ConsumableG / PMMA_STOICH.value);
    assert.equal(b.finalO2Fraction, 0.24);
    assert.equal(b.startAboveLimit, true);
  });

  it('check case: 34 % O2, 8.2 psia, 1.2 g of PMMA gives a final O2 of about 12-13 %, against NASA 13-21 %', () => {
    // Temperature is not in the source; the result is shown over 290-300 K.
    for (const T of [290, 295, 300]) {
      const out = fm2FinalO2(chamber(0.34, 0.13, { value: T, unit: 'K', source: { note: 'ASSUMPTION: 290-300 K' } }), 1.2);
      assert.ok(out.finalO2Fraction > 0.119 && out.finalO2Fraction < 0.128, `T=${T}: ${out.finalO2Fraction}`);
      assert.equal(out.exceedsChamberO2, false);
    }
    // 1.2 g is the most the source says was burned, so this is the lowest final O2 of the model: it sits
    // about one percentage point under NASA's lower bound of 13 %, with all fuel burned completely to CO2 and H2O.
    const mid = fm2FinalO2(chamber(0.34, 0.13), 1.2).finalO2Fraction;
    assert.ok(mid < 0.13 && 0.13 - mid < 0.012);
  });

  it('less fuel burned leaves more O2, up to the starting fraction', () => {
    const c = chamber(0.34, 0.13);
    assert.equal(fm2FinalO2(c, 0).finalO2Fraction, 0.34);
    assert.ok(fm2FinalO2(c, 0.3).finalO2Fraction > fm2FinalO2(c, 1.2).finalO2Fraction);
  });

  it('flags a fuel mass below the hypothesised limit, and one that needs more O2 than the chamber holds', () => {
    const c = chamber(0.34, 0.25);
    assert.equal(fm2FinalO2(c, 1.2).belowLimit, true);
    assert.equal(fm2FinalO2(c, 0.1).belowLimit, false);
    const big = fm2FinalO2(c, 50);
    assert.equal(big.exceedsChamberO2, true);
    assert.equal(big.finalO2Fraction, 0);
  });

  it('a start at or below the limit consumes nothing', () => {
    const b = fm2Balance(chamber(0.2, 0.25));
    assert.equal(b.o2ConsumableMol, 0);
    assert.equal(b.fuelBurnedG, 0);
    assert.equal(b.startAboveLimit, false);
  });

  it('returns assumptions and formulas as data, and every input has a source', () => {
    const b = fm2Balance(chamber(0.34, 0.24));
    assert.ok(b.assumptions.some((a) => a.includes('mole change from products is ignored')));
    assert.ok(b.assumptions.some((a) => a.includes('Ideal gas')));
    assert.equal(b.formulas.length, 3);
    for (const v of Object.values(b.inputs)) assert.ok('source' in v && v.source !== undefined);
    assert.equal(b.inputs.volumeL.value, 14.4);
    assert.equal((b.inputs.volumeL.source as { page: number }).page, 6);
  });

  it('rejects impossible inputs', () => {
    assert.throws(() => fm2Balance(chamber(1.2, 0.2)), RangeError);
    assert.throws(() => fm2Balance(chamber(0.3, 0.2, { value: 0, unit: 'K', source: { note: 'x' } })), RangeError);
    assert.throws(() => fm2FinalO2(chamber(0.3, 0.2), -1), RangeError);
  });

  it('is deterministic', () => {
    assert.equal(JSON.stringify(fm2Balance(chamber(0.34, 0.24))), JSON.stringify(fm2Balance(chamber(0.34, 0.24))));
  });
});
