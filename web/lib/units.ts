export const ATM_KPA = 101.325;
const KPA_PER_PSI = 6.894757293168361;

export const kpaToPsi = (kpa: number) => kpa / KPA_PER_PSI;

export function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** O2 mole fraction shown as mole percent. */
export const pctO2 = (x: number, digits = 1) => `${fmt(x * 100, digits)} %`;
export const kPa = (p: number, digits = 1) => `${fmt(p, digits)} kPa`;
export const psia = (p: number, digits = 1) => `${fmt(kpaToPsi(p), digits)} psia`;

export const AXIS_LABEL: Record<string, string> = {
  gravity_regime: "Gravity regime",
  fuel_phase: "Fuel phase",
  diluent: "Diluent",
  flame_type: "Flame type",
};

const VALUE_LABEL: Record<string, string> = {
  microgravity: "microgravity",
  partial_gravity: "partial gravity",
  normal_gravity: "normal gravity (1 g)",
  N2: "N₂",
  CO2: "CO₂",
  He: "He",
  Ar: "Ar",
  mixed: "mixed",
};

export const GRAVITY_SHORT: Record<string, string> = {
  microgravity: "μg",
  partial_gravity: "partial g",
  normal_gravity: "1 g",
};

export const valueLabel = (v: string) => VALUE_LABEL[v] ?? v.replaceAll("_", " ");
export const axisLabel = (a: string) => AXIS_LABEL[a] ?? a.replaceAll("_", " ");

/** Readable version of an engine message: variable names and chemical formulas only, wording untouched. */
export function readable(message: string): string {
  return message
    .replaceAll("o2_mole_fraction+pressure", "(O₂, pressure)")
    .replaceAll("burner_o2_mole_fraction", "burner O₂ mole fraction")
    .replaceAll("o2_mole_fraction", "O₂ mole fraction")
    .replaceAll("droplet_diameter_initial", "initial droplet diameter")
    .replaceAll("gravity_regime", "gravity regime")
    .replaceAll("gravity_level", "gravity level")
    .replaceAll("fuel_phase", "fuel phase")
    .replaceAll("flame_type", "flame type")
    .replaceAll("flow_velocity", "flow velocity")
    .replaceAll("sample_thickness", "sample thickness")
    .replaceAll("ambient_temperature", "ambient temperature")
    .replaceAll("partial_gravity", "partial gravity")
    .replaceAll("normal_gravity", "normal gravity")
    .replace(/\bO2\b/g, "O₂")
    .replace(/\bN2\b/g, "N₂")
    .replace(/\bCO2\b/g, "CO₂");
}
