// Stretch-rate formulas (docs/TRANSFER.md). Inputs are plain numbers chosen to check the algebra and
// the paper's own printed range; they are not measurements.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DENSITY_FACTOR_PMMA_AIR,
  buoyantStretch,
  densityFactorFromTemperatures,
  forcedStretchCylinder,
  forcedStretchRodTip,
  SOURCE,
  mixedStretch,
} from '../src/stretch.ts';

const close = (a: number, b: number, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

describe('forced stretch', () => {
  it('cylinder: 2U/R', () => {
    const r = forcedStretchCylinder(10, 2);
    assert.deepEqual(r.value, { lo: 10, hi: 10 });
    assert.equal(r.formulaId, 'OT2000-af-cylinder');
    assert.equal(r.unit, 's-1');
  });

  it('rod tip: 3/2 U/R', () => {
    assert.deepEqual(forcedStretchRodTip(10, 2).value, { lo: 7.5, hi: 7.5 });
  });

  it('bands propagate (more flow raises, more radius lowers)', () => {
    const r = forcedStretchCylinder({ lo: 10, hi: 20 }, { lo: 1, hi: 2 });
    assert.deepEqual(r.value, { lo: 10, hi: 40 });
  });

  it('every result cites file, page and quote, and lists its inputs', () => {
    for (const r of [forcedStretchCylinder(5, 1), forcedStretchRodTip(5, 1)]) {
      assert.ok(r.sources.length >= 1);
      for (const s of r.sources) {
        assert.ok(s.file.startsWith('ntrs-') && s.page > 0 && s.quote.length > 10);
      }
      assert.ok(r.inputs.U && r.inputs.R);
    }
  });

  it('rejects R <= 0, negative flow, lo > hi, non-finite', () => {
    assert.throws(() => forcedStretchCylinder(5, 0), RangeError);
    assert.throws(() => forcedStretchCylinder(-1, 1), RangeError);
    assert.throws(() => forcedStretchCylinder({ lo: 3, hi: 2 }, 1), RangeError);
    assert.throws(() => forcedStretchCylinder(Number.NaN, 1), TypeError);
  });
});

describe('density factor', () => {
  it('temperature form (T* - Te)/T*', () => {
    const f = densityFactorFromTemperatures({ lo: 800, hi: 1000 }, 300);
    close(f.lo, 0.625);
    close(f.hi, 0.7);
  });

  it('the PMMA-in-air band comes from T* = 865-990 K and Te = 295.15 K, with sources', () => {
    close(DENSITY_FACTOR_PMMA_AIR.lo, 1 - 295.15 / 865);
    close(DENSITY_FACTOR_PMMA_AIR.hi, 1 - 295.15 / 990);
    assert.ok(DENSITY_FACTOR_PMMA_AIR.lo > 0.65 && DENSITY_FACTOR_PMMA_AIR.hi < 0.71);
    assert.deepEqual(DENSITY_FACTOR_PMMA_AIR.sources.map((s) => s.page), [11, 6]);
  });

  it('rejects Te >= T*', () => {
    assert.throws(() => densityFactorFromTemperatures(300, 300), RangeError);
  });
});

describe('buoyant stretch', () => {
  it("reproduces the paper's own printed range: R = 2.5-200 cm gives 2-16 s^-1 (p. 6) and 1.8 s^-1 at the large end (p. 11)", () => {
    const small = buoyantStretch(1, 2.5, DENSITY_FACTOR_PMMA_AIR);
    const large = buoyantStretch(1, 200, DENSITY_FACTOR_PMMA_AIR);
    assert.ok(small.value.lo > 15 && small.value.hi < 17, JSON.stringify(small.value));
    assert.ok(large.value.lo > 1.75 && large.value.hi < 1.9, JSON.stringify(large.value));
  });

  it("documented discrepancy: the p. 3 form (factor outside the root) does not reproduce the paper's numbers; the engine has one formula", () => {
    const f = DENSITY_FACTOR_PMMA_AIR;
    const p3Small = f.hi * Math.sqrt(980 / 2.5); // p. 3 as printed
    const eq1Small = buoyantStretch(1, 2.5, f).value.hi; // p. 11 Eqn. 1
    assert.ok(p3Small < 14.5, `p3 ${p3Small}`); // paper says 2-16 s-1 for R = 2.5-200 cm (p. 6)
    assert.ok(eq1Small > 16 && eq1Small < 17, `eq1 ${eq1Small}`);
    assert.equal(buoyantStretch(1, 2.5, f).formulaId, 'OT2000-ab-eq1');
    assert.equal(SOURCE.discrepancyP3.page, 3);
  });

  it('exact algebra for a point factor', () => {
    // F = 0.5, g = 1 g_earth = 980 cm/s2, R = 490 cm: sqrt(0.5 * 2) = 1
    close(buoyantStretch(1, 490, 0.5).value.lo, 1);
  });

  it('lower gravity gives lower stretch at the same radius; zero gravity gives zero', () => {
    const moon = buoyantStretch(0.165, 10, 0.68).value.lo;
    const earth = buoyantStretch(1, 10, 0.68).value.lo;
    assert.ok(moon < earth);
    close(earth / moon, Math.sqrt(1 / 0.165), 1e-9);
    assert.equal(buoyantStretch(0, 10, 0.68).value.hi, 0);
  });

  it('a band in the factor gives a band in the result', () => {
    const r = buoyantStretch(1, 10, DENSITY_FACTOR_PMMA_AIR);
    assert.ok(r.value.lo < r.value.hi);
    assert.equal(r.inputs['density factor (rho_e - rho*)/rho_e'].value.lo, DENSITY_FACTOR_PMMA_AIR.lo);
  });

  it('the density factor is required and must be in (0, 1]', () => {
    assert.throws(() => buoyantStretch(1, 10, 1.2), RangeError);
    assert.throws(() => buoyantStretch(1, 10, 0), RangeError);
  });

  it('cites the p. 11 equation for the default form', () => {
    assert.ok(buoyantStretch(1, 10, 0.68).sources.some((s) => s.page === 11 && s.quote.includes('990 K to 865 K')));
  });
});

describe('mixed stretch', () => {
  it('a = a_f (1 + a_b²/a_f²)^½ equals sqrt(a_f² + a_b²), also as bands', () => {
    const af = forcedStretchCylinder(30, 10); // 6 s-1
    const ab = buoyantStretch(1, 490, 0.5); // 1 s-1
    const m = mixedStretch(af, ab);
    close(m.value.lo, 6 * Math.sqrt(1 + 1 / 36));
    assert.equal(m.formulaId, 'OT2000-mixed');
  });

  it('with no flow a = a_b (the case the paper uses)', () => {
    const ab = buoyantStretch(1, 490, 0.5);
    assert.deepEqual(mixedStretch(forcedStretchCylinder(0, 10), ab).value, ab.value);
  });
});
