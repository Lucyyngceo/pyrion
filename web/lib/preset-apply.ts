// A preset defines the whole target. Pure, no runtime imports (types only).

import type { RegimeAxis, Target } from "../../engine/src/index.ts";
import type { PresetView } from "./presets";

export interface TargetState {
  presetId: string | null;
  regime: Partial<Record<RegimeAxis, string>>;
  o2: number;
  pressure: number;
  gravityLevel?: number;
  /** The engine's note when a stated gravity has no regime in this dataset (for example above 1 g). */
  gravityNotCovered?: string;
}

/** Axes the preset's source does not state are "not stated", never the previous choice. */
export function applyPreset(state: TargetState, view: Pick<PresetView, "preset">): TargetState {
  const p = view.preset;
  const regime: TargetState["regime"] = {};
  for (const [axis, v] of Object.entries(p.regime)) if (v) regime[axis as RegimeAxis] = v.value;
  return {
    presetId: p.id,
    regime,
    o2: p.continuous.o2_mole_fraction?.value ?? state.o2,
    pressure: p.continuous.pressure?.value ?? state.pressure,
    gravityLevel: p.continuous.gravity_level?.value,
  };
}

/** The engine's target for a state: a gravity level is informational (shown, never compared). */
export function toTarget(s: TargetState): Target {
  const regime: Target["regime"] = {};
  for (const [k, v] of Object.entries(s.regime)) if (v) regime[k as keyof Target["regime"]] = v;
  const continuous: Target["continuous"] = { o2_mole_fraction: s.o2, pressure: s.pressure };
  const informational: NonNullable<Target["informational"]> = {};
  if (s.regime.gravity_regime === "partial_gravity" && s.gravityLevel !== undefined && Number.isFinite(s.gravityLevel)) informational.gravity_level = s.gravityLevel;
  if (s.gravityNotCovered) informational.gravity_not_covered = s.gravityNotCovered;
  return Object.keys(informational).length > 0 ? { regime, continuous, informational } : { regime, continuous };
}
