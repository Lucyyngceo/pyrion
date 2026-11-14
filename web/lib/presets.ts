import { psiToKpa } from "./units";
import type { Target } from "./types";

export interface Preset {
  id: string;
  label: string;
  /** Short line under the label. */
  summary: string;
  target: Target;
  source: { cite: string; url: string; quote?: string };
  /** What PYRION chose that the source does not state. */
  assumption?: string;
}

const CHALLENGE_URL = "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/";
const NESC_URL = "https://ntrs.nasa.gov/api/citations/20260003925/downloads/20260003925.pdf";

export const PRESETS: Preset[] = [
  {
    id: "iss",
    label: "ISS-like cabin air",
    summary: "21 % O₂ · 101.3 kPa (14.7 psi) · microgravity",
    target: { gravity_regime: "microgravity", fuel_phase: "solid", diluent: "N2", o2_mole_fraction: 0.21, pressure: 101.325 },
    source: {
      cite: "Sea-level air. Pressure as stated in the challenge text (NASA Space Apps 2026, Flame in Freefall).",
      url: CHALLENGE_URL,
      quote: "the Earth's pressure at sea level is 14.7 psi",
    },
    assumption: "Solid fuel (material flammability) and N₂ diluent are PYRION's choice; change them below.",
  },
  {
    id: "lunar",
    label: "Lunar base",
    summary: "30 % O₂ · 70.3 kPa (10.2 psi) · 0.16 g",
    target: {
      gravity_regime: "partial_gravity",
      gravity_level: 0.16,
      fuel_phase: "solid",
      diluent: "N2",
      o2_mole_fraction: 0.3,
      pressure: psiToKpa(10.2),
    },
    source: {
      cite: "NASA Space Apps 2026 challenge, Flame in Freefall.",
      url: CHALLENGE_URL,
      quote: "The intermediate oxygen concentration used on the Moon will likely be 30% or greater, with a corresponding pressure of 10.2 psi or less.",
    },
    assumption: "Uses the boundary values (30 % O₂, 10.2 psi). Lunar surface gravity ≈ 0.16 g. Solid fuel and N₂ diluent are PYRION's choice.",
  },
  {
    id: "nesc-265",
    label: "Exploration atmosphere A",
    summary: "26.5 % O₂ · 70.3 kPa (10.2 psia)",
    target: { gravity_regime: "microgravity", fuel_phase: "solid", diluent: "N2", o2_mole_fraction: 0.265, pressure: psiToKpa(10.2) },
    source: {
      cite: "NESC, Impacts of Reduced Pressure Atmospheres on ECLSS, NASA/TM-20260003925.",
      url: NESC_URL,
    },
    assumption: "Gravity set to microgravity (a spacecraft cabin in transit) by PYRION; the source defines only the atmosphere.",
  },
  {
    id: "nesc-34",
    label: "Exploration atmosphere B",
    summary: "34 % O₂ · 56.5 kPa (8.2 psia)",
    target: { gravity_regime: "microgravity", fuel_phase: "solid", diluent: "N2", o2_mole_fraction: 0.34, pressure: psiToKpa(8.2) },
    source: {
      cite: "NESC, Impacts of Reduced Pressure Atmospheres on ECLSS, NASA/TM-20260003925.",
      url: NESC_URL,
    },
    assumption: "Gravity set to microgravity (a spacecraft cabin in transit) by PYRION; the source defines only the atmosphere.",
  },
];

export const DEFAULT_PRESET = PRESETS[0];
