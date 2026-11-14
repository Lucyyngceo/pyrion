export const KPA_PER_PSI = 6.894757;
export const ATM_KPA = 101.325;

export const psiToKpa = (psi: number) => psi * KPA_PER_PSI;
export const kpaToPsi = (kpa: number) => kpa / KPA_PER_PSI;

export function fmt(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** O2 mole fraction shown as mole percent. */
export const pctO2 = (x: number, digits = 1) => `${fmt(x * 100, digits)} %`;
export const kPa = (p: number, digits = 1) => `${fmt(p, digits)} kPa`;
export const psia = (p: number, digits = 1) => `${fmt(kpaToPsi(p), digits)} psia`;

export const GRAVITY_LABEL: Record<string, string> = {
  microgravity: "microgravity",
  partial_gravity: "partial gravity",
  normal_gravity: "normal gravity (1 g)",
};
export const GRAVITY_SHORT: Record<string, string> = {
  microgravity: "μg",
  partial_gravity: "partial g",
  normal_gravity: "1 g",
};
export const DILUENT_LABEL: Record<string, string> = {
  N2: "N₂",
  He: "He",
  CO2: "CO₂",
  Ar: "Ar",
  mixed: "mixed",
};
