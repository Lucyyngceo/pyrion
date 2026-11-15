// Quantities in text -> schema units. Models never convert units; this file does.
//
// The factors are the SAME table as validation/run_all.py (TO_KPA and CONVERSIONS, one table: that file
// is the authority and this one copies it; test/quantity.test.ts checks the numbers against it).
// Pure, no I/O, no dependencies. A failure is returned as a typed error, never guessed around.

import { GRAVITY_TARGETS, type GravityTargetId } from './transfer.ts';
import { AXIS_UNITS, type ContinuousAxis, type RegimeAxis, type Target } from './types.ts';
import { validateTarget } from './verdict.ts';

export type QuantityVariable = 'pressure' | 'o2_mole_fraction' | 'flow_velocity' | 'sample_thickness' | 'gravity_level' | 'ambient_temperature';

export const QUANTITY_VARIABLES: readonly QuantityVariable[] = [
  'pressure',
  'o2_mole_fraction',
  'flow_velocity',
  'sample_thickness',
  'gravity_level',
  'ambient_temperature',
];

export type QuantityErrorCode =
  | 'unknown_variable'
  | 'empty'
  | 'not_a_number'
  | 'ambiguous_decimal_separator'
  | 'range_not_supported'
  | 'missing_unit'
  | 'unknown_unit'
  | 'gauge_pressure'
  | 'percent_out_of_range'
  | 'out_of_range'
  | 'regime_conflict'
  | 'invalid_target';

export interface QuantityError {
  ok: false;
  code: QuantityErrorCode;
  variable: string;
  original: string;
  message: string;
}

export interface QuantitySource {
  /** Where the factor comes from. */
  table: string;
  /** Gravity names only: the document that gives the level. */
  document?: { file: string; page: number; quote: string; url?: string; locator?: string };
}

export interface Quantity {
  ok: true;
  variable: QuantityVariable;
  /** In the schema unit, full precision. */
  value: number;
  /** Schema unit (AXIS_UNITS). */
  unit: string;
  /** The text exactly as given. */
  original: string;
  /** The unit as read from the text ('' when none was written). */
  unit_original: string;
  /** Human-readable: "×6.894757" or "K = °C + 273.15" or the rule applied. */
  factor_or_formula: string;
  /** The multiplier, when the conversion is a pure factor. */
  factor?: number;
  /** For O2 given without a unit: which rule decided between percent and fraction. */
  rule?: string;
  source: QuantitySource;
  /** gravity only: the regime this name or level implies. */
  gravity_regime?: 'microgravity' | 'partial_gravity' | 'normal_gravity';
  /** gravity only: set when the level is above the normal-gravity band and no regime covers it. */
  gravity_not_covered?: string;
  /** Things the reader should know (e.g. psi taken as absolute). */
  notes: string[];
  /** Plausibility warnings for a habitat-type question (not errors; the value is still returned). */
  warnings: string[];
  /** "8.2 psia → 56.54 kPa (×6.894757)" */
  display: string;
}

export type QuantityResult = Quantity | QuantityError;

const TABLE = 'validation/run_all.py (TO_KPA, CONVERSIONS)';

