// The "Fire-safety equipment & Earth" cards of /more (Grok round 7). Pure data and helpers, no file access.
// Every sentence shown on a card is a verbatim quote, either from a PSI record field (checked word for word in
// web/test/more-equipment.test.ts against data/derived/investigation_profiles.json and, when present, the PSI JSON)
// or from the official challenge page (checked against CHALLENGE_SENTENCES below, copied from that page on
// 2026-11-15). Relative imports only, so `node --test` can load this file directly.

export const CHALLENGE_SOURCE = "NASA Space Apps 2026 challenge statement";
export const CHALLENGE_URL = "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/";

/** Whole sentences of the challenge page that the cards quote from, copied as written (typographic apostrophes kept). */
export const CHALLENGE_SENTENCES = [
  "NASA’s spacecraft fire safety work is focused on prevention, detection, and suppression.",
  "Prevention is achieved by controlling ignition sources and through material selection, which depends on understanding flammability limits.",
  "Flammability studies focus on solid materials such as fabrics and plastics, as studied in the Burning and Suppression of Solids (BASS and BASS-II) and Spacecraft Fire Safety Demonstration (Saffire-I, -II, and -III) investigations.",
  "Fire detection was tested in microgravity through the Smoke and Aerosol Measurement Experiment studies (SAME and SAME-R).",
  "Suppression was studied in the Flame Extinguishment Experiment (FLEX) through dilution of the chamber atmosphere with carbon dioxide and helium, both of which suppress fire.",
  "Fine-water-mist extinguishers developed for use on the ISS have practical applications here on Earth, and NASA technology has similarly led to improvements in terrestrial smoke detection and firefighter gear, including protective clothing and air tanks.",
] as const;

export type EquipmentSource = { kind: "psi"; accession: string; field: "objective" | "researchImpacts" | "approach" | "title" } | { kind: "challenge" };

export interface EquipmentQuote {
  /** Verbatim text. A challenge quote may be a part of one sentence of CHALLENGE_SENTENCES (then `excerpt` is true). */
  text: string;
  source: EquipmentSource;
  excerpt?: boolean;
}

export type SafetyLeg = "detection" | "suppression" | "prevention";

export interface EquipmentCard {
  leg: SafetyLeg;
  title: string;
  quotes: EquipmentQuote[];
  /** PSI accessions linked as /investigations/<accession>. */
  investigations: string[];
}

const psi = (accession: string, field: "objective" | "researchImpacts" | "approach" | "title", text: string): EquipmentQuote => ({ text, source: { kind: "psi", accession, field } });
const challenge = (text: string, excerpt = false): EquipmentQuote => ({ text, source: { kind: "challenge" }, ...(excerpt ? { excerpt } : {}) });

export const EQUIPMENT_INTRO: EquipmentQuote = challenge(CHALLENGE_SENTENCES[0]);

export const EQUIPMENT_CARDS: readonly EquipmentCard[] = [
  {
    leg: "detection",
    title: "Detection: smoke and aerosol measurements",
    quotes: [
      challenge(CHALLENGE_SENTENCES[3]),
      psi("PSI-102", "researchImpacts", "The SAME experiment will provide technology for an advanced fire detector for future spacecraft"),
      psi("PSI-101", "researchImpacts", "the results from SAME-R can lead to technology for an advanced fire detector for future spacecraft"),
      challenge("NASA technology has similarly led to improvements in terrestrial smoke detection", true),
    ],
    investigations: ["PSI-102", "PSI-101"],
  },
  {
    leg: "suppression",
    title: "Suppression: diluting the atmosphere",
    quotes: [
      challenge(CHALLENGE_SENTENCES[4]),
      psi("PSI-69", "objective", "measure the effectiveness of various gaseous fire suppressants such as CO2, He, and SF6"),
      challenge("Fine-water-mist extinguishers developed for use on the ISS have practical applications here on Earth", true),
    ],
    investigations: ["PSI-69"],
  },
  {
    leg: "prevention",
    title: "Prevention: material flammability and material selection",
    quotes: [
      challenge(CHALLENGE_SENTENCES[1]),
      challenge(CHALLENGE_SENTENCES[2]),
      psi(
        "PSI-26",
        "researchImpacts",
        "Current NASA spacecraft materials selection is based on a standard test method (NASA–STD–6001 Test 1) that segregates material based on 1-g behavior without consideration of low gravity effects.",
      ),
      psi("PSI-25", "objective", "Study the ignition, flame growth, flame spread, and extinction limits for solid fuels burning in low-velocity forced flows in microgravity."),
      psi("PSI-98", "objective", "investigate the low-g flammability limits compared to those obtained in NASA’s normal gravity material flammability screening test."),
    ],
    investigations: ["PSI-26", "PSI-25", "PSI-98", "PSI-99", "PSI-100"],
  },
];

/** The words shown after a quote: "PSI-69, field objective" or the challenge statement. */
export function equipmentSourceLabel(s: EquipmentSource): string {
  return s.kind === "psi" ? `PSI record ${s.accession}, field ${s.field}` : CHALLENGE_SOURCE;
}

/** Link to the lens matrix filtered by one safety leg (read by app/lenses/page.tsx). */
export const lensFilterHref = (leg: SafetyLeg) => `/lenses?leg=${leg}`;

/** The legs /lenses accepts in ?leg=; anything else shows every investigation. */
export const LENS_LEGS: readonly SafetyLeg[] = ["prevention", "detection", "suppression"];
export function parseLeg(v: string | string[] | undefined): SafetyLeg | null {
  const x = Array.isArray(v) ? v[0] : v;
  return (LENS_LEGS as readonly string[]).includes(x ?? "") ? (x as SafetyLeg) : null;
}
