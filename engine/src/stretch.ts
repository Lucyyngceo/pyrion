// Flame stretch rate: forced, buoyant and mixed (docs/TRANSFER.md).
// Pure functions, no I/O. Every result carries the formula id, the formula, the inputs and the
// NASA source (file under data/raw/nasa/, page, quote). Any input may be a band {lo, hi}; the result
// is then a band, propagated through the formula by monotonicity (every formula here is monotone
// in each input), never a point. Nothing in this file is a measured value.

/** A closed interval. A single value is the band with lo === hi. */
export interface Band {
  lo: number;
  hi: number;
}
export type Input = number | Band;

export interface SourceCitation {
  /** Path under data/raw/nasa/ */
  file: string;
  /** Page of the PDF (1-based) */
  page: number;
  quote: string;
  /** What the quote supports, in plain words. */
  supports: string;
}

export interface StretchResult {
  /** Stretch rate in s^-1, as a band. */
  value: Band;
  unit: 's-1';
  formulaId: StretchFormulaId;
  formula: string;
  inputs: Record<string, { value: Band; unit: string }>;
  sources: SourceCitation[];
  assumptions: string[];
}

export type StretchFormulaId =
  | 'OT2000-af-cylinder'
  | 'OF2015-af-rod-tip'
  | 'OT2000-ab-eq1'
  | 'OT2000-mixed';

/** Standard gravity as given in the paper's nomenclature: g = 980 cm/s^2. */
export const G_EARTH_CM_S2 = 980;

const OT = 'ntrs-20000004509/20000004509.pdf';
const OF = 'ntrs-20150008961/20150008961.pdf';

export const SOURCE = {
  cylinder: {
    file: OT,
    page: 3,
    quote: 'For purely forced flow, the equivalent stretch rate is characterized by either af = 2U∞/R for a cylinder',
    supports: 'forced stretch rate of a cylinder of radius R in a flow U∞',
  },
  mixed: {
    file: OT,
    page: 3,
    quote: 'A generalized expression for stretch rate due to mixed convection includes both buoyant and forced stretch, and is defined as a = af(1 + ab²/af²)^½.',
    supports: 'mixed stretch rate; for af = 0 the paper uses a = ab (p. 3, "In the experiments reported herein, af=0")',
  },
  /** NOT used by any formula. Kept to document the discrepancy: p. 3 prints the density factor outside the root. */
  discrepancyP3: {
    file: OT,
    page: 3,
    quote: 'For purely buoyant flow, the equivalent stretch rate is ab = [(ρe-ρ*)/ρe] [g/R]½',
    supports: 'buoyant stretch rate, as printed on p. 3 (the ½ follows [g/R])',
  },
  buoyantEq1: {
    file: OT,
    page: 11,
    quote: 'The stretch rate is defined in Eqn. 1. For these experiments, T* ranged from 990 K to 865 K, and a ranged from 1.8-11.9 sec-1.  a = [((T* - Te)/T*) g/R]^½',
    supports: 'buoyant stretch rate, Eqn. 1 on p. 11 (density factor inside the root, written with temperatures); T* range of the PMMA experiments',
  },
  rangeCheck: {
    file: OT,
    page: 6,
    quote: 'The range of stretch rates of interest is 2-16 sec-1, which correspond to approximate radii of 2.5-200 cm.',
    supports: 'check of the formula: R = 2.5-200 cm gives 2-16 s^-1 only with the p. 11 form of the buoyant stretch',
  },
  labTemperature: {
    file: OT,
    page: 6,
    quote: 'Humidity and temperature in the lab were held consistently at 55% relative humidity and 22° C',
    supports: 'ambient temperature Te of the experiments (22 °C = 295.15 K)',
  },
  nomenclature: {
    file: OT,
    page: 27,
    quote: 'g gravitational acceleration, 980 cm/s2 ... R radius of curvature, cm ... ρe ambient air density, 1.176 kg/m3 ... ρ* air density at T*',
    supports: 'units (R in cm, g = 980 cm/s2) and the definition of the density factor',
  },
  rodTip: {
    file: OF,
    page: 7,
    quote: 'The flow-induced stretch around the approximately spherical rod tip is af = 3/2 U/R.',
    supports: 'forced stretch rate at a rod tip of radius R in a flow U',
  },
} as const satisfies Record<string, SourceCitation>;