// ---- the table (copy of validation/run_all.py) ----
const TO_KPA: Readonly<Record<string, number>> = {
  kpa: 1.0,
  pa: 0.001,
  atm: 101.325,
  bar: 100.0,
  mbar: 0.1,
  psi: 6.894757,
  psia: 6.894757,
  mmhg: 0.1333224,
  torr: 0.1333224,
};
const TO_FRACTION: Readonly<Record<string, number>> = {
  '': 1.0,
  '1': 1.0,
  'mole fraction': 1.0,
  fraction: 1.0,
  '%': 0.01,
  percent: 0.01,
  '% by vol': 0.01,
  '% by volume': 0.01,
  'percent by volume': 0.01,
  'vol%': 0.01,
  'vol %': 0.01,
};
const TO_CM_S: Readonly<Record<string, number>> = { 'cm/s': 1.0, 'mm/s': 0.1, 'm/s': 100.0 };
const TO_MM: Readonly<Record<string, number>> = {
  mm: 1.0,
  cm: 10.0,
  um: 0.001,
  µm: 0.001,
  micron: 0.001,
  microns: 0.001,
  in: 25.4,
  m: 1000.0,
};
const TO_K_OFFSET: Readonly<Record<string, number>> = { k: 0, c: 273.15, '°c': 273.15, degc: 273.15 };
// Plausibility bounds, inclusive (BOUNDS in run_all.py). They catch unit errors, not science.
const BOUNDS: Readonly<Record<QuantityVariable, readonly [number, number]>> = {
  o2_mole_fraction: [0.0, 1.0],
  pressure: [0.1, 2000.0],
  flow_velocity: [0.0, 1000.0],
  sample_thickness: [0.0, 200.0],
  ambient_temperature: [100.0, 4000.0],
  gravity_level: [0.0, 3.0],
};

/** The table, exported so a test (or a reader) can compare it with run_all.py. */
export const QUANTITY_FACTORS = { TO_KPA, TO_FRACTION, TO_CM_S, TO_MM, TO_K_OFFSET, BOUNDS } as const;

// ---- helpers ----
const fail = (code: QuantityErrorCode, variable: string, original: string, message: string): QuantityError => ({ ok: false, code, variable, original, message });

/** 4 significant digits for display; the value itself is never rounded. */
const sig = (x: number) => String(Number(x.toPrecision(4)));

