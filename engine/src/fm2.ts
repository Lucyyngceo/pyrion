// FM2 instrument balance (docs/TRANSFER.md): a closed-chamber oxygen mass balance, not a flame model.
// From the chamber volume, pressure, temperature, the starting O2 fraction, a hypothesised limiting O2
// fraction L and the fuel's oxygen demand, it gives the oxygen that can be consumed before the
// atmosphere reaches L, and the fuel mass that uses it. Pure functions. Every input carries its source.

import { KPA_PER_PSI } from './presets.ts';
import type { SourceCitation } from './stretch.ts';

/** Molar gas constant, J/(mol K). Exact in the 2019 SI. */
export const R_GAS = 8.314462618;
/** Molar mass of O2, g/mol: 2 x 15.999 (standard atomic weight of oxygen, IUPAC). */
export const M_O2 = 31.998;

export type Origin = SourceCitation | { note: string };

export interface Sourced<T> {
  value: T;
  unit: string;
  source: Origin;
}

export interface Fm2Inputs {
  volumeL: Sourced<number>;
  pressureKPa: Sourced<number>;
  /** Not stated in NTRS 20260001966: a required input, never defaulted. */
  temperatureK: Sourced<number>;
  /** O2 mole fraction at the start (0 to 1). */
  startO2Fraction: Sourced<number>;
  /** Hypothesised limiting O2 fraction L: the atmosphere at which burning stops (0 to 1). A hypothesis, not a measurement. */
  limitO2Fraction: Sourced<number>;
  /** Grams of O2 consumed per gram of fuel burned completely. */
  stoichGO2PerGFuel: Sourced<number>;
}

export interface Fm2Balance {
  nTotalMol: number;
  o2StartMol: number;
  o2AtLimitMol: number;
  /** Oxygen that can be consumed before the O2 fraction falls from start to L. 0 if start <= L. */
  o2ConsumableMol: number;
  o2ConsumableG: number;
  /** Fuel mass that consumes exactly that oxygen. */
  fuelBurnedG: number;
  finalO2Fraction: number;
  startAboveLimit: boolean;
  inputs: Fm2Inputs;
  formulas: string[];
  assumptions: string[];
}

const ASSUMPTIONS: readonly string[] = [
  'Ideal gas.',
  'Fixed temperature and fixed chamber volume: the heat of combustion is not modelled.',
  'The total number of moles stays constant: the moles of products (CO2, H2O, CO, soot) replace the moles of O2 consumed. The mole change from products is ignored.',
  'The O2 demand per gram of fuel is the stoichiometric one given as input; incomplete combustion is not modelled.',
  'The limit L is a hypothesis supplied by the caller; the balance does not predict it.',
];

function check(name: string, v: number, lo: number, hi: number, loOpen = false): void {
  if (!Number.isFinite(v) || v > hi || v < lo || (loOpen && v === lo)) {
    throw new RangeError(`${name}: ${v} is outside ${loOpen ? '(' : '['}${lo}, ${hi}]`);
  }
}

export function fm2Balance(inputs: Fm2Inputs): Fm2Balance {
  const V = inputs.volumeL.value;
  const P = inputs.pressureKPa.value;
  const T = inputs.temperatureK.value;
  const x0 = inputs.startO2Fraction.value;
  const L = inputs.limitO2Fraction.value;
  const s = inputs.stoichGO2PerGFuel.value;
  check('volumeL', V, 0, Infinity, true);
  check('pressureKPa', P, 0, Infinity, true);
  check('temperatureK', T, 0, Infinity, true);
  check('startO2Fraction', x0, 0, 1);
  check('limitO2Fraction', L, 0, 1);
  check('stoichGO2PerGFuel', s, 0, Infinity, true);
  // n = P V / (R T), with P in Pa and V in m3: kPa x L = J.
  const n = (P * V) / (R_GAS * T);
  const consumable = Math.max(0, n * (x0 - L));
  return {
    nTotalMol: n,
    o2StartMol: n * x0,
    o2AtLimitMol: n * L,
    o2ConsumableMol: consumable,
    o2ConsumableG: consumable * M_O2,
    fuelBurnedG: (consumable * M_O2) / s,
    finalO2Fraction: Math.min(x0, L),
    startAboveLimit: x0 > L,
    inputs,
    formulas: [
      'n = P V / (R T)',
      'O2 consumable = n (x_start - L)',
      'fuel burned = O2 consumable x M_O2 / (g O2 per g fuel)',
    ],
    assumptions: [...ASSUMPTIONS],
  };
}

