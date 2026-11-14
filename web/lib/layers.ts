// Presentation helpers for envelope layers: stable order, colors, shapes, names.

import { DILUENT_LABEL, GRAVITY_SHORT } from "./units";
import type { EnvelopeLayer, Regime } from "./types";

const G_ORDER = ["microgravity", "partial_gravity", "normal_gravity"];
const F_ORDER = ["solid", "liquid", "gas"];
const D_ORDER = ["N2", "He", "CO2", "Ar", "mixed"];

const idx = (order: string[], v: string) => {
  const i = order.indexOf(v);
  return i === -1 ? order.length : i;
};

/** Stable order, so a layer keeps its color whatever the target or filters do. */
export function sortLayers(layers: EnvelopeLayer[]): EnvelopeLayer[] {
  return layers.toSorted(
    (a, b) =>
      idx(G_ORDER, a.regime.gravity_regime) - idx(G_ORDER, b.regime.gravity_regime) ||
      idx(F_ORDER, a.regime.fuel_phase) - idx(F_ORDER, b.regime.fuel_phase) ||
      idx(D_ORDER, a.regime.diluent) - idx(D_ORDER, b.regime.diluent) ||
      a.key.localeCompare(b.key),
  );
}

/** CSS custom property of the layer's categorical slot (fixed order, never cycled). */
export const layerColor = (i: number) => (i < 8 ? `var(--s${i + 1})` : "var(--s-other)");

export const regimeName = (r: Regime) =>
  `${GRAVITY_SHORT[r.gravity_regime] ?? r.gravity_regime} · ${r.fuel_phase} · ${DILUENT_LABEL[r.diluent] ?? r.diluent}`;

export const regimeLongName = (r: Regime) =>
  `${r.gravity_regime.replace("_", " ")}, ${r.fuel_phase} fuel, ${DILUENT_LABEL[r.diluent] ?? r.diluent} diluent`;

export const sameRegime = (a: Regime, b: Regime) =>
  a.gravity_regime === b.gravity_regime && a.fuel_phase === b.fuel_phase && a.diluent === b.diluent;