const NUMBER = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?`;
const NUM_UNIT = new RegExp(`^(${NUMBER})\\s*(.*)$`, 'i');
const FRACTION = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(.*)$/;
const GAUGE = /^(?:psi\s*g|psi\s*\(g\)|psig|psid|barg|bar\s*\(g\)|kpag|kpa\s*\(g\)|pag|atmg|gauge)$/i;

function readNumber(text: string, variable: string): { n: number; unit: string } | QuantityError {
  const s = text.normalize('NFC').replace(/μ/g, 'µ').trim();
  if (s === '') return fail('empty', variable, text, 'empty text: nothing to convert');
  if (/\d\s*(?:-|–|to)\s*\d/i.test(s.replace(/^[+-]/, '')) && !/e[+-]\d/i.test(s)) {
    return fail('range_not_supported', variable, text, `"${text}" looks like a range; give one value`);
  }
  let t = s;
  if (/\d,\d/.test(t)) {
    // "8,2" and "1,5": a comma followed by one or two digits is a decimal comma. "101,325" (three digits,
    // or several commas) could be a decimal or a thousands separator: refused.
    const dec = /^([+-]?\d+),(\d{1,2})(?![\d,])/.exec(t);
    if (!dec || /\d,\d/.test(t.slice(dec[0].length))) {
      return fail('ambiguous_decimal_separator', variable, text, `"${text}" has a comma between digits that could be a decimal comma or a thousands separator; write 101.325 (decimal point) or 101325 (no separator)`);
    }
    t = `${dec[1]}.${dec[2]}${t.slice(dec[0].length)}`;
  }
  const m = NUM_UNIT.exec(t);
  if (!m) return fail('not_a_number', variable, text, `"${text}" does not start with a number`);
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return fail('not_a_number', variable, text, `"${text}": not a finite number`);
  return { n, unit: m[2].trim() };
}

/**
 * PYRION plausibility windows (not NASA values): O2 fraction 0.05–0.60, pressure 20–120 kPa. Warnings only;
 * no source backs these numbers, and every message says so.
 */
export const HABITAT_WINDOWS = { o2_mole_fraction: [0.05, 0.6], pressure: [20, 120] } as const;

function warningsFor(q: Omit<Quantity, 'display' | 'warnings'>): string[] {
  const out: string[] = [];
  const v = q.value;
  if (q.variable === 'o2_mole_fraction') {
    const [lo, hi] = HABITAT_WINDOWS.o2_mole_fraction;
    const asWritten = q.original.trim();
    if (v < lo) {
      const n = Number(/^[+-]?[\d.]+(?:e[+-]?\d+)?/i.exec(asWritten)?.[0]);
      const hint = q.unit_original !== '' && q.factor === 0.01 && n > 0 && n <= 1 ? ` did you mean ${sig(n * 100)} %?` : '';
      out.push(`${asWritten} O2 is far below any breathable atmosphere (${sig(v * 100)} % of the gas; PYRION plausibility window ${lo * 100}–${hi * 100} %, not a NASA value).${hint}`);
    } else if (v > hi) {
      out.push(`${asWritten} O2 is far above the usual oxygen levels (PYRION plausibility window ${lo * 100}–${hi * 100} %, not a NASA value); check the unit.`);
    }
  } else if (q.variable === 'pressure') {
    const [lo, hi] = HABITAT_WINDOWS.pressure;
    if (v < lo || v > hi) out.push(`${sig(v)} kPa is outside ${lo}–${hi} kPa (PYRION plausibility window, not a NASA value); check the unit.`);
  }
  return out;
}

function bounded(q: Omit<Quantity, 'display' | 'warnings'>): Quantity | QuantityError {
  const [lo, hi] = BOUNDS[q.variable];
  if (!(q.value >= lo && q.value <= hi)) {
    return fail('out_of_range', q.variable, q.original, `${q.value} ${q.unit} is outside the plausible range ${lo}–${hi} ${q.unit}; this usually means the wrong unit`);
  }
  const unit = q.unit === '1' ? '' : ` ${q.unit}`;
  const how = q.factor !== undefined ? `×${q.factor}` : q.factor_or_formula;
  return { ...q, warnings: warningsFor(q), display: `${q.original.trim()} → ${sig(q.value)}${unit} (${how})` };
}

function viaTable(
  variable: QuantityVariable,
  original: string,
  n: number,
  unit: string,
  table: Readonly<Record<string, number>>,
  schemaUnit: string,
  accepted: string,
): QuantityResult {
  const key = unit.toLowerCase();
  if (unit === '') return fail('missing_unit', variable, original, `"${original}" has no unit; ${variable} needs one of: ${accepted}`);
  if (!Object.hasOwn(table, key)) return fail('unknown_unit', variable, original, `unit "${unit}" is not accepted for ${variable}; accepted: ${accepted}`);
  const factor = table[key];
  return bounded({
    ok: true,
    variable,
    value: n * factor,
    unit: schemaUnit,
    original,
    unit_original: unit,
    factor_or_formula: `×${factor}`,
    factor,
    source: { table: TABLE },
    notes: [],
  });
}

// ---- per variable ----

const NORMAL_PRESSURE = /^(?:the\s+)?(?:(?:normal|standard|sea[- ]level)(?:\s+(?:air|atmospheric))?\s+pressure|sea[- ]level|standard\s+atmosphere|one\s+atmosphere|nivel\s+del\s+mar|presion\s+(?:normal|estandar))$/i;
const ATM_WORDS = /^(?:atmospheres?|standard atmospheres?)$/i;

function pressure(original: string): QuantityResult {
  if (NORMAL_PRESSURE.test(original.normalize('NFD').replace(/[̀-ͯ]/g, '').trim())) {
    return bounded({
      ok: true,
      variable: 'pressure',
      value: TO_KPA.atm,
      unit: AXIS_UNITS.pressure,
      original,
      unit_original: '',
      factor_or_formula: `1 atm × ${TO_KPA.atm}`,
      factor: TO_KPA.atm,
      source: { table: TABLE },
      notes: [`"${original.trim()}" is read as one standard atmosphere = 101.325 kPa (the atm factor of validation/run_all.py)`],
    });
  }
  const r0 = readNumber(original, 'pressure');
  if ('ok' in r0) return r0;
  // "kPa abs", "psia (absolute)": the word only restates what the engine needs (gauge is checked first).
  const r = { n: r0.n, unit: GAUGE.test(r0.unit) ? r0.unit : r0.unit.replace(/\s*\(?\s*(?:abs|absolute)\.?\s*\)?\s*$/i, '').trim() };
  if (ATM_WORDS.test(r.unit)) {
    const out = viaTable('pressure', original, r.n, 'atm', TO_KPA, AXIS_UNITS.pressure, 'atm');
    if (out.ok) {
      out.unit_original = r.unit;
      if (r.n === 1) out.notes.push('1 atmosphere = 1 atm = 101.325 kPa (standard atmosphere; factor from validation/run_all.py)');
    }
    return out;
  }
  if (GAUGE.test(r.unit)) return fail('gauge_pressure', 'pressure', original, `"${r.unit}" is gauge pressure (relative to the surroundings). The engine needs absolute pressure: give psia, kPa, atm, ... instead`);
  const out = viaTable('pressure', original, r.n, r.unit, TO_KPA, AXIS_UNITS.pressure, 'kPa, Pa, atm, bar, mbar, psi, psia, mmHg, torr');
  if (out.ok && r.n === 1 && /^atm$/i.test(r.unit)) out.notes.push('1 atm = 101.325 kPa (standard atmosphere; factor from validation/run_all.py)');
  if (out.ok && r.unit.toLowerCase() === 'psi') out.notes.push('"psi" taken as absolute (same factor as psia, as in validation/run_all.py); write psia to be explicit');
  return out;
}

function o2(original: string): QuantityResult {
  const r = o2Inner(original);
  // A fraction outside 0–1 is a percent/fraction mix-up, not a generic out-of-range value.
  return r.ok || r.code !== 'out_of_range' ? r : { ...r, code: 'percent_out_of_range' };
}

function o2Inner(original: string): QuantityResult {
  const rn = readNumber(original.replace(/₂/g, '2'), 'o2_mole_fraction');
  if ('ok' in rn) return { ...rn, original };
  // "34% O2", "34 % oxygen", "34 vol% of oxygen": the trailing gas name is ignored (the variable is already oxygen).
  const stripped = rn.unit.replace(/\s*(?:(?:of|de)\s+)?(?:oxygen|o2|ox[ií]geno)\s*$/i, '').trim();
  const r = { n: rn.n, unit: stripped };
  const stripNote = stripped !== rn.unit ? [`trailing "${rn.unit.slice(stripped.length).trim()}" ignored: the value is the oxygen mole fraction`] : [];
  const out0 = o2Units(original, r);
  return out0.ok && stripNote.length ? { ...out0, notes: [...stripNote, ...out0.notes] } : out0;
}

const O2_UNIT_ALIASES: Readonly<Record<string, string>> = {
  'mol%': '%',
  'mol %': '%',
  'mole%': '%',
  'mole %': '%',
  'per cent': 'percent',
  'mol percent': 'percent',
  'mole percent': 'percent',
  'vol. %': '%',
  'por ciento': 'percent',
  porciento: 'percent',
};

function o2Units(original: string, r: { n: number; unit: string }): QuantityResult {
  const key = r.unit.toLowerCase();
  if (r.unit === '') {
    // Bare number: > 1 is percent, <= 1 is a fraction.
    const asPercent = r.n > 1;
    if (r.n > 100 || r.n < 0) return fail('percent_out_of_range', 'o2_mole_fraction', original, `${r.n} is neither a fraction (0–1) nor a percent (0–100)`);
    const factor = asPercent ? 0.01 : 1;
    const rule = asPercent ? `bare number ${r.n} > 1, read as percent` : `bare number ${r.n} <= 1, read as a mole fraction`;
    const out = bounded({
      ok: true,
      variable: 'o2_mole_fraction',
      value: r.n * factor,
      unit: AXIS_UNITS.o2_mole_fraction,
      original,
      unit_original: '',
      factor_or_formula: `×${factor} (${rule})`,
      factor,
      rule,
      source: { table: TABLE },
      notes: r.n === 1 ? ['bare "1" is read as the fraction 1 (pure oxygen); write "1 %" if one percent was meant'] : [],
    });
    return out;
  }
  const aliased = O2_UNIT_ALIASES[key] ?? r.unit;
  const out = viaTable('o2_mole_fraction', original, r.n, aliased, TO_FRACTION, AXIS_UNITS.o2_mole_fraction, '%, vol%, mol%, % by vol, percent, per cent, fraction, mole fraction, or no unit');
  if (out.ok) {
    out.unit_original = r.unit;
    out.rule = `unit "${r.unit}" stated, so the number is read as written (${key === '1' || key.includes('fraction') ? 'fraction' : 'percent'})`;
    if (out.value > 1 || out.value < 0) return fail('percent_out_of_range', 'o2_mole_fraction', original, `${original.trim()} gives ${out.value}, outside 0–1`);
    if (out.factor === 0.01 && r.n <= 1 && r.n > 0) out.notes.push(`"${r.n} ${r.unit}" is read as ${r.n} percent (${out.value} as a fraction) because the unit is written`);
  }
  return out;
}

const simple = (
  variable: 'flow_velocity' | 'sample_thickness',
  table: Readonly<Record<string, number>>,
  accepted: string,
) => (original: string): QuantityResult => {
  const r = readNumber(original, variable);
  if ('ok' in r) return r;
  return viaTable(variable, original, r.n, r.unit, table, AXIS_UNITS[variable], accepted);
};

function temperature(original: string): QuantityResult {
  const r = readNumber(original, 'ambient_temperature');
  if ('ok' in r) return r;
  const unit = r.unit.replace(/^°\s*/, '°');
  if (unit === '') return fail('missing_unit', 'ambient_temperature', original, `"${original}" has no unit; use K or °C`);
  // "22 degrees C", "22 degrees Celsius", "22 celsius", "300 kelvin"
  const word = unit.toLowerCase().replace(/^(?:°|º|degrees?|deg\.?)\s*/, '');
  const key = ['c', 'celsius', 'centigrade'].includes(word) ? 'c' : ['k', 'kelvin', 'kelvins'].includes(word) ? 'k' : unit.toLowerCase();
  if (!Object.hasOwn(TO_K_OFFSET, key)) return fail('unknown_unit', 'ambient_temperature', original, `unit "${r.unit}" is not accepted for ambient_temperature; accepted: K, °C`);
  const off = TO_K_OFFSET[key];
  return bounded({
    ok: true,
    variable: 'ambient_temperature',
    value: r.n + off,
    unit: AXIS_UNITS.ambient_temperature,
    original,
    unit_original: unit,
    factor_or_formula: off === 0 ? '×1' : 'K = °C + 273.15',
    ...(off === 0 ? { factor: 1 } : {}),
    source: { table: TABLE },
    notes: [],
  });
}

/** Levels below this are treated as microgravity (engine rule; platform residual levels are far below it). */
export const MICROGRAVITY_BELOW_G = 0.01;

/** Shown with every numeric result that falls under the cut. */
export const MICROGRAVITY_CONVENTION_NOTE =
  `PYRION convention, not a NASA value: gravity levels below ${MICROGRAVITY_BELOW_G} g are treated as microgravity. NASA's own flammability chart places 1e-4 g and 1e-2 g on one continuous axis (NTRS 20260001966, PDF p. 17 (slide 16)), so this cut is a modelling choice and is shown with every result.`;

