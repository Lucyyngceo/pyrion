// What the chart says about the target, derived only from the engine's output.

import type { Evaluation, Target, TargetLocation, Verdict } from "./engine";
import { targetRegimeName } from "./layers";

export type Tone = "inside" | "outside" | "unknown";

export interface EnvelopeStatus {
  tone: Tone;
  headline: string;
  detail: string;
  counts: Record<Verdict, number>;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function envelopeStatus(evaluation: Evaluation, locations: TargetLocation[], target: Target): EnvelopeStatus {
  const counts = evaluation.counts.investigations;
  const regime = targetRegimeName(target.regime);

  if (counts.APPLICABLE > 0) {
    return {
      tone: "inside",
      headline: "Inside the measured envelope",
      detail: `${plural(counts.APPLICABLE, "investigation")} measured ${regime} around this O₂ and pressure.`,
      counts,
    };
  }

  // Points whose regime is not fully stated, or that the target leaves open, and whose hull
  // holds the target: the engine cannot say inside or outside, and neither can the chart.
  const undecided = locations.filter((l) => l.sameRegime === null && l.insideHull === true);
  if (undecided.length > 0) {
    return {
      tone: "unknown",
      headline: "Undetermined",
      detail: `The target falls among measured points whose regime is not fully stated in the extracted records, or that the target leaves open (${regime}). PYRION does not guess a regime: insufficient evidence.`,
      counts,
    };
  }

  if (counts.EXTRAPOLATION > 0) {
    return {
      tone: "outside",
      headline: "Outside the measured envelope",
      detail: `${regime} was measured, but not at this O₂ and pressure: ${plural(counts.EXTRAPOLATION, "investigation")} would need extrapolation.`,
      counts,
    };
  }

  const parts = [
    counts.REGIME_BARRIER ? `${plural(counts.REGIME_BARRIER, "investigation")} measured a different regime (not comparable)` : "",
    counts.INSUFFICIENT_EVIDENCE ? `${plural(counts.INSUFFICIENT_EVIDENCE, "investigation")} lack the values to compare` : "",
  ].filter(Boolean);
  return {
    tone: "outside",
    headline: "Outside the measured envelope",
    detail: `No extracted PSI test in ${regime} covers this O₂ and pressure.${parts.length ? ` ${parts.join("; ")}.` : ""}`,
    counts,
  };
}
