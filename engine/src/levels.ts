// Distance levels for EXTRAPOLATION. The verdict itself never changes: a level only says how far outside the
// tested data a target is, so the word "extrapolation" carries information.
//
// 'combination'  inside every axis's tested range, but this (O2, pressure) combination was not tested.
// otherwise, per continuous axis outside its range: relative gap = gap / max(|nearest tested value|, axis floor);
// the worst axis decides: <= 10 % just_outside, <= 30 % outside, more far_outside.

export type ExtrapolationLevel = 'combination' | 'just_outside' | 'outside' | 'far_outside';

/** Lowest (closest to the tested data) first. */
export const EXTRAPOLATION_LEVEL_ORDER: readonly ExtrapolationLevel[] = ['combination', 'just_outside', 'outside', 'far_outside'];

/** PYRION convention, not a NASA value. Upper bounds of the relative gap. */
export const EXTRAPOLATION_LEVELS = { just_outside: 0.1, outside: 0.3 } as const;

/** The axis floor, as a fraction of the axis scale: keeps the relative gap finite when the nearest tested value is 0 or tiny. */
export const EXTRAPOLATION_AXIS_FLOOR = 0.05;

export const EXTRAPOLATION_LEVEL_NOTE =
  'PYRION convention: these levels measure distance from the tested data, not how reliable or safe the condition is; combustion can change abruptly near limits (e.g. extinction), so even "just outside" is an extrapolation.';

export const levelRank = (l: ExtrapolationLevel): number => EXTRAPOLATION_LEVEL_ORDER.indexOf(l);

/** The lower (closer) of two levels; undefined values are ignored. */
export function bestLevel(levels: readonly (ExtrapolationLevel | undefined)[]): ExtrapolationLevel | undefined {
  let best: ExtrapolationLevel | undefined;
  for (const l of levels) if (l !== undefined && (best === undefined || levelRank(l) < levelRank(best))) best = l;
  return best;
}

/** Relative gap of one axis that is outside its tested range. */
export function relativeGap(gap: number, nearestTested: number, axisScale: number): number {
  return gap / Math.max(Math.abs(nearestTested), EXTRAPOLATION_AXIS_FLOOR * axisScale);
}

/** Level from the relative gaps of the axes outside their ranges (none: the combination case). */
export function levelFromRelativeGaps(gaps: readonly number[]): ExtrapolationLevel {
  if (gaps.length === 0) return 'combination';
  const worst = Math.max(...gaps);
  return worst <= EXTRAPOLATION_LEVELS.just_outside ? 'just_outside' : worst <= EXTRAPOLATION_LEVELS.outside ? 'outside' : 'far_outside';
}
