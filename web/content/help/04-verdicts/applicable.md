---
id: applicable
title: Applicable
chapter: 4
order: 2
dataHelp: [verdict-headline, result-reasons]
sources: ["engine/src/verdict.ts"]
---

*Applicable* means that, for this investigation, every axis you set is inside the range its tests covered, and your oxygen and pressure together fall inside the region its tests cover.

Two details make this stricter than it sounds:

- "Inside" is checked on each axis separately **and** on oxygen and pressure together. A condition can be inside the oxygen range and inside the pressure range and still sit in an untested corner. That case is not Applicable (it is Extrapolation, level "combination").
- "Inside" allows a small measurement tolerance of 0.5 %, so typing 101.3 kPa instead of 101.325 kPa does not change the verdict.

Applicable does **not** mean "the same experiment". It means your numbers fall within what that investigation measured, in the same regime. The investigation's records, with their sources and DOI, are the receipt.

## For engineers

Per-axis check in `judgeCluster`: for each stated continuous axis, over the complete tests, `min`/`max` of recorded values; `tol = MEASUREMENT_TOLERANCE_REL × |target|`; the axis is inside if `min - tol ≤ target ≤ max + tol`. When only the tolerance puts it inside, `AxisCheck.viaTolerance` is `true` and the reason says "is within the 0.5 % measurement tolerance of the tested ..." (`engine/src/verdict.ts`).

Plane check: points `(o2/scale_o2, pressure/scale_p)` from `testPoints` of the complete tests; `convexHull` (`engine/src/geometry.ts:25`); inside if `hullContains` (`geometry.ts:70`, with `EPS = 1e-9`, `geometry.ts:10`) or `hullNearBox` (`geometry.ts:88`) with half-widths `0.005 × |value| / scale`. `HullCheck.viaTolerance` marks the tolerance case. Degenerate hulls (one point, one segment) use the same code; the zero-width case is why a tolerance exists (all records of one investigation at exactly 1 atm).

APPLICABLE needs at least one pairable point (`pts.length > 0`); `testPoints` returns `null` when two stated axes each have several values (pairing unknown).
