// TARS answers: the engine's threePartAnswer, once per mode. The model never writes a fact here.
// Pure, relative .ts imports, so the tests run under node --test.

import type { ThreePartAnswer } from "../../../engine/src/index.ts";

/** Both wordings of the same facts, built on the server; the client picks one by mode. */
export interface AnswerPair {
  easy: ThreePartAnswer;
  advanced: ThreePartAnswer;
  /** "Read by code" or "Read by <model>". */
  readBy: string;
}

export type Mode = "easy" | "advanced" | "auto";
export type ResolvedMode = "easy" | "advanced";

/** Auto = Advanced for a condition question, Easy for a how-to question (for now). */
export function resolveMode(mode: Mode, route: "condition" | "support"): ResolvedMode {
  return mode === "auto" ? (route === "condition" ? "advanced" : "easy") : mode;
}

export interface Step {
  id: string;
  label: string;
}
const STEP_LABELS: Record<string, string> = {
  evaluate: "Engine verdicts",
  routes: "Routes to evidence",
  routesToEvidence: "Routes to evidence",
  experiments: "What would close the gap",
  experimentsNeeded: "What would close the gap",
};

export interface View {
  mode: ResolvedMode;
  answer: ThreePartAnswer;
  steps: Step[];
  /** Per-fact detail and receipts: shown in Advanced. */
  showDetail: boolean;
  /** The step list opens by default in Advanced. */
  stepsOpen: boolean;
}

/** Only presentation changes with the mode: the engine gives the same facts in both wordings. */
export function viewFor(pair: AnswerPair, mode: ResolvedMode): View {
  const answer = mode === "easy" ? pair.easy : pair.advanced;
  const steps: Step[] = [{ id: "read", label: pair.readBy }, ...answer.steps.map((s) => ({ id: s, label: STEP_LABELS[s] ?? s }))];
  return { mode, answer, steps, showDetail: mode === "advanced", stepsOpen: mode === "advanced" };
}
