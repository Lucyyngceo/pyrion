import { regimeLongName } from "./layers";
import type { InvestigationResult, Target, Verdict } from "./types";

export type Tone = "inside" | "outside" | "unknown";

export interface EnvelopeStatus {
  tone: Tone;
  headline: string;
  detail: string;
  counts: Record<Verdict, number>;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What the chart says about the target. Derived only from the verdicts. */
export function envelopeStatus(results: InvestigationResult[], target: Target): EnvelopeStatus {
  const counts: Record<Verdict, number> = {
    APPLICABLE: 0,
    EXTRAPOLATION: 0,
    INSUFFICIENT_EVIDENCE: 0,
    REGIME_BARRIER: 0,
  };
  for (const r of results) counts[r.verdict]++;
  const regime = regimeLongName(target);

  if (counts.APPLICABLE > 0) {
    return {
      tone: "inside",
      headline: "Inside the measured envelope",
      detail: `${plural(counts.APPLICABLE, "investigation")} measured ${regime} around this O₂ and pressure.`,
      counts,
    };
  }
  if (counts.EXTRAPOLATION > 0) {
    return {
      tone: "outside",
      headline: "Outside the measured envelope",
      detail: `${regime} was measured, but not at this O₂ and pressure. ${plural(counts.EXTRAPOLATION, "investigation")} would need extrapolation.`,
      counts,
    };
  }
  if (counts.INSUFFICIENT_EVIDENCE > 0) {
    return {
      tone: "unknown",
      headline: "Insufficient evidence",
      detail: `${plural(counts.INSUFFICIENT_EVIDENCE, "investigation")} cannot be placed against ${regime} with the values extracted so far. PYRION does not guess.`,
      counts,
    };
  }
  return {
    tone: "outside",
    headline: "Outside the measured envelope",
    detail: `No extracted PSI test in ${regime}. Every investigation measured a different regime: not comparable.`,
    counts,
  };
}
