---
id: term-evidence-map
title: "Evidence map"
keywords: evidence map, map, shaded chart, grid cells, how many apply
chapter: 11
order: 9
dataHelp: [chart-map, evidence-map]
sources: ["engine/src/navigator.ts"]
---

The shaded background of the chart: for each oxygen and pressure on a grid, how many investigations are Applicable and how many Extrapolation, for the selected regime. See "The evidence map".

## For engineers

`evidenceMap(...)` (`engine/src/navigator.ts:419`); each cell equals `evaluate()` for that oxygen and pressure.
