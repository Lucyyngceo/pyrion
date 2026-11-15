// What the chart says about the target, derived only from the engine's output.

import type { Evaluation, Target, TargetLocation, Verdict } from "./engine";
import { targetRegimeName } from "./layers";
import { kPa, pctO2, valueLabel } from "./units";

export type Tone = "inside" | "outside" | "unknown";

export interface EnvelopeStatus {
  tone: Tone;
  headline: string;
  /** One short line under the headline on the chart. */
  sub: string;
  detail: string;
  counts: Record<Verdict, number>;
}

import { countVerb, plural } from "./grammar";

export function envelopeStatus(evaluation: Evaluation, locations: TargetLocation[], target: Target): EnvelopeStatus {
  const counts = evaluation.counts.investigations;
  const regime = targetRegimeName(target.regime);
  const regimeStated = Object.keys(target.regime).length > 0;

  if (counts.APPLICABLE > 0) {
    // Inside a hull usually means between tests: say whether a measured test sits at this exact condition.
    const near = locations
      .filter((l) => l.sameRegime === true && l.insideHull === true && l.nearestTest)
      .map((l) => l.nearestTest as NonNullable<TargetLocation["nearestTest"]>)
      .sort((x, y) => Number(y.coincides) - Number(x.coincides))[0];
    const exactNote = near
      ? near.coincides
        ? ` A measured test sits at this condition (within the 0.5 % tolerance): ${near.accession} test ${near.test_id}, ${pctO2(near.o2_mole_fraction)} O₂, ${kPa(near.pressure)}.`
        : ` This exact condition lies between tests; no extracted PSI test was run at it. Nearest measured test: ${near.accession} test ${near.test_id}, ${pctO2(near.o2_mole_fraction)} O₂, ${kPa(near.pressure)}.`
      : "";
    return {
      tone: "inside",
      headline: "Inside the measured envelope",
      sub: `${plural(counts.APPLICABLE, "investigation")} applicable`,
      detail: (regimeStated
        ? `${plural(counts.APPLICABLE, "investigation")} measured ${regime} around this O₂ and pressure.`
        : `${plural(counts.APPLICABLE, "investigation")} measured tests around this O₂ and pressure (regime left open).`) + exactNote,
      counts,
    };
  }

  // An investigation the engine could not decide (INSUFFICIENT_EVIDENCE, e.g. its regime is not
  // fully stated) whose own hull holds the target: inside or outside cannot be told, so the chart does not say.
  const verdictOf = new Map([...evaluation.ranked, ...evaluation.unranked].map((c) => [`${c.accession}|${c.clusterKey}`, c.verdict]));
  const undecided = locations.flatMap((l) =>
    l.investigations.filter((i) => i.insideHull === true && verdictOf.get(`${i.accession}|${l.key}`) === "INSUFFICIENT_EVIDENCE"),
  );
  if (undecided.length > 0) {
    return {
      tone: "unknown",
      headline: "Undetermined",
      sub: "Nearby points lack a stated regime",
      detail: `The target (${regime}) falls inside measured points the engine cannot compare yet: their regime, or another value it needs, is not stated in the extracted records. PYRION does not guess: insufficient evidence.`,
      counts,
    };
  }

  if (counts.EXTRAPOLATION > 0) {
    return {
      tone: "outside",
      headline: "Outside the measured envelope",
      sub: "Same regime, other O₂ and pressure",
      detail: `${regimeStated ? `${regime} was measured` : "Tests were measured"}, but not at this O₂ and pressure: ${countVerb(counts.EXTRAPOLATION, "investigation", "needs", "need")} extrapolation.`,
      counts,
    };
  }

  if (evaluation.regimeUntested) {
    const ru = evaluation.regimeUntested;
    return {
      tone: "outside",
      headline: "No PSI test in this gravity regime",
      sub: "Measured in other gravity regimes only",
      detail: `The target is in ${valueLabel(ru.value)}. PSI tested ${ru.testedValues.length ? `${ru.testedValues.map(valueLabel).join(" and ")} only` : "no stated gravity regime"}, so nothing measured there can be compared with it.`,
      counts,
    };
  }

  const parts = [
    counts.REGIME_BARRIER ? `${plural(counts.REGIME_BARRIER, "investigation")} measured a different regime (not comparable)` : "",
    counts.INSUFFICIENT_EVIDENCE ? `${countVerb(counts.INSUFFICIENT_EVIDENCE, "investigation", "lacks", "lack")} the values to compare` : "",
  ].filter(Boolean);
  return {
    tone: "outside",
    headline: "Outside the measured envelope",
    sub: counts.REGIME_BARRIER > 0 && counts.INSUFFICIENT_EVIDENCE === 0 ? "No measured test in this regime" : "No comparable measured test",
    detail: `No extracted PSI test in ${regime} covers this O₂ and pressure.${parts.length ? ` ${parts.join("; ")}.` : ""}`,
    counts,
  };
}
