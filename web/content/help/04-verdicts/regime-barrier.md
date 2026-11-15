---
id: regime-barrier
title: Not comparable: the regime barrier
chapter: 4
order: 7
dataHelp: [verdict-headline, result-barrier-toggle, result-barrier-doi]
sources: ["engine/src/verdict.ts"]
---

Four things in your question are **regimes**, not numbers: the gravity regime (microgravity, partial gravity, normal gravity), the fuel phase (solid, liquid, gas), the diluent gas (nitrogen, helium, carbon dioxide, argon, mixed) and the flame type (normal, inverse). If you set one of them and an investigation was tested in a different one, the verdict is **Not comparable (different regime)**.

The key idea is that **infinity is not a big number**. A flame in microgravity burns without buoyancy; a flame on the Moon has a small but real buoyancy; the two are not near each other on a scale, they are different situations. So PYRION does not compute a distance across a regime, never ranks such an investigation, and never presents the switch as a small step. Its distance is "not defined", and the rest of the numbers are shown only as context.

A regime barrier decides alone: if the gravity differs, the verdict is the barrier even if other things are also missing. In the interface the barrier investigations are folded away until you open them, with their DOIs.

If you leave a regime axis open (not stated), it is not compared at all; the result says which axes you left open.

## For engineers

`REGIME_AXES` and `REGIME_VALUES` (`engine/src/types.ts`): gravity_regime ∈ {microgravity, partial_gravity, normal_gravity}; fuel_phase ∈ {solid, liquid, gas}; diluent ∈ {N2, He, CO2, Ar, mixed}; flame_type ∈ {normal, inverse}.

In `judgeCluster`, section "1. Regime axes: barriers, never distances": for each axis, target value `t`:

- `t === undefined`: not compared; reason `target_regime_unstated` (informational);
- cluster state `missing`: `regimeUnknown`;
- `!state.values.includes(t)`: `barrier = true`, reason `regime_barrier` ("<Axis>: you set X, the evidence is Y. Not comparable (different regime): no distance is defined across it.");
- cluster state `conflicting`: `regimeUnknown`;
- else `regime_match`.

A barrier overrides: `missing`/`conflicting` reasons of the other axes are marked informational. Axes and distances after a barrier are context only (`decided`). `ClusterVerdict.distance` is `null` and `distanceNote` is `'not defined: the target is across a regime barrier from this evidence'`.