/** Normal gravity is a band, not the single value 1 (PYRION convention, not a NASA value). */
export const NORMAL_GRAVITY_BAND = { lo: 0.9, hi: 1.1 } as const;
export const NORMAL_GRAVITY_CONVENTION_NOTE =
  `PYRION convention, not a NASA value: gravity levels from ${NORMAL_GRAVITY_BAND.lo} to ${NORMAL_GRAVITY_BAND.hi} g are treated as normal gravity.`;
/** The reason shown when a stated gravity has no regime in this dataset. */
export const ABOVE_NORMAL_GRAVITY_MESSAGE =
  `above 1 g: not covered by this dataset (no regime exists above normal gravity; normal gravity is the ${NORMAL_GRAVITY_BAND.lo}–${NORMAL_GRAVITY_BAND.hi} g band, a PYRION convention).`;

function regimeOfLevel(level: number): Quantity['gravity_regime'] | undefined {
  if (level >= 0 && level < MICROGRAVITY_BELOW_G) return 'microgravity';
  if (level >= MICROGRAVITY_BELOW_G && level < NORMAL_GRAVITY_BAND.lo) return 'partial_gravity';
  if (level >= NORMAL_GRAVITY_BAND.lo && level <= NORMAL_GRAVITY_BAND.hi) return 'normal_gravity';
  return undefined;
}

