// TARS answers, built by code from the engine's output. The model never writes a fact here.
// Pure, relative .ts imports, so the tests run under node --test.

import type { Evaluation, ExperimentsNeeded, RouteSet, Target } from "../../../engine/src/index.ts";
import { levelSentence } from "../../../engine/src/labels.ts";

export interface Ref {
  accession: string;
  acronym: string;
  doi: string;
}
export interface Fact {
  id: string;
  /** One plain sentence. Identical in every mode. */
  text: string;
  /** Figures and reasons for people who want them (Advanced). */
  detail?: string;
  refs?: Ref[];
}
export interface Step {
  id: "read" | "verdicts" | "routes" | "gap";
  label: string;
  detail: string;
}
export interface ThreePart {
  target: Target;
  known: Fact[];
  unknown: Fact[];
  next: Fact[];
  /** SHA-256 of the engine's evaluation of this target, computed on the server. */
  fingerprint: string;
  steps: Step[];
  counts: Record<string, number>;
}

type Inv = { accession: string; acronym: string; doi: string };
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function threePart(opts: {
  target: Target;
  evaluation: Evaluation;
  routes: RouteSet | null;
  experiments: ExperimentsNeeded;
  investigations: readonly Inv[];
  fingerprint: string;
  readBy: string;
}): ThreePart {
  const { target, evaluation: ev, routes, experiments: ex, investigations, fingerprint, readBy } = opts;
  const inv = new Map(investigations.map((i) => [i.accession, i]));
  const ref = (a: string): Ref => ({ accession: a, acronym: inv.get(a)?.acronym ?? "", doi: inv.get(a)?.doi ?? "" });
  const c = ev.counts.investigations;
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const clusters = new Map([...ev.ranked, ...ev.unranked].map((x) => [`${x.accession}|${x.clusterKey}`, x]));

  // KNOWN: what the extracted PSI records support for this condition, with receipts.
  const known: Fact[] = [
    { id: "known-counts", text: `Of ${total} investigations: ${c.APPLICABLE} applicable, ${c.EXTRAPOLATION} need extrapolation, ${c.INSUFFICIENT_EVIDENCE} lack the values to compare, ${c.REGIME_BARRIER} were tested in a different regime.` },
  ];
  for (const iv of ev.investigations.filter((i) => i.verdict === "APPLICABLE").slice(0, 5)) {
    const cl = clusters.get(`${iv.accession}|${iv.decidingCluster}`);
    const main = (cl?.reasons ?? []).find((r) => !r.informational);
    known.push({
      id: `known-${iv.accession}`,
      text: `${iv.accession} ${inv.get(iv.accession)?.acronym ?? ""}: your oxygen and pressure fall inside what it measured.`.replace("  ", " "),
      detail: main ? [main.message, main.technicalNote].filter(Boolean).join(" ") : undefined,
      refs: [ref(iv.accession)],
    });
  }

  // UNKNOWN: where the evidence ends, and why.
  const unknown: Fact[] = [{ id: "unknown-gap", text: ex.gap.sentence, detail: ex.gap.detail.join(" ") || undefined }];
  if (ev.regimeUntested) unknown.push({ id: "unknown-regime", text: `No PSI test in this gravity regime: PSI tested ${ev.regimeUntested.testedValues.join(" and ").replaceAll("_", " ") || "no stated regime"} only.` });
  if (ex.zeroCoveragePhases.length > 0) unknown.push({ id: "unknown-phases", text: `No comparable test for ${ex.zeroCoveragePhases.map((p) => `${p} fuel`).join(", ")} at this regime.` });
  const extra = ev.investigations.filter((i) => i.verdict === "EXTRAPOLATION" && i.extrapolationLevel);
  for (const i of extra.slice(0, 3)) {
    unknown.push({ id: `unknown-${i.accession}`, text: `${i.accession} ${inv.get(i.accession)?.acronym ?? ""}: ${lc(levelSentence(i.extrapolationLevel!))}.`.replace("  ", " "), refs: [ref(i.accession)] });
  }

  // NEXT: the closest routes, and what would close the gap (a PYRION proposal, not a NASA plan).
  const next: Fact[] = [];
  for (const r of (routes?.routes ?? []).filter((x) => x.kind !== "different_regime").slice(0, 2)) {
    next.push({ id: `next-route-${r.accession}`, text: `${r.accession} ${inv.get(r.accession)?.acronym ?? ""}: ${r.sentence}`.replace("  ", " "), refs: [ref(r.accession)] });
  }
  for (const p of ex.priority.slice(0, 3)) next.push({ id: `next-priority-${p.rank}`, text: p.sentence });
  next.push({ id: "next-matrix", text: ex.testMatrix.sentence });
  next.push({ id: "next-remaining", text: ex.remainingGap.sentence });

  const steps: Step[] = [
    { id: "read", label: readBy, detail: "The numbers were read from your message; the engine converts units." },
    { id: "verdicts", label: "Engine verdicts", detail: `${total} investigations evaluated; fingerprint ${fingerprint.slice(0, 12)}…` },
    { id: "routes", label: "Routes to evidence", detail: `${routes?.routes.length ?? 0} routes found, ${routes?.unreachable.length ?? 0} investigations with no route.` },
    { id: "gap", label: "What would close the gap", detail: `${ex.testMatrix.pointCount} test points proposed (a PYRION proposal, not a NASA plan).` },
  ];
  return { target, known, unknown, next, fingerprint, steps, counts: { ...c } };
}

export type Mode = "easy" | "advanced" | "auto";
export type ResolvedMode = "easy" | "advanced";

/** Auto = Advanced for a condition question, Easy for a how-to question (for now). */
export function resolveMode(mode: Mode, route: "condition" | "support"): ResolvedMode {
  return mode === "auto" ? (route === "condition" ? "advanced" : "easy") : mode;
}

export interface View {
  mode: ResolvedMode;
  known: Fact[];
  unknown: Fact[];
  next: Fact[];
  /** Per-fact detail and receipts: shown in Advanced. */
  showDetail: boolean;
  /** The step list opens by default in Advanced. */
  stepsOpen: boolean;
}

/** Only presentation changes with the mode: the facts (ids and sentences) are exactly the same. */
export function viewFor(a: ThreePart, mode: ResolvedMode): View {
  return { mode, known: a.known, unknown: a.unknown, next: a.next, showDetail: mode === "advanced", stepsOpen: mode === "advanced" };
}
