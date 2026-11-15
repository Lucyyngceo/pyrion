// Target presets. Each value carries the source it comes from, the words of that source and
// how it was converted, in the same shape as a condition record. Nothing here is a finding:
// these are the conditions PYRION is asked about, not results.

import type { ContinuousAxis, RegimeAxis, Target } from './types.ts';

/** 1 psi = 6.894757293168361 kPa (exact: 1 lbf/in², with 1 lbf = 4.4482216152605 N and 1 in = 0.0254 m). */
export const KPA_PER_PSI = 6.894757293168361;

export interface SourceRef {
  id: string;
  title: string;
  publisher: string;
  /** NTRS id, report number or web page. NTRS documents have no DOI; the NTRS id is the stable identifier. */
  identifier: string;
  url: string;
  /** Page (PDF page index, 1-based) or section where the quote is. */
  locator: string;
  quote: string;
}

export interface PresetValue<T extends string | number> {
  value: T;
  unit: string;
  value_original: string;
  unit_original: string;
  note: string;
  source: SourceRef;
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  regime: Partial<Record<RegimeAxis, PresetValue<string>>>;
  continuous: Partial<Record<ContinuousAxis, PresetValue<number>>>;
  /** What the preset does not say, in plain words. Shown next to any verdict computed from it. */
  limits: string[];
}

export const SOURCES = {
  marsGravity: {
    id: 'nssdc-mars-fact-sheet',
    title: 'Mars Fact Sheet',
    publisher: 'NASA Goddard Space Flight Center, National Space Science Data Coordinated Archive (NSSDC)',
    identifier: 'nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
    locator: 'row "Surface gravity (mean) (m/s2)" (page last updated 19 May 2025)',
    quote: 'Surface gravity (mean) (m/s2) 3.73 9.82 0.380',
  },
  challenge: {
    id: 'space-apps-2026-flame-in-freefall',
    title: 'Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data (challenge statement)',
    publisher: 'NASA International Space Apps Challenge 2026',
    identifier: 'spaceappschallenge.org/2026/challenges/flame-in-freefall',
    url: 'https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/',
    locator: 'Potential Considerations, "Spacesuits and oxygen concentration"',
    quote:
      'The intermediate oxygen concentration used on the Moon will likely be 30% or greater, with a corresponding pressure of 10.2 psi or less.',
  },
  lunarGravity: {
    id: 'ntrs-20210020446',
    title: 'Ruff, Impact of Lunar Gravity on Material Flammability, Lunar Surface Science Workshop 2021',
    publisher: 'NASA Technical Reports Server',
    identifier: 'NTRS 20210020446',
    url: 'https://ntrs.nasa.gov/api/citations/20210020446/downloads/LSSW%20Presentation_8-12-2021_FINAL.pdf',
    locator: 'page 3, "How is flame spread affected by Lunar-g?"',
    quote: 'glunar = 0.16 gearth',
  },
  nescSummary: {
    id: 'ntrs-20260003925',
    title: 'NESC, Impacts of Reduced Pressure Atmospheres on ECLSS (NESC-RP-20-01610)',
    publisher: 'NASA Engineering and Safety Center',
    identifier: 'NASA/TM-20260003925 (NTRS 20260003925)',
    url: 'https://ntrs.nasa.gov/api/citations/20260003925/downloads/20260003925.pdf',
    locator: 'page 13, section 4.0 Executive Summary',
    quote:
      'nominal cabin atmospheres of 10.2 pounds per square inch absolute (psia) with 26.5% O2, and 8.2 psia with 34% O2, collectively termed "Exploration Atmospheres"',
  },
  nescSurface: {
    id: 'ntrs-20260003925',
    title: 'NESC, Impacts of Reduced Pressure Atmospheres on ECLSS (NESC-RP-20-01610)',
    publisher: 'NASA Engineering and Safety Center',
    identifier: 'NASA/TM-20260003925 (NTRS 20260003925)',
    url: 'https://ntrs.nasa.gov/api/citations/20260003925/downloads/20260003925.pdf',
    locator: 'page 18, section 6.2 Spacecraft Cabin Atmospheres for Exploration',
    quote:
      'One of the most enabling means is to design Exploration surface habitat(s) to operate at cabin atmospheric pressures low enough to reduce or eliminate prebreathe protocols. For planning purposes, and for the purpose of this assessment, the potential atmosphere conditions that are being considered are 10.2 psia/26.5% O2 and 8.2 psia/34% O2.',
  },
} as const satisfies Record<string, SourceRef>;

