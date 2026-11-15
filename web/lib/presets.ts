// Target presets. The Moon Base and NESC presets come from the engine (engine/src/presets.ts),
// with their sources, quotes and page numbers. The ISS preset is defined here in the same shape.

import { KPA_PER_PSI, PRESETS as ENGINE_PRESETS, type Preset, type SourceRef } from "./engine";
import { GRAVITY_SHORT, fmt, kpaToPsi } from "./units";

const NESC_URL = "https://ntrs.nasa.gov/api/citations/20260003925/downloads/20260003925.pdf";

const nescIss = (quote: string): SourceRef => ({
  id: "ntrs-20260003925",
  title: "NESC, Impacts of Reduced Pressure Atmospheres on ECLSS (NESC-RP-20-01610)",
  publisher: "NASA Engineering and Safety Center",
  identifier: "NASA/TM-20260003925 (NTRS 20260003925)",
  url: NESC_URL,
  locator: "page 18, section 6.2 Spacecraft Cabin Atmospheres for Exploration",
  quote,
});

const ISS_ATMOSPHERE = nescIss(
  "The ISS was designed and is operated to approximate an Earth-equivalent atmosphere of 14.7 psia with 21% O2.",
);
const ISS_MICROGRAVITY = nescIss(
  "aboard the ISS, where research into the physiological effects of living in microgravity is a primary mission objective",
);

export const ISS_PRESET: Preset = {
  id: "iss-cabin-air",
  label: "ISS cabin air",
  description: "The nominal ISS cabin atmosphere, 14.7 psia with 21% O2, in microgravity.",
  regime: {
    gravity_regime: {
      value: "microgravity",
      unit: "",
      value_original: "microgravity",
      unit_original: "",
      note: "As written in the source.",
      source: ISS_MICROGRAVITY,
    },
  },
  continuous: {
    o2_mole_fraction: {
      value: 0.21,
      unit: "1",
      value_original: "21",
      unit_original: "%",
      note: "21% by volume / 100, read as mole fraction (ideal gas).",
      source: ISS_ATMOSPHERE,
    },
    pressure: {
      value: 14.7 * KPA_PER_PSI,
      unit: "kPa",
      value_original: "14.7",
      unit_original: "psia",
      note: `14.7 psia × ${KPA_PER_PSI} kPa/psi.`,
      source: ISS_ATMOSPHERE,
    },
  },
  limits: [
    "The ISS controls its cabin between 13.9 and 15.2 psia, with at most 24.1 vol% O2 (same source); this preset is the nominal point.",
    "Fuel phase and diluent are not stated by the source.",
  ],
};

const SHORT_LABEL: Record<string, string> = {
  "iss-cabin-air": "ISS cabin air",
  "challenge-lunar-base": "NASA's Moon Base",
  "nesc-10.2psia-26.5o2-lunar": "Exploration atmosphere A",
  "nesc-8.2psia-34o2-lunar": "Exploration atmosphere B",
};

export interface PresetView {
  preset: Preset;
  short: string;
  summary: string;
}

function summaryOf(p: Preset): string {
  const o2 = p.continuous.o2_mole_fraction;
  const pr = p.continuous.pressure;
  const g = p.regime.gravity_regime?.value;
  const gl = p.continuous.gravity_level?.value;
  const parts = [
    o2 ? `${fmt(o2.value * 100, 1)} % O₂` : "",
    pr ? `${fmt(pr.value, 1)} kPa (${pr.value_original ? `${pr.value_original} ${pr.unit_original}` : `${fmt(kpaToPsi(pr.value), 1)} psi`})` : "",
    gl !== undefined ? `${fmt(gl, 2)} g` : g ? GRAVITY_SHORT[g] ?? g : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

export const PRESET_VIEWS: PresetView[] = [ISS_PRESET, ...ENGINE_PRESETS].map((preset) => ({
  preset,
  short: SHORT_LABEL[preset.id] ?? preset.label,
  summary: summaryOf(preset),
}));

/** Every distinct source a preset cites, in order of first use. */
export function sourcesOf(p: Preset): SourceRef[] {
  const seen = new Map<string, SourceRef>();
  for (const v of [...Object.values(p.regime), ...Object.values(p.continuous)]) {
    if (!v) continue;
    const key = `${v.source.id}|${v.source.quote}`;
    if (!seen.has(key)) seen.set(key, v.source);
  }
  return [...seen.values()];
}
