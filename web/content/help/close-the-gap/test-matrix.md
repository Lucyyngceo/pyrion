---
id: test-matrix
title: "The test matrix: target plus a bracketing grid"
keywords: test matrix, test points, oxygen steps, plus minus 4 points, plus minus 8 points, pressure 15 percent, how many tests, grid, bracketing, 15 points
chapter: 5
order: 2
dataHelp: [gap-section-matrix]
sources: ["engine/src/experiments.ts", "NTRS 20260001966 PDF p. 10"]
---

One test point does not make an envelope. The matrix surrounds your condition with neighbours so the results will show a region, not a dot:

- **Oxygen: your value, plus and minus 4 points, plus and minus 8 points.** Five values. For 30 % oxygen: 22, 26, 30, 34 and 38 %.
- **Pressure: your value, plus and minus 15 %.** Three values. For 70.3 kPa: 59.8, 70.3 and 80.9 kPa.

That is up to 15 test points, each at the gravity regime (and level, if you gave one) of your target.

Why these steps: the 4-point oxygen step is the size of the steps in FM2's own plan (25, 29, 33 and 37 %, NTRS 20260001966, PDF p. 10), so a neighbouring grid would be compatible with NASA's. The 8-point step is a coarse bracket, double that. The 15 % pressure step is PYRION's design choice, **not a NASA design**.

Points that would need more than 100 % oxygen (or a pressure of 0 or less) are dropped, so near-pure-oxygen targets get fewer points. If you set only oxygen or only pressure, only that axis is gridded.

## For engineers

Constants (`engine/src/experiments.ts`): `TEST_MATRIX_O2_OFFSETS_POINTS = [-8, -4, 0, 4, 8]` (line 16, points of oxygen: offset/100 is added to the mole fraction and rounded to 6 decimals), `TEST_MATRIX_PRESSURE_FRACTIONS = [-0.15, 0, 0.15]` (line 17, applied as `p × (1 + f)`, rounded to 8 significant digits), `TEST_MATRIX_NOTE`.

`matrixPoints` keeps oxygen values with `0 < x ≤ 1` and pressures `> 0`; a point is the Cartesian product; `isTarget` marks the point equal to the target. Result: `testMatrix { note, gravity: { regime?, level? }, points[], pointCount, sentence }`. Listing additional axes does not change `pointCount`.

Sentence example: "15 test points in partial gravity: oxygen from 22 % to 38 % and pressure from 59.8 kPa (8.67 psia) to 80.9 kPa (11.7 psia), around the target."

Source of the ±4-point rationale: FM2 starting atmospheres 37, 33, 29 and 25 % at 8.2 psia (NTRS 20260001966, PDF p. 10, slide 9).