function psi(original: string, unitOriginal: string, source: SourceRef): PresetValue<number> {
  return {
    value: Number(original) * KPA_PER_PSI,
    unit: 'kPa',
    value_original: original,
    unit_original: unitOriginal,
    note: `${original} ${unitOriginal} × ${KPA_PER_PSI} kPa/psi; read as absolute cabin pressure.`,
    source,
  };
}

function percentO2(original: string, source: SourceRef): PresetValue<number> {
  return {
    value: Number(original) / 100,
    unit: '1',
    value_original: original,
    unit_original: '%',
    note: `${original}% by volume / 100, read as mole fraction (ideal gas).`,
    source,
  };
}

const lunarRegime: PresetValue<string> = {
  value: 'partial_gravity',
  unit: '',
  value_original: '0.16',
  unit_original: 'g (Earth gravity)',
  note: '0.16 g is between microgravity and 1 g, which is the schema term partial_gravity.',
  source: SOURCES.lunarGravity,
};

const lunarLevel: PresetValue<number> = {
  value: 0.16,
  unit: 'g',
  value_original: '0.16',
  unit_original: 'gearth',
  note: 'As written in the source.',
  source: SOURCES.lunarGravity,
};

export const PRESETS: readonly Preset[] = [
  {
    id: 'challenge-lunar-base',
    label: 'Moon Base, as stated in the challenge',
    description:
      'The challenge states the Moon Base atmosphere as a band: 30% O2 or more at 10.2 psi or less. This preset is the corner of that band (30% O2, 10.2 psi) at lunar gravity.',
    regime: { gravity_regime: lunarRegime },
    continuous: {
      o2_mole_fraction: percentO2('30', SOURCES.challenge),
      pressure: psi('10.2', 'psi', SOURCES.challenge),
      gravity_level: lunarLevel,
    },
    limits: [
      'A point, not the whole band: the engine checks targets as points.',
      'Fuel phase and diluent are not stated by the source; the preset leaves them open.',
      'Lunar gravity (0.16 g) comes from a separate NASA source, not from the challenge text.',
    ],
  },
  {
    id: 'nesc-10.2psia-26.5o2-lunar',
    label: 'NESC Exploration Atmosphere 10.2 psia / 26.5% O2, at lunar gravity',
    description:
      'One of the two Exploration Atmospheres assessed by the NASA Engineering and Safety Center, paired with lunar gravity because the report considers them for surface habitats.',
    regime: { gravity_regime: lunarRegime },
    continuous: {
      o2_mole_fraction: percentO2('26.5', SOURCES.nescSummary),
      pressure: psi('10.2', 'psia', SOURCES.nescSummary),
      gravity_level: lunarLevel,
    },
    limits: [
      'The NESC report names surface habitats but does not state a gravity level; PYRION pairs the atmosphere with lunar gravity (0.16 g, NTRS 20210020446) because the challenge is about the Moon Base.',
      'Fuel phase and diluent are not stated as target conditions; the preset leaves them open.',
    ],
  },
  {
    id: 'nesc-8.2psia-34o2-lunar',
    label: 'NESC Exploration Atmosphere 8.2 psia / 34% O2, at lunar gravity',
    description:
      'The second NESC Exploration Atmosphere, paired with lunar gravity for the same reason. The report also considers O2 up to 40% at 8.2 psia when assessing flammability.',
    regime: { gravity_regime: lunarRegime },
    continuous: {
      o2_mole_fraction: percentO2('34', SOURCES.nescSummary),
      pressure: psi('8.2', 'psia', SOURCES.nescSummary),
      gravity_level: lunarLevel,
    },
    limits: [
      'The NESC report names surface habitats but does not state a gravity level; PYRION pairs the atmosphere with lunar gravity (0.16 g, NTRS 20210020446) because the challenge is about the Moon Base.',
      'NESC also considers up to 40% O2 at 8.2 psia for flammability; this preset uses the nominal 34%.',
      'Fuel phase and diluent are not stated as target conditions; the preset leaves them open.',
    ],
  },
];

/** The engine target of a preset. `overrides` lets a user add what the source leaves open (e.g. fuel phase). */
export function presetTarget(id: string, overrides: Partial<Target['regime']> = {}): Target {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new RangeError(`unknown preset "${id}"`);
  const regime: Target['regime'] = {};
  for (const [k, v] of Object.entries(p.regime)) if (v) regime[k as RegimeAxis] = v.value;
  for (const [k, v] of Object.entries(overrides)) if (v !== undefined) regime[k as RegimeAxis] = v;
  const continuous: Target['continuous'] = {};
  for (const [k, v] of Object.entries(p.continuous)) if (v) continuous[k as ContinuousAxis] = v.value;
  return { regime, continuous };
}