const GRAVITY_NAMES: Readonly<Record<string, GravityTargetId | 'microgravity'>> = {
  lunar: 'moon',
  moon: 'moon',
  'lunar gravity': 'moon',
  'moon gravity': 'moon',
  mars: 'mars',
  martian: 'mars',
  'martian gravity': 'mars',
  'mars gravity': 'mars',
  earth: 'earth',
  'earth gravity': 'earth',
  'normal gravity': 'earth',
  microgravity: 'microgravity',
  'micro-gravity': 'microgravity',
  'micro gravity': 'microgravity',
  'zero-g': 'microgravity',
  'zero g': 'microgravity',
  'zero gravity': 'microgravity',
  'zero-gravity': 'microgravity',
  weightlessness: 'microgravity',
  iss: 'microgravity',
  // freefall words (the challenge is "Flame in Freefall")
  freefall: 'microgravity',
  'free fall': 'microgravity',
  'free-fall': 'microgravity',
  'in freefall': 'microgravity',
  'in free fall': 'microgravity',
  'in free-fall': 'microgravity',
  weightless: 'microgravity',
  'in orbit': 'microgravity',
  orbital: 'microgravity',
  'micro-g': 'microgravity',
  microg: 'microgravity',
  µg: 'microgravity',
  ug: 'microgravity',
  // Spanish (accents are stripped before the lookup)
  luna: 'moon',
  'gravedad lunar': 'moon',
  marte: 'mars',
  marciano: 'mars',
  marciana: 'mars',
  'gravedad marciana': 'mars',
  'gravedad de marte': 'mars',
  microgravedad: 'microgravity',
  ingravidez: 'microgravity',
  'caida libre': 'microgravity',
  'gravedad cero': 'microgravity',
  tierra: 'earth',
  'gravedad normal': 'earth',
  'gravedad terrestre': 'earth',
  'gravedad de la tierra': 'earth',
};

