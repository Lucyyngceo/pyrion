---
id: term-margin-point
title: "Margin point"
keywords: margin point, margin, more severe point, oxygen partial pressure, matrix point
chapter: 11
order: 16
dataHelp: [gap-section-matrix]
sources: ["engine/src/experiments.ts"]
---

A proposed test point with a higher oxygen partial pressure than your target. This is PYRION's convention, not a prediction of more severe burning or a demonstrated safety margin.

## For engineers

`MatrixPoint.marginPoint` iff `o2 × pressure` exceeds the target's (`engine/src/experiments.ts`).
