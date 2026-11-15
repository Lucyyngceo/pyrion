// Plain-language names for axes and regime values (used in sentences and reason codes).

const AXIS_LABELS: Readonly<Record<string, string>> = {
  gravity_regime: 'gravity regime',
  fuel_phase: 'fuel phase',
  diluent: 'diluent gas',
  flame_type: 'flame type',
  o2_mole_fraction: 'oxygen',
  burner_o2_mole_fraction: 'burner oxygen',
  pressure: 'pressure',
  flow_velocity: 'flow velocity',
  sample_thickness: 'sample thickness',
  droplet_diameter_initial: 'initial droplet diameter',
  ambient_temperature: 'ambient temperature',
  gravity_level: 'gravity level',
};
const VALUE_LABELS: Readonly<Record<string, string>> = {
  microgravity: 'microgravity',
  partial_gravity: 'partial gravity',
  normal_gravity: 'normal gravity',
  solid: 'solid fuel',
  liquid: 'liquid fuel',
  gas: 'gaseous fuel',
  N2: 'nitrogen',
  He: 'helium',
  CO2: 'carbon dioxide',
  Ar: 'argon',
  mixed: 'mixed gases',
  normal: 'normal flame',
  inverse: 'inverse flame',
};
export const axisLabel = (axis: string): string => AXIS_LABELS[axis] ?? axis.replace(/_/g, ' ');
export const valueLabel = (value: string): string => VALUE_LABELS[value] ?? value;


/** "1 test" / "2 tests": the form that agrees with n. */
export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

// ---------- readable numbers and sentences (no snake_case, no raw precision) ----------

import { KPA_PER_PSI } from './presets.ts';
import { AXIS_UNITS, type ContinuousAxis, type Verdict } from './types.ts';

/** The verdict names a reader sees. */
export const VERDICT_LABELS: Readonly<Record<Verdict, string>> = {
  APPLICABLE: 'Inside the tested range',
  EXTRAPOLATION: 'Outside the tested range',
  INSUFFICIENT_EVIDENCE: 'Insufficient evidence',
  REGIME_BARRIER: 'Not comparable: different gravity, fuel or atmosphere',
};
export const verdictLabel = (v: Verdict): string => VERDICT_LABELS[v];

/** Capitalise the first letter of a sentence that starts with a label. */
export const cap = (s: string): string => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1));

const sig = (x: number, d: number) => String(Number(x.toPrecision(d)));

/** Oxygen as a percent with at most one decimal ("15.9 %", "30 %"). */
export function percentText(fraction: number): string {
  return `${String(Number((fraction * 100).toFixed(1)))} %`;
}

/** A value of a continuous axis for a sentence: O2 as %, pressure in kPa (psia) with 3 significant figures, others 3 s.f. */
export function humanValue(axis: ContinuousAxis, v: number, digits = 3): string {
  if (axis === 'o2_mole_fraction' || axis === 'burner_o2_mole_fraction') return percentText(v);
  if (axis === 'pressure') return `${sig(v, digits)} kPa (${sig(v / KPA_PER_PSI, digits)} psia)`;
  const u = AXIS_UNITS[axis];
  return u === '1' ? sig(v, digits) : `${sig(v, digits)} ${u}`;
}

/** A difference between two values: "7.4 points" for oxygen, otherwise the value with its unit. */
export function humanGap(axis: ContinuousAxis, gap: number): string {
  if (axis === 'o2_mole_fraction' || axis === 'burner_o2_mole_fraction') return `${String(Number((gap * 100).toFixed(1)))} points`;
  if (axis === 'pressure') return `${sig(gap, 3)} kPa (${sig(gap / KPA_PER_PSI, 3)} psia)`;
  const u = AXIS_UNITS[axis];
  return u === '1' ? sig(gap, 3) : `${sig(gap, 3)} ${u}`;
}

/** "flagged as insufficient in the extraction" / "not verified" for the statuses of excluded records. */
export function excludedWhy(statuses: readonly string[]): string {
  const parts: string[] = [];
  if (statuses.includes('insufficient_evidence')) parts.push('flagged as insufficient in the extraction');
  if (statuses.includes('extracted')) parts.push('not verified');
  return parts.length > 0 ? parts.join(' and ') : 'flagged as insufficient in the extraction';
}

import type { ExtrapolationLevel } from './levels.ts';

/** One plain sentence per extrapolation level. */
export const EXTRAPOLATION_LEVEL_SENTENCES: Readonly<Record<ExtrapolationLevel, string>> = {
  combination: 'Inside each tested range, but this combination was not tested',
  just_outside: 'Just outside the tested data',
  outside: 'Outside the tested data',
  far_outside: 'Far outside the tested data',
};
export const levelSentence = (l: ExtrapolationLevel): string => EXTRAPOLATION_LEVEL_SENTENCES[l];
