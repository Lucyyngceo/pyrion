---
id: term-gravity-regime
title: Gravity regime: microgravity, partial gravity, normal gravity
chapter: 11
order: 12
dataHelp: [ctl-regime-axis, ctl-gravity-level]
sources: ["engine/src/quantity.ts"]
---

The three gravity situations PSI's tests are sorted into: **microgravity** (as aboard the ISS or in a drop tower), **partial gravity** (the Moon, Mars) and **normal gravity** (the ground). A gravity level you type is turned into a regime with PYRION conventions: below 0.01 g microgravity, 0.01 up to 0.9 g partial, 0.9 to 1.1 g normal, above that not covered.

## For engineers

`REGIME_VALUES.gravity_regime = ['microgravity', 'partial_gravity', 'normal_gravity']`; `regimeOfLevel` (`engine/src/quantity.ts:399`); `MICROGRAVITY_BELOW_G = 0.01`, `NORMAL_GRAVITY_BAND = { lo: 0.9, hi: 1.1 }`.