function gravity(original: string): QuantityResult {
  const text = original.normalize('NFC').trim();
  const name = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/μ/g, 'µ')
    .replace(/^(?:the|la|el)\s+/, '')
    .replace(/\s+/g, ' ');
  if (text === '') return fail('empty', 'gravity_level', original, 'empty text: nothing to convert');
  if (Object.hasOwn(GRAVITY_NAMES, name)) {
    const id = GRAVITY_NAMES[name];
    if (id === 'microgravity') {
      return {
        ok: true,
        variable: 'gravity_level',
        value: 0,
        unit: 'g',
        original,
        unit_original: '',
        factor_or_formula: 'name "microgravity" → regime microgravity; level 0 g is a convention, not a measurement',
        source: { table: 'engine rule: the name selects gravity_regime = microgravity; no gravity level is asserted' },
        gravity_regime: 'microgravity',
        warnings: [],
        notes: ['The residual acceleration of a real microgravity platform is small but not zero; the engine uses the regime, not the number 0.', MICROGRAVITY_CONVENTION_NOTE],
        display: `${text} → regime microgravity (no gravity level asserted)`,
      };
    }
    const g = GRAVITY_TARGETS[id];
    const q: Omit<Quantity, 'display' | 'warnings'> = {
      ok: true,
      variable: 'gravity_level',
      value: g.level,
      unit: 'g',
      original,
      unit_original: '',
      factor_or_formula: `name "${name}" → ${g.label}`,
      source: { table: 'engine/src/transfer.ts GRAVITY_TARGETS', ...(('quote' in g.source) ? { document: { file: g.source.file, page: g.source.page, quote: g.source.quote, ...(g.source.url ? { url: g.source.url } : {}), ...(g.source.locator ? { locator: g.source.locator } : {}) } } : {}) },
      gravity_regime: g.regime,
      notes: id === 'mars' ? ['Mars 0.38 g: NASA GSFC NSSDC Mars Fact Sheet, row "Surface gravity (mean) (m/s2) | 3.73 | 9.82 | 0.380" (Mars | Earth | ratio), page last updated 19 May 2025. 0.38 g is also one of the partial-gravity levels used in NASA combustion studies (NTRS 20010074003, PDF p. 2).'] : id === 'earth' ? [NORMAL_GRAVITY_CONVENTION_NOTE] : id === 'moon' ? ['The engine presets use 0.16 g (NTRS 20210020446 p. 3); 0.165 g is the FM2 level (NTRS 20260001966, PDF p. 13 (slide 12)).'] : [],
    };
    const b = bounded(q);
    return b.ok ? { ...b, display: `${text} → ${sig(g.level)} g (${g.label})` } : b;
  }
  // numeric: "0.165 g", "1/6 g"
  let n: number;
  let unit: string;
  let how: string;
  const f = FRACTION.exec(text.replace(/\s+/g, ' '));
  if (f) {
    const den = Number(f[2]);
    if (den === 0) return fail('not_a_number', 'gravity_level', original, 'division by zero');
    n = Number(f[1]) / den;
    unit = f[3].trim();
    how = `${f[1]}/${f[2]} = ${sig(n)}`;
  } else {
    const r = readNumber(text, 'gravity_level');
    if ('ok' in r) return r;
    n = r.n;
    unit = r.unit;
    how = String(r.n);
  }
  if (unit === '') return fail('missing_unit', 'gravity_level', original, `"${original}" has no unit; write "g" (for example "0.165 g"), or a name: lunar, mars, microgravity`);
  if (!/^g(?:e|0|_?earth)?$|^g\s*earth$/i.test(unit)) return fail('unknown_unit', 'gravity_level', original, `unit "${unit}" is not accepted for gravity_level; accepted: g (gE, g0)`);
  const regime = regimeOfLevel(n);
  const out = bounded({
    ok: true,
    variable: 'gravity_level',
    value: n,
    unit: 'g',
    original,
    unit_original: unit,
    factor_or_formula: f ? `×1 (${how})` : '×1',
    factor: 1,
    source: { table: TABLE },
    ...(regime ? { gravity_regime: regime } : {}),
    ...(regime ? {} : { gravity_not_covered: ABOVE_NORMAL_GRAVITY_MESSAGE }),
    notes: !regime
      ? [ABOVE_NORMAL_GRAVITY_MESSAGE]
      : regime === 'microgravity'
        ? [MICROGRAVITY_CONVENTION_NOTE]
        : regime === 'normal_gravity'
          ? [NORMAL_GRAVITY_CONVENTION_NOTE]
          : [`regime ${regime} inferred from the level (${MICROGRAVITY_BELOW_G} to < ${NORMAL_GRAVITY_BAND.lo} g = partial_gravity)`],
  });
  return out.ok && f ? { ...out, display: `${original.trim()} → ${sig(n)} g` } : out;
}

