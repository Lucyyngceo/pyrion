---
id: measurement-tolerance
title: "The 0.5 % numerical tolerance"
keywords: tolerance, 0.5 percent, numerical tolerance, measurement tolerance, 101.3 kpa, 14.7 psia, 760 mmhg, rounding, why 101.3 is applicable, within tolerance
chapter: 4
order: 9
dataHelp: [result-technical, result-reasons]
sources: ["engine/src/types.ts", "engine/src/geometry.ts"]
---

People type "101.3 kPa" or "14.7 psia" or "760 mmHg" for the same pressure. If an investigation was tested at exactly 101.325 kPa, treating those as different would make the same physical condition Applicable or Extrapolation depending on which digits you typed. So "inside the tested data" allows a tolerance of **0.5 % of your own value**, on every axis, and in the oxygen-pressure region.

When the tolerance is what puts you inside, the result says so: "Pressure: your 101.3 kPa (14.69 psia) is within the 0.5 % numerical tolerance (a PYRION convention) of the tested 101.3 kPa (14.70 psia)..." and marks it, so nobody mistakes it for an exact hit.

Why 0.5 %: it is the worst-case rounding of a value written with three significant figures (1.00 can hide up to ±0.5 %) so typed values that differ only by rounding give the same verdict. That is PYRION's own reasoning, **a numerical convention: not a NASA value and not the measurement uncertainty of any experiment**, and the note travels with the result.

It is deliberately small: 110 kPa against a test at 101.325 kPa is 8.6 % away and is an extrapolation.

## For engineers

`MEASUREMENT_TOLERANCE_REL = 0.005` (`engine/src/types.ts:175`) and `MEASUREMENT_TOLERANCE_NOTE` (same file): "PYRION convention, not a NASA value: a target within ±0.5 % of its own value of a measured range or tested region counts as inside it (rounding of typed values and typical instrument accuracy)."

Used in three places, with the same constant:

1. per-axis range check in `judgeCluster` (`tol = REL × |target|`);
2. the (O2, pressure) region: `hullNearBox(hull, target, REL × |o2| / scale_o2, REL × |p| / scale_p)` (`engine/src/geometry.ts:88`, Liang-Barsky segment clipping against the box padded by `EPS`);
3. the chart geometry `locateTarget` (`engine/src/envelope.ts`) and the evidence map (`evidenceMap`), so the chart can never show a point outside a region that the verdict calls inside.

Flags: `AxisCheck.viaTolerance`, `HullCheck.viaTolerance`, `TargetLocation.viaTolerance` (present only when true).

The tolerance is relative to the target's own value: a target of 0 has tolerance 0. Tests: `engine/test/judge.test.ts` (101.3, 101.325, 101.33, 760 mmHg and 14.7 psia agree; 110 kPa does not).
