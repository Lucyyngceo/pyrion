---
id: term-extrapolation-level
title: Extrapolation level
chapter: 11
order: 10
dataHelp: [verdict-ring, chart-map-legend]
sources: ["engine/src/levels.ts"]
---

How far outside the tested data an Extrapolation verdict is: *inside each tested range but this combination was not tested*, *just outside* (up to 10 %), *outside* (up to 30 %) or *far outside* (more than 30 %). It measures distance from the tested data, not reliability or safety.

## For engineers

`ExtrapolationLevel`, `EXTRAPOLATION_LEVELS = { just_outside: 0.1, outside: 0.3 }`, `EXTRAPOLATION_AXIS_FLOOR = 0.05` (`engine/src/levels.ts`).