// ---------- bands ----------

export function toBand(x: Input, name: string): Band {
  const b = typeof x === 'number' ? { lo: x, hi: x } : x;
  if (!Number.isFinite(b.lo) || !Number.isFinite(b.hi)) throw new TypeError(`${name}: must be finite`);
  if (b.lo > b.hi) throw new RangeError(`${name}: lo must not exceed hi`);
  return { lo: b.lo, hi: b.hi };
}

function positive(b: Band, name: string): Band {
  if (b.lo <= 0) throw new RangeError(`${name}: must be greater than 0`);
  return b;
}

function nonNegative(b: Band, name: string): Band {
  if (b.lo < 0) throw new RangeError(`${name}: must not be negative`);
  return b;
}

// ---------- density factor ----------

/**
 * Density factor (ρe − ρ*)/ρe written with temperatures, as in Eqn. 1 of the source: (T* − Te)/T*.
 * Assumption: the air is an ideal gas at constant pressure, so ρ ∝ 1/T. Te and T* in K.
 */
export function densityFactorFromTemperatures(tStar: Input, te: number): Band {
  const t = positive(toBand(tStar, 'T*'), 'T*');
  if (!(te > 0) || te >= t.lo) throw new RangeError('densityFactor: need 0 < Te < T*');
  return { lo: 1 - te / t.lo, hi: 1 - te / t.hi };
}

/**
 * The only density factor the source supports: PMMA flames in air as in Olson & T'ien (2000),
 * T* = 865 to 990 K (p. 11) and Te = 22 °C = 295.15 K (p. 6). It is a band, not a value, and it
 * holds for those flames only: another fuel, another O2 level or another pressure changes T*,
 * so for other conditions the factor is a required input.
 */
export const DENSITY_FACTOR_PMMA_AIR: Band & { sources: SourceCitation[]; tStarK: Band; teK: number; assumptions: string[] } = {
  ...densityFactorFromTemperatures({ lo: 865, hi: 990 }, 295.15),
  tStarK: { lo: 865, hi: 990 },
  teK: 295.15,
  sources: [SOURCE.buoyantEq1, SOURCE.labTemperature],
  assumptions: [
    'The paper gives no single density factor. This band is (T* - Te)/T* from the paper’s own Eqn. 1 with T* = 865 to 990 K and Te = 22 °C.',
    'Ideal gas at constant pressure (rho proportional to 1/T) turns the density factor (rho_e - rho*)/rho_e into the temperature ratio (T* - Te)/T*.',
    'Valid for PMMA flames in air as in the paper; not for other fuels, oxygen levels or pressures.',
  ],
};

// ---------- formulas ----------

function entry(b: Band, unit: string) {
  return { value: b, unit };
}

/** a_f = 2 U / R for a cylinder of radius R (cm) in a flow U (cm/s). Result in s^-1. */
export function forcedStretchCylinder(flowCmS: Input, radiusCm: Input): StretchResult {
  return forced('OT2000-af-cylinder', 'a_f = 2 U / R', 2, flowCmS, radiusCm, SOURCE.cylinder);
}

/** a_f = 3/2 U / R at the approximately spherical tip of a rod of radius R (cm) in a flow U (cm/s). */
export function forcedStretchRodTip(flowCmS: Input, radiusCm: Input): StretchResult {
  return forced('OF2015-af-rod-tip', 'a_f = (3/2) U / R', 1.5, flowCmS, radiusCm, SOURCE.rodTip);
}

