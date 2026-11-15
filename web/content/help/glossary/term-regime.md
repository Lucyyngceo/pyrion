---
id: term-regime
title: "Regime"
keywords: regime, gravity, fuel phase, diluent, flame type, category axis, barrier
chapter: 11
order: 23
dataHelp: [ctl-regime-axis]
sources: ["engine/src/types.ts"]
---

A situation that changes the physics of the flame so much that two investigations in different regimes are not near each other, however similar their numbers: gravity regime, fuel phase, diluent gas, flame type. No distance is defined across a regime.

## For engineers

`REGIME_AXES = ['gravity_regime', 'fuel_phase', 'diluent', 'flame_type']`, values in `REGIME_VALUES` (`engine/src/types.ts`).
