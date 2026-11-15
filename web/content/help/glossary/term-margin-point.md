---
id: term-margin-point
title: "Margin point"
keywords: margin point, margin, more severe point, oxygen partial pressure, matrix point
chapter: 11
order: 16
dataHelp: [gap-section-matrix]
sources: ["engine/src/experiments.ts"]
---

A point of the proposed test matrix with a higher oxygen partial pressure than your target: more severe than your target, so it shows how much room there is.

## For engineers

`MatrixPoint.marginPoint` iff `o2 × pressure` exceeds the target's (`engine/src/experiments.ts`).
