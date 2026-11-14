// What the chart says about the target, derived only from the engine's output.

import type { Evaluation, Target, TargetLocation, Verdict } from "./engine";
import { targetRegimeName } from "./layers";

export type Tone = "inside" | "outside" | "unknown";

export interface EnvelopeStatus {
  tone: Tone;
  headline: string;
  /** One short line under the headline on the chart. */
  sub: string;
  detail: string;
  counts: Record<Verdict, number>;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function envelopeStatus(
  evaluation: Evaluation,
  locations: TargetLocation[],
  layerState: Map<string, "match" | "open" | "dim">,
  target: Target,
): EnvelopeStatus {
  const counts = evaluation.counts.investigations;
  const regime = targetRegimeName(target.regime);

  if (counts.APPLICABLE > 0) {
    return {
      tone: "inside",
      headline: "Inside the measured envelope",
      sub: `${plural(counts.APPLICABLE, "investigation")} applicable`,
      detail: `${plural(counts.APPLICABLE, "investigation")} measured ${regime} around this O₂ and pressure.`,
      counts,
    };
  }

  // A layer the engine could not decide (INSUFFICIENT_EVIDENCE, e.g. its regime is not fully
  // stated) whose hull holds the target: inside or outside cannot be told, so the chart does not say.
  const undecided = locations.filter((l) => layerState.get(l.key) === "open" && l.insideHull === true);
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
    sub: counts.REGIME_BARRIER > 0 && counts.INSUFFICIENT_EVIDENCE === 0 ? "No measured test in this regime" : "No comparable measured test",
    detail: `No extracted PSI test in ${regime} covers this O₂ and pressure.${parts.length ? ` ${parts.join("; ")}.` : ""}`,
    counts,
  };
}
