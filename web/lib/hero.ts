// The home page's one conclusion, computed by the engine from the repository's records on each build (never typed by hand).
// Moon Base corner from the challenge preset; gravity left open to find the nearest PSI solid-fuel evidence; FM2 from the planner.

import { KPA_PER_PSI, PRESETS, type ClusterVerdict } from "./engine";
import { evaluateOnServer } from "./server-eval";
import { loadPlanner } from "./planner/data";

export interface HeroConclusion {
  o2: number;
  psia: number;
  /** True when the engine reports that no PSI test was run at the target's (partial) gravity. */
  noLunarTest: boolean;
  nearest: { accession: string; acronym: string; gravity: string; o2Gap: number; o2Max: number | null; psiaAt: string } | null;
  fm2Psia: number | null;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const gravityOf = (v: ClusterVerdict) => v.regime.find((r) => r.axis === "gravity_regime")?.values.join(" / ").replaceAll("_", " ") ?? "not stated";

export async function heroConclusion(): Promise<HeroConclusion> {
  const moon = PRESETS.find((x) => x.id === "challenge-lunar-base")!;
  const o2 = moon.continuous.o2_mole_fraction!.value;
  const p = moon.continuous.pressure!.value;
  const lunar = await evaluateOnServer({ regime: { gravity_regime: "partial_gravity", fuel_phase: "solid" }, continuous: { o2_mole_fraction: o2, pressure: p } });
  const anyG = await evaluateOnServer({ regime: { fuel_phase: "solid" }, continuous: { o2_mole_fraction: o2, pressure: p } });
  const top = anyG.evaluation.ranked[0];
  let nearest: HeroConclusion["nearest"] = null;
  if (top) {
    const ax = top.axes.find((a) => a.axis === "o2_mole_fraction");
    const pa = top.axes.find((a) => a.axis === "pressure");
    const psiRange = pa && pa.min !== null && pa.max !== null ? (r1(pa.min / KPA_PER_PSI) === r1(pa.max / KPA_PER_PSI) ? `${r1(pa.min / KPA_PER_PSI)} psia` : `${r1(pa.min / KPA_PER_PSI)}–${r1(pa.max / KPA_PER_PSI)} psia`) : "pressure not stated";
    nearest = {
      accession: top.accession,
      acronym: anyG.investigations.find((i) => i.accession === top.accession)?.acronym ?? top.accession,
      gravity: gravityOf(top),
      o2Gap: ax?.gap != null ? r1(ax.gap * 100) : 0,
      o2Max: ax?.max != null ? r1(ax.max * 100) : null,
      psiaAt: psiRange,
    };
  }
  const fm2 = (await loadPlanner()).experiments.find((e) => e.id === "fm2");
  return {
    o2: r1(o2 * 100),
    psia: r1(p / KPA_PER_PSI),
    noLunarTest: Boolean(lunar.evaluation.regimeUntested),
    nearest,
    fm2Psia: fm2 && fm2.points.length > 0 ? r1(fm2.points[0].pressure_kpa / KPA_PER_PSI) : null,
  };
}