const PARSERS: Readonly<Record<QuantityVariable, (original: string) => QuantityResult>> = {
  pressure,
  o2_mole_fraction: o2,
  flow_velocity: simple('flow_velocity', TO_CM_S, 'cm/s, mm/s, m/s'),
  sample_thickness: simple('sample_thickness', TO_MM, 'mm, cm, µm, in'),
  gravity_level: gravity,
  ambient_temperature: temperature,
};

/**
 * Text → value in the schema unit, or a typed error. Never guesses: a missing unit, a gauge pressure,
 * a range or an ambiguous comma is an error. The factor is returned with the result.
 */
export function parseQuantity(text: string, variable: QuantityVariable): QuantityResult {
  if (!Object.hasOwn(PARSERS, variable)) return fail('unknown_variable', String(variable), String(text), `unknown variable "${variable}"; accepted: ${QUANTITY_VARIABLES.join(', ')}`);
  if (typeof text !== 'string') return fail('not_a_number', variable, String(text), 'the text is not a string');
  return PARSERS[variable](text);
}

// ---- target from quantities ----

export interface TargetQuantities {
  gravity?: string;
  o2?: string;
  pressure?: string;
  flow_velocity?: string;
  sample_thickness?: string;
  ambient_temperature?: string;
  /** Regime axes pass through unchanged and are validated against REGIME_VALUES. */
  gravity_regime?: string;
  fuel_phase?: string;
  diluent?: string;
  flame_type?: string;
}