function forced(
  id: StretchFormulaId,
  formula: string,
  c: number,
  flowCmS: Input,
  radiusCm: Input,
  source: SourceCitation,
): StretchResult {
  const u = nonNegative(toBand(flowCmS, 'U'), 'U');
  const r = positive(toBand(radiusCm, 'R'), 'R');
  return {
    value: { lo: (c * u.lo) / r.hi, hi: (c * u.hi) / r.lo },
    unit: 's-1',
    formulaId: id,
    formula,
    inputs: { U: entry(u, 'cm/s'), R: entry(r, 'cm') },
    sources: [source, SOURCE.nomenclature],
    assumptions: ['Stagnation-point flow on a curved body; not valid for flat sheets.'],
  };
}

/**
 * Buoyant stretch rate of a body of radius R (cm) at gravity g (in units of Earth gravity,
 * 1 g = 980 cm/s^2): a_b = [ F · g/R ]^½ with F the density factor (rho_e - rho*)/rho_e, the form of
 * Eqn. 1 on p. 11 of NTRS 20000004509 (id OT2000-ab-eq1). The only form the engine uses.
 * The same paper prints the factor outside the root on p. 3; that form does not reproduce the paper's
 * own range (see README, "Documented discrepancy"). `densityFactor` is required: use
 * DENSITY_FACTOR_PMMA_AIR only for PMMA in air.
 */
export function buoyantStretch(gravityLevelG: Input, radiusCm: Input, densityFactor: Input): StretchResult {
  const g = nonNegative(toBand(gravityLevelG, 'g'), 'g');
  const r = positive(toBand(radiusCm, 'R'), 'R');
  const f = toBand(densityFactor, 'density factor');
  if (f.lo <= 0 || f.hi > 1) throw new RangeError('density factor must be in (0, 1]');
  return {
    value: {
      lo: Math.sqrt((f.lo * g.lo * G_EARTH_CM_S2) / r.hi),
      hi: Math.sqrt((f.hi * g.hi * G_EARTH_CM_S2) / r.lo),
    },
    unit: 's-1',
    formulaId: 'OT2000-ab-eq1',
    formula: 'a_b = [ ((rho_e - rho*)/rho_e) · g/R ]^(1/2)',
    inputs: {
      g: entry(g, 'g_earth'),
      R: entry(r, 'cm'),
      'density factor (rho_e - rho*)/rho_e': entry(f, '1'),
    },
    sources: [SOURCE.buoyantEq1, SOURCE.rangeCheck, SOURCE.nomenclature],
    assumptions: [
      `g = ${G_EARTH_CM_S2} cm/s^2 per g_earth (paper nomenclature).`,
      'Density factor written as a temperature ratio (T* - Te)/T* as in Eqn. 1, which assumes an ideal gas at constant pressure (rho proportional to 1/T).',
      'Stagnation-point flow on a curved body; not valid for flat sheets.',
    ],
  };
}

/**
 * Mixed stretch a = a_f · (1 + a_b²/a_f²)^½ = sqrt(a_f² + a_b²). For a_f = 0 it is a_b
 * (as the paper uses it), so no division by zero occurs. Takes the two StretchResults.
 */
export function mixedStretch(forcedResult: StretchResult, buoyantResult: StretchResult): StretchResult {
  const f = forcedResult.value;
  const b = buoyantResult.value;
  return {
    value: { lo: Math.hypot(f.lo, b.lo), hi: Math.hypot(f.hi, b.hi) },
    unit: 's-1',
    formulaId: 'OT2000-mixed',
    formula: 'a = a_f · (1 + a_b² / a_f²)^(1/2) = sqrt(a_f² + a_b²)',
    inputs: { a_f: entry(f, 's-1'), a_b: entry(b, 's-1') },
    sources: [SOURCE.mixed, ...forcedResult.sources.slice(0, 1), ...buoyantResult.sources.slice(0, 1)],
    assumptions: [
      `Forced part by ${forcedResult.formulaId}, buoyant part by ${buoyantResult.formulaId}.`,
      'a_f and a_b are taken to add in quadrature, as in the source; no check that the flows are aligned.',
    ],
  };
}