export interface Fm2Outcome {
  fuelBurnedG: number;
  o2UsedMol: number;
  o2UsedG: number;
  finalO2Fraction: number;
  /** true when the fuel would need more oxygen than is in the chamber (final fraction would be below 0). */
  exceedsChamberO2: boolean;
  /** true when the final O2 fraction is below the hypothesised limit: burning would have stopped earlier. */
  belowLimit: boolean;
  assumptions: string[];
}

/** Final O2 fraction after burning a given fuel mass (g) in the chamber of `inputs`. */
export function fm2FinalO2(inputs: Fm2Inputs, fuelMassG: number): Fm2Outcome {
  check('fuelMassG', fuelMassG, 0, Infinity);
  const b = fm2Balance(inputs);
  const usedG = fuelMassG * inputs.stoichGO2PerGFuel.value;
  const usedMol = usedG / M_O2;
  const final = (b.o2StartMol - usedMol) / b.nTotalMol;
  return {
    fuelBurnedG: fuelMassG,
    o2UsedMol: usedMol,
    o2UsedG: usedG,
    finalO2Fraction: Math.max(0, final),
    exceedsChamberO2: final < 0,
    belowLimit: final < inputs.limitO2Fraction.value,
    assumptions: [...ASSUMPTIONS],
  };
}

/**
 * Grams of O2 per gram of fuel for complete combustion of CxHyOz to CO2 and H2O:
 * (x + y/4 - z/2) mol O2 per mol fuel. Atomic masses: C 12.011, H 1.008, O 15.999 (IUPAC standard values).
 */
export function stoichO2PerGramFuel(f: { C: number; H: number; O: number }): number {
  const o2 = f.C + f.H / 4 - f.O / 2;
  const mFuel = f.C * 12.011 + f.H * 1.008 + f.O * 15.999;
  if (!(o2 > 0) || !(mFuel > 0)) throw new RangeError('stoichiometry: fuel needs oxygen and mass');
  return (o2 * M_O2) / mFuel;
}

// ---------- sources of the published FM2 numbers (NTRS 20260001966) ----------

const LPSC = 'ntrs-20260001966/Ferkul-Lunar and Planetary Science Conf 2026 v2.pdf';

export const FM2_SOURCES = {
  volume: {
    file: LPSC,
    page: 6,
    quote: 'Chamber volume 14.4 L',
    supports: 'FM2 chamber volume',
  },
  pressure: {
    file: LPSC,
    page: 10,
    quote: 'Test 1: 8.2 psia (+/- 0.3 psi), 37% O2 , balance nitrogen',
    supports: 'FM2 chamber pressure (8.2 psia ± 0.3 psi) and the starting O2 fractions 37, 33, 29, 25 % of the four tests',
  },
  plan: {
    file: LPSC,
    page: 5,
    quote: 'Test a material with an expected Lunar LOC of 24-26% and an expected oxygen consumption of 0.08 mol fraction',
    supports: 'the test plan: expected limit 24-26 % and expected consumption of 0.08 mole fraction (published expectation, not a result)',
  },
  checkCase: {
    file: LPSC,
    page: 26,
    quote: 'PMMA; 34% O2; 8.2 psi; up to 1.2 g burned Final O2 fraction 13% to 21%',
    supports: 'post-combustion vent gas estimate for PMMA, used as the check case',
  },
} as const satisfies Record<string, SourceCitation>;

/** PMMA repeat unit C5H8O2 burning completely: 1.9176 g O2 per g. Derived by PYRION, not stated by NASA. */
export const PMMA_STOICH: Sourced<number> = {
  value: stoichO2PerGramFuel({ C: 5, H: 8, O: 2 }),
  unit: 'g O2 / g fuel',
  source: {
    note: 'Derived: C5H8O2 + 6 O2 -> 5 CO2 + 4 H2O with IUPAC standard atomic masses. The formula of the PMMA repeat unit is textbook chemistry, not taken from a NASA file.',
  },
};

/**
 * The published FM2 chamber for a given temperature and starting O2 / limit. The temperature is not
 * stated in the source: pass it explicitly. psia -> kPa uses 6.894757293168361 kPa/psi.
 */
export function fm2Chamber(opts: {
  temperatureK: Sourced<number>;
  startO2Fraction: Sourced<number>;
  limitO2Fraction: Sourced<number>;
  stoichGO2PerGFuel: Sourced<number>;
}): Fm2Inputs {
  return {
    volumeL: { value: 14.4, unit: 'L', source: FM2_SOURCES.volume },
    pressureKPa: { value: 8.2 * KPA_PER_PSI, unit: 'kPa', source: FM2_SOURCES.pressure },
    ...opts,
  };
}