export interface TargetFromQuantitiesOk {
  ok: true;
  target: Target;
  /** One entry per quantity converted, in a fixed order; for the UI ("8.2 psia → 56.54 kPa (×6.894757)"). */
  conversions: Quantity[];
}
export interface TargetFromQuantitiesFail {
  ok: false;
  errors: Array<QuantityError & { field: string }>;
}

const FIELD_ORDER: Array<[keyof TargetQuantities, QuantityVariable, ContinuousAxis]> = [
  ['gravity', 'gravity_level', 'gravity_level'],
  ['o2', 'o2_mole_fraction', 'o2_mole_fraction'],
  ['pressure', 'pressure', 'pressure'],
  ['flow_velocity', 'flow_velocity', 'flow_velocity'],
  ['sample_thickness', 'sample_thickness', 'sample_thickness'],
  ['ambient_temperature', 'ambient_temperature', 'ambient_temperature'],
];

/**
 * A validated Target built from text, plus the conversions done. Fields not given stay open. For
 * gravity, a name or level also sets gravity_regime (the regime axis is a barrier in the engine); a
 * stated gravity_regime that disagrees is an error. "microgravity" sets the regime and asserts no level.
 */
export function targetFromQuantities(input: TargetQuantities): TargetFromQuantitiesOk | TargetFromQuantitiesFail {
  const errors: TargetFromQuantitiesFail['errors'] = [];
  const conversions: Quantity[] = [];
  const target: Target = { regime: {}, continuous: {} };

  for (const [field, variable, axis] of FIELD_ORDER) {
    const text = input[field];
    if (text === undefined || text === '') continue;
    const q = parseQuantity(text, variable);
    if (!q.ok) {
      errors.push({ ...q, field });
      continue;
    }
    conversions.push(q);
    if (variable === 'gravity_level') {
      // The level selects the regime; it is not a continuous axis (no record carries it), so it is only shown.
      if (q.gravity_regime) target.regime.gravity_regime = q.gravity_regime;
      const info: NonNullable<Target['informational']> = {};
      if (!(q.gravity_regime === 'microgravity' && q.unit_original === '')) info.gravity_level = q.value;
      if (q.gravity_not_covered) info.gravity_not_covered = q.gravity_not_covered;
      if (Object.keys(info).length > 0) target.informational = info;
    } else {
      target.continuous[axis] = q.value;
    }
  }

  const stated = input.gravity_regime;
  if (stated !== undefined && stated !== '') {
    const implied = target.regime.gravity_regime;
    if (implied && implied !== stated) {
      errors.push({ ...fail('regime_conflict', 'gravity_regime', stated, `gravity_regime "${stated}" disagrees with the regime "${implied}" implied by "${input.gravity}"`), field: 'gravity_regime' });
    } else {
      target.regime.gravity_regime = stated as never;
    }
  }
  for (const axis of ['fuel_phase', 'diluent', 'flame_type'] as const satisfies readonly RegimeAxis[]) {
    const v = input[axis];
    if (v !== undefined && v !== '') target.regime[axis] = v;
  }

  if (errors.length === 0) {
    try {
      validateTarget(target);
    } catch (e) {
      errors.push({ ...fail('invalid_target', 'target', '', (e as Error).message), field: 'target' });
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, target, conversions };
}
