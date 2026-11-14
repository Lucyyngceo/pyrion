// The single place where the web app talks to the applicability engine.
//
// Today: the web app's own provisional rules (./provisional-engine), because the PYRION
// engine in ../engine is still being written. When it exports a browser-safe
// buildEnvelope/evaluate, switch the imports below; nothing else in the UI changes.

import { buildEnvelope as provisionalEnvelope, evaluate as provisionalEvaluate } from "./provisional-engine";
import type {
  ConditionRecord,
  EngineInfo,
  EnvelopeLayer,
  Investigation,
  InvestigationResult,
  Target,
  Verdict,
} from "./types";

export const engineInfo: EngineInfo = {
  kind: "provisional",
  label: "Provisional rules in the web app (the PYRION engine module is not connected yet)",
};

export function buildEnvelope(records: ConditionRecord[]): EnvelopeLayer[] {
  return provisionalEnvelope(records);
}

const ORDER: Record<Verdict, number> = {
  APPLICABLE: 0,
  EXTRAPOLATION: 1,
  INSUFFICIENT_EVIDENCE: 2,
  REGIME_BARRIER: 3,
};

const accessionNumber = (a: string) => Number.parseInt(a.replace(/\D+/g, ""), 10) || 0;

/** One result per investigation, ordered: applicable, extrapolation (nearest first), insufficient, not comparable. */
export function evaluate(
  target: Target,
  records: ConditionRecord[],
  investigations: Investigation[],
): InvestigationResult[] {
  return provisionalEvaluate(target, records, investigations).toSorted(
    (a, b) =>
      ORDER[a.verdict] - ORDER[b.verdict] ||
      (a.distance ?? 0) - (b.distance ?? 0) ||
      accessionNumber(a.accession) - accessionNumber(b.accession) ||
      a.accession.localeCompare(b.accession),
  );
}
