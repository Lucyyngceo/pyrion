// Code-first condition for the expert chat: the target a message states (or changes), read by the engine's extractor and
// converted by its unit table, so result.target is set whenever a condition is evaluated and the model never converts a unit.
// Pure TypeScript. The agent calls conditionFromMessage (or ensureTarget) BEFORE the model runs and puts the target in its state.

import { extractQuantities, targetFromQuantities, type Target, type TargetQuantities } from "../../../engine/src/index.ts";

export type ConditionSource = "question" | "follow_up" | "previous" | "none";

export interface ConditionResult {
  /** The condition to evaluate: stated now, merged with the previous one (a follow-up), the previous one, or null. */
  target: Target | null;
  source: ConditionSource;
  /** One line per conversion done by code ("8.2 psia → 56.54 kPa (×6.894757)"). */
  conversions: string[];
  /** Errors and warnings in plain words (gauge pressure, a number that is not a pressure, ...). */
  issues: string[];
  /** Numbers in the message that were not assigned to any quantity. */
  leftover: string[];
  /** Which quantities the message itself stated. */
  stated: string[];
}

/** Merge a follow-up's stated quantities into the previous target: only what was said changes. A new gravity regime drops a stale level. */
export function mergeTargets(prev: Target, next: Target): Target {
  const informational = { ...prev.informational, ...next.informational };
  if (next.regime.gravity_regime !== undefined && next.regime.gravity_regime !== prev.regime.gravity_regime && next.informational?.gravity_level === undefined) delete informational.gravity_level;
  if (next.regime.gravity_regime !== undefined && next.informational?.gravity_not_covered === undefined) delete informational.gravity_not_covered;
  return {
    regime: { ...prev.regime, ...next.regime },
    continuous: { ...prev.continuous, ...next.continuous },
    ...(Object.keys(informational).length > 0 ? { informational } : {}),
  };
}

const QUANTITY_KEYS = ["gravity", "o2", "pressure", "flow_velocity", "sample_thickness", "ambient_temperature"] as const;

/** A target that has what an evaluation needs to say something definite: oxygen, pressure and a gravity regime. */
export const isCompleteTarget = (t: Target) => t.continuous.o2_mole_fraction !== undefined && t.continuous.pressure !== undefined && t.regime.gravity_regime !== undefined;

export function conditionFromMessage(message: string, opts: { lastTarget?: Target | null } = {}): ConditionResult {
  const prev = opts.lastTarget ?? null;
  const ex = extractQuantities(message);
  const input: TargetQuantities = {};
  const stated: string[] = [];
  for (const k of QUANTITY_KEYS) {
    if (ex[k]) {
      input[k] = ex[k];
      stated.push(k);
    }
  }
  const issues = ex.issues.map((i) => i.message);
  let leftover = ex.leftover;
  // A follow-up such as "and at 25 %?" has no oxygen word, but after a previous condition a lone percentage can only be the
  // oxygen. This is the one context rule: it needs a previous target, no oxygen stated, and exactly one percentage left over.
  if (prev && !input.o2) {
    const pct = leftover.filter((x) => /^\d+(?:[.,]\d+)?\s*(?:%|percent|per cent|por ciento)$/i.test(x.trim()));
    if (pct.length === 1) {
      input.o2 = pct[0];
      stated.push("o2");
      leftover = leftover.filter((x) => x !== pct[0]);
    }
  }
  const base = { leftover, stated };

  if (stated.length === 0) {
    return prev ? { target: prev, source: "previous", conversions: [], issues, ...base } : { target: null, source: "none", conversions: [], issues, ...base };
  }
  const r = targetFromQuantities(input);
  if (!r.ok) return { target: null, source: "none", conversions: [], issues: [...issues, ...r.errors.map((e) => e.message)], ...base };
  const conversions = r.conversions.map((c) => c.display);
  const warnings = r.conversions.flatMap((c) => c.warnings);
  const complete = isCompleteTarget(r.target);
  if (!complete && prev) return { target: mergeTargets(prev, r.target), source: "follow_up", conversions, issues: [...issues, ...warnings], ...base };
  return { target: r.target, source: "question", conversions, issues: [...issues, ...warnings], ...base };
}

/** For the agent's state: sets `state.target` from the message (code first) and returns what it found. A message without a condition leaves the target as it was. */
export function ensureTarget(state: { target: Target | null }, message: string): ConditionResult {
  const r = conditionFromMessage(message, { lastTarget: state.target });
  if (r.target) state.target = r.target;
  return r;
}
