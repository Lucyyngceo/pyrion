---
id: term-measurement-tolerance
title: Measurement tolerance
chapter: 11
order: 17
dataHelp: [result-technical]
sources: ["engine/src/types.ts"]
---

The 0.5 % of your own value by which you may miss a tested range or region and still count as inside. It stops 101.3 kPa and 101.325 kPa from giving different verdicts. A PYRION convention.

## For engineers

`MEASUREMENT_TOLERANCE_REL = 0.005` (`engine/src/types.ts:175`).
