---
id: evidence-map
title: The evidence map
chapter: 10
order: 2
dataHelp: [chart-map, chart-map-legend, chart-map-tip, evidence-map]
sources: ["engine/src/navigator.ts"]
---

The map behind the chart shows, for every pair of oxygen and pressure on a grid, how many investigations are *Applicable* and how many *Extrapolation*, for the regime you selected. A darker cell has more investigations; extrapolation cells are shaded in three tones by how far outside the closest investigation is.

The map is not a separate model. Each cell gives exactly what the engine would answer if you typed that oxygen and pressure: this is tested on hundreds of random cells. The map is fast because the tested regions are computed once and each cell is only a quick check against them.

It only varies oxygen and pressure. If you also set flow, thickness or temperature, those are not part of the map.

## For engineers

`evidenceMap(records, regime, { o2: [min, max, n], pressure: [min, max, n] }, options)` (`engine/src/navigator.ts:419`) returns `{ regime, o2Values, pressureValues, cells[], maxApplicable, maxExtrapolation }`; `cells` are row-major with pressure outer (`cells[i * o2Values.length + j]`), each `{ o2, pressure, applicable[], extrapolation[], extrapolationLevel? }`.

Implementation: `buildCorpus` once; per cluster precompute the fixed regime state (barrier / unknown / incomplete / ok), per-axis ranges over the complete tests and the convex hull of the paired points (`PreparedCluster`); per cell apply the same rules as `judgeCluster` (per-axis tolerance `inRange`, `hullContains || hullNearBox`), the investigation takes its best cluster; `extrapolationLevel` uses `relativeGap` and `levelFromRelativeGaps`. `linspace` gives n values from min to max inclusive (n = 1 gives min); invalid grids throw `RangeError`.

Tests (`engine/test/evidencemap.test.ts`, `levels.test.ts`): 200+ random cells equal `evaluate()` on fixtures and on the real records; 60 × 60 on the real records, median of 5 warm runs about 100 ms here (design target 150 ms); the timing assertion is `< 1000 ms` and skipped when `CI` is set.
