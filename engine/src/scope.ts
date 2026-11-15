// What a verdict compared and what it did not. A verdict is a comparison of recorded conditions: it is not a finding that a
// test was run at the target condition, and it does not compare material, geometry or flow configuration.

import { axisLabel } from './labels.ts';
import { CONTINUOUS_AXES, REGIME_AXES, type Target } from './types.ts';

/** Variables no verdict ever compares: the engine has no axis for them. */
export const NEVER_COMPARED: readonly string[] = [
  'material or fuel composition within a phase',
  'sample geometry and orientation',
  'flow direction and configuration',
  'ignition source',
];

export const COMPARISON_NOTE =
  'Inside the tested range means the condition lies within the oxygen-pressure ranges (and any other stated axes) of recorded tests of one investigation. ' +
  'It is a comparison of recorded conditions, not a finding that a test was run at this exact condition, and it does not compare the variables listed as not compared.';

export interface ComparisonScope {
  /** Axes the target states and the engine compared, as readers name them. */
  compared: string[];
  /** Axes the target left open, plus the variables no verdict compares. */
  notCompared: string[];
  note: string;
}

/** Which axes this target made the engine compare, and which it did not. */
export function comparisonScope(target: Target): ComparisonScope {
  const compared: string[] = [];
  const open: string[] = [];
  for (const axis of REGIME_AXES) (target.regime[axis] !== undefined ? compared : open).push(axisLabel(axis));
  for (const axis of CONTINUOUS_AXES) {
    if (axis === 'gravity_level') continue; // shown, never compared (the regime is what is compared)
    if (target.continuous[axis] !== undefined) compared.push(axisLabel(axis));
  }
  return { compared, notCompared: [...open.map((a) => `${a} (left open)`), ...NEVER_COMPARED], note: COMPARISON_NOTE };
}
