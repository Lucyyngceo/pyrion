// A preset defines the whole target. Pure, no runtime imports (types only).

import type { RegimeAxis } from "../../engine/src/index.ts";
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
