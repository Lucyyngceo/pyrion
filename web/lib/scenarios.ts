// What each scenario tile says, computed from the engine's evaluation (never typed).
// Pure: takes an Evaluation and the investigation list, returns plain facts.

import type { ClusterVerdict, Evaluation, ExtrapolationLevel } from "./engine";
import { EXTRAPOLATION_LEVEL_ORDER } from "./engine";

export interface SolidFuelFact {
  /** Investigations whose solid-fuel clusters are APPLICABLE. */
  applicable: string[];
  /** When none applies: the nearest solid-fuel investigation that needs extrapolation, with its level. */
  closest?: { accession: string; level?: ExtrapolationLevel };
  /** Solid-fuel investigations the engine cannot compare here (different regime excluded). */
  undecided: number;
}

export interface ScenarioFacts {
  applicable: number;
  extrapolation: number;
  /** Applicable investigations by fuel phase, e.g. { gas: 3, liquid: 1 }. */
  applicableByFuel: Record<string, number>;
  solid: SolidFuelFact;
  /** Investigations with at least one cluster in a partial-gravity regime (from the extracted records). */
  partialGravity: number;
  untested: boolean;
}

const fuelOfKey = (key: string): string => {
  const part = key.split("|").find((p) => p.startsWith("fuel_phase="));
  const v = part?.split("=")[1] ?? "?";
  return v === "?" ? "unknown" : v;
};

const rank = (l: ExtrapolationLevel | undefined) => (l ? EXTRAPOLATION_LEVEL_ORDER.indexOf(l) : EXTRAPOLATION_LEVEL_ORDER.length);

export function scenarioFacts(evaluation: Evaluation): ScenarioFacts {
  const clusters: ClusterVerdict[] = [...evaluation.ranked, ...evaluation.unranked];
  const applicableByFuel: Record<string, number> = {};
  for (const iv of evaluation.investigations) {
    if (iv.verdict !== "APPLICABLE") continue;
    const f = fuelOfKey(iv.decidingCluster ?? "");
    applicableByFuel[f] = (applicableByFuel[f] ?? 0) + 1;
  }
  const solidClusters = clusters.filter((c) => fuelOfKey(c.clusterKey) === "solid" && c.verdict !== "REGIME_BARRIER");
  const applicable = [...new Set(solidClusters.filter((c) => c.verdict === "APPLICABLE").map((c) => c.accession))];
  let closest: SolidFuelFact["closest"];
  if (applicable.length === 0) {
    const ext = solidClusters
      .filter((c) => c.verdict === "EXTRAPOLATION")
      .toSorted((a, b) => rank(a.extrapolationLevel) - rank(b.extrapolationLevel) || (a.distance ?? 1e9) - (b.distance ?? 1e9));
    if (ext[0]) closest = { accession: ext[0].accession, level: ext[0].extrapolationLevel };
  }
  const undecided = new Set(solidClusters.filter((c) => c.verdict === "INSUFFICIENT_EVIDENCE").map((c) => c.accession)).size;
  const partialGravity = new Set(clusters.filter((c) => c.clusterKey.split("|").includes("gravity_regime=partial_gravity")).map((c) => c.accession)).size;
  return {
    applicable: evaluation.counts.investigations.APPLICABLE,
    extrapolation: evaluation.counts.investigations.EXTRAPOLATION,
    applicableByFuel,
    solid: { applicable, closest, undecided },
    partialGravity,
    untested: !!evaluation.regimeUntested,
  };
}

const FUEL_WORDS: Record<string, string> = { gas: "gas fuel", liquid: "liquid fuel", solid: "solid fuel", unknown: "fuel not stated" };

/** "3 gas fuel, 1 liquid fuel" */
export function fuelSplit(by: Record<string, number>): string {
  return Object.entries(by)
    .toSorted((a, b) => b[1] - a[1])
    .map(([f, n]) => `${n} ${FUEL_WORDS[f] ?? f}`)
    .join(", ");
}
