// Presentation helpers for the engine's regime envelopes: stable order, colors, shapes, names.

import { REGIME_AXES, REGIME_VALUES, type RegimeEnvelope, type RegimeState } from "./engine";
import { GRAVITY_SHORT, valueLabel } from "./units";

function rank(s: RegimeState): number {
  if (s.state !== "known") return 99;
  const order = REGIME_VALUES[s.axis as keyof typeof REGIME_VALUES] ?? [];
  const i = order.indexOf(s.values[0]);
  return i === -1 ? 98 : i;
}

/** Complete regimes first, in a fixed order, so a layer keeps its color whatever the target does. */
export function sortEnvelopes(envs: readonly RegimeEnvelope[]): RegimeEnvelope[] {
  return envs.toSorted((a, b) => {
    if (a.regimeComplete !== b.regimeComplete) return a.regimeComplete ? -1 : 1;
    for (const axis of REGIME_AXES) {
      const sa = a.regime.find((s) => s.axis === axis);
      const sb = b.regime.find((s) => s.axis === axis);
      const d = (sa ? rank(sa) : 99) - (sb ? rank(sb) : 99);
      if (d !== 0) return d;
    }
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}

/** Categorical slot per complete layer, fixed order, never cycled; incomplete layers are gray. */
export function colorMap(envs: readonly RegimeEnvelope[]): Map<string, string> {
  const m = new Map<string, string>();
  let i = 0;
  for (const e of envs) {
    if (!e.regimeComplete || i >= 8) m.set(e.key, "var(--s-other)");
    else m.set(e.key, `var(--s${++i})`);
  }
  return m;
}

const stateText = (s: RegimeState | undefined, short = false) => {
  if (!s || s.state === "missing") return "?";
  if (s.state === "conflicting") return s.values.map((v) => valueLabel(v)).join("/");
  const v = s.values[0];
  return short && s.axis === "gravity_regime" ? GRAVITY_SHORT[v] ?? valueLabel(v) : valueLabel(v);
};

/** "μg · solid · N₂" (one entry per regime axis the engine knows). */
export const envelopeName = (e: { regime: readonly RegimeState[] }) =>
  REGIME_AXES.map((a) => stateText(e.regime.find((s) => s.axis === a), true)).join(" · ");

export const envelopeLongName = (e: { regime: readonly RegimeState[] }) =>
  REGIME_AXES.map((a) => {
    const s = e.regime.find((x) => x.axis === a);
    return `${a.replaceAll("_", " ")} ${stateText(s)}`;
  }).join(", ");

export function fuelPhaseOf(e: RegimeEnvelope): string {
  const s = e.regime.find((x) => x.axis === "fuel_phase");
  return s && s.state === "known" ? s.values[0] : "unknown";
}

/** Plain description of a target regime; unstated axes are named as such. */
export function targetRegimeName(regime: Partial<Record<string, string>>): string {
  const suffix: Record<string, string> = { fuel_phase: " fuel", diluent: " diluent", flame_type: " flame" };
  return REGIME_AXES.map((a) => {
    const v = regime[a];
    return v ? `${valueLabel(v)}${suffix[a] ?? ""}` : `${a.replaceAll("_", " ")} not stated`;
  }).join(", ");
}
