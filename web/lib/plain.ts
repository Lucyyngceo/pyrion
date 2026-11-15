// Plain-language phrasing of engine output for people who are not combustion engineers.
// Only wording: every fact comes from the engine's output, and no verdict is changed or softened here.

import type { AxisCheck, ClusterVerdict, RegimeState, Verdict } from "./engine";
import { fmt, valueLabel } from "./units";

/** One sentence each, consistent with the Method page. */
export const GLOSSARY: Record<string, string> = {
  "regime barrier": "A different physical regime: gravity, fuel phase, diluent or flame type. It is not a worse match, it is not comparable, so no distance is computed across it.",
  extrapolation: "The same regime, but your condition lies outside the range PSI tested. Any value would have to be extended beyond the measurements.",
  "insufficient evidence": "The extracted records do not state enough to compare, for example a value the test did not record. PYRION does not guess.",
  envelope: "The area of the oxygen-by-pressure plane covered by an investigation's measured test points.",
  "convex hull": "The smallest outline without dents around the measured points. A target inside it is covered by measurements.",
  "measurement tolerance": "A margin of 0.5 % so that a target exactly on the edge of a measured range, within measurement error, counts as inside.",
};

const AXIS_NAME: Record<string, string> = {
  o2_mole_fraction: "oxygen",
  burner_o2_mole_fraction: "burner oxygen",
  pressure: "pressure",
  flow_velocity: "flow speed",
  sample_thickness: "sample thickness",
  droplet_diameter_initial: "initial droplet size",
  ambient_temperature: "ambient temperature",
  gravity_level: "gravity level",
  gravity_regime: "gravity",
  fuel_phase: "fuel phase",
  diluent: "diluent",
  flame_type: "flame type",
};
export const axisWord = (a: string) => AXIS_NAME[a] ?? a.replaceAll("_", " ");

const GRAVITY_WORDS: Record<string, string> = { microgravity: "microgravity", partial_gravity: "partial gravity", normal_gravity: "normal gravity (1 g)" };
const DILUENT_WORDS: Record<string, string> = { N2: "N₂", He: "He", CO2: "CO₂", Ar: "Ar", mixed: "mixed gas" };

/** "microgravity · gas fuel · N₂ diluent · normal flame": the regime of a cluster or layer, in words. */
export function regimeWords(regime: readonly RegimeState[]): string {
  const part = (axis: string, text: (v: string) => string, unstated: string) => {
    const s = regime.find((x) => x.axis === axis);
    if (!s || s.state === "missing") return unstated;
    if (s.state === "conflicting") return `${s.values.map(text).join(" or ")} (records disagree)`;
    return text(s.values[0]);
  };
  return [
    part("gravity_regime", (v) => GRAVITY_WORDS[v] ?? valueLabel(v), "gravity not stated"),
    part("fuel_phase", (v) => `${v} fuel`, "fuel phase not stated"),
    part("diluent", (v) => `${DILUENT_WORDS[v] ?? v} diluent`, "diluent not stated"),
    part("flame_type", (v) => `${v} flame`, "flame not stated"),
  ].join(" · ");
}

/** The value of a range bound with its unit, for a sentence. */
function show(axis: string, v: number, unit: string): string {
  if (axis === "o2_mole_fraction" || axis === "burner_o2_mole_fraction") return `${fmt(v * 100, 1)} %`;
  return `${fmt(v, 2)} ${unit}`;
}

/** "oxygen is 4.0 points above the highest tested value (35 %)" for one axis outside its range; null when inside. */
export function plainGap(a: AxisCheck): string | null {
  if (a.status === "inside" || a.status === "missing" || a.gap === null) return null;
  const name = axisWord(a.axis);
  const isO2 = a.axis === "o2_mole_fraction" || a.axis === "burner_o2_mole_fraction";
  const amount = isO2 ? `${fmt(a.gap * 100, 1)} points` : `${fmt(a.gap, 2)} ${a.unit}`;
  const above = a.status === "above";
  const bound = above ? a.max : a.min;
  return `${name} is ${amount} ${above ? "above the highest" : "below the lowest"} tested value${bound !== null ? ` (${show(a.axis, bound, a.unit)})` : ""}`;
}

/** Why an investigation cannot be placed, in words, from the engine's reason codes. */
function whyUnplaced(c: ClusterVerdict): string {
  const out: string[] = [];
  for (const r of c.reasons) {
    if (r.informational) continue;
    if (r.code === "regime_missing") out.push(`it did not record ${axisWord(r.axis ?? "its regime")}`);
    else if (r.code === "regime_conflicting") out.push(`its records disagree on ${axisWord(r.axis ?? "its regime")}`);
    else if (r.code === "axis_missing") out.push(r.axis ? `it did not record ${axisWord(r.axis)}` : "no single test recorded all the values your condition states");
    else if (r.code === "target_regime_unstated") out.push(`your condition leaves ${axisWord(r.axis ?? "an axis")} open`);
    else if (r.code === "unpaired_values") out.push("it lists several oxygen and pressure values without saying which go together");
  }
  const uniq = [...new Set(out)];
  return uniq.length ? uniq.slice(0, 2).join(", and ") : "the extracted records do not state enough";
}

export interface PlainVerdict {
  /** One sentence for people. */
  sentence: string;
  /** A short line for experts. Never "undefined": it says when a number does not exist for the verdict. */
  technical: string;
}

export function plainVerdict(verdict: Verdict, c: ClusterVerdict | undefined): PlainVerdict {
  const regime = c ? regimeWords(c.regime) : "";
  const tests = c ? `${c.tests.length} test${c.tests.length === 1 ? "" : "s"}` : "";
  const technical = !c
    ? "No detail available."
    : c.distance !== null
      ? `Normalized distance ${Number(c.distance.toPrecision(3))}: ${c.distanceNote}.`
      : `No distance for this verdict (${verdict === "REGIME_BARRIER" ? "a regime barrier has none" : "the target cannot be placed"}).`;
  switch (verdict) {
    case "APPLICABLE":
      return { sentence: `Inside the tested range: your oxygen and pressure fall within points measured in ${regime}${tests ? ` (${tests})` : ""}.`, technical };
    case "EXTRAPOLATION": {
      const gaps = (c?.axes ?? []).map(plainGap).filter((g): g is string => g !== null);
      const text = gaps.length
        ? `Outside the tested range: ${gaps.slice(0, 2).join("; ")}.`
        : "Each value is inside its own tested range, but this combination of oxygen and pressure was not tested together.";
      return { sentence: text, technical };
    }
    case "INSUFFICIENT_EVIDENCE":
      return { sentence: `Cannot place your condition here: ${c ? whyUnplaced(c) : "not enough was recorded"}.`, technical };
    case "REGIME_BARRIER":
      return { sentence: `Not comparable: it measured a different regime (${regime || "regime differs"}). A different regime is not a worse match.`, technical };
  }
}
