---
id: margin-points
title: "Margin points"
keywords: margin points, margin, more oxygen, oxygen partial pressure, safety margin, severe points, psia, what is a margin point
chapter: 5
order: 3
dataHelp: [gap-section-matrix]
sources: ["engine/src/experiments.ts", "NTRS 20260001966 PDF p. 5"]
---

A margin point is a proposed test point with a higher oxygen partial pressure than your target. This is PYRION's naming convention. It does not establish a more severe fire condition, predict whether a material burns, or measure a safety margin. Oxygen fraction, total pressure, material, flow and gravity can affect flame behaviour separately.

FM2 does the same kind of thing: one of its four planned tests (25 % oxygen) "is not expected to ignite" and is there to provide a margin of safety if the limit is lower than expected.

The measure used is the **oxygen partial pressure**: oxygen fraction times total pressure. A point is a margin point when its oxygen partial pressure is higher than your target's. A point with more oxygen but much less pressure may not be a margin point, and the other way round.

## For engineers

`marginPoint: true` on a `MatrixPoint` iff `o2 × pressure > targetPp × (1 + 1e-9)` where `targetPp = target.o2 × target.pressure` (`matrixPoints`, `engine/src/experiments.ts`). The target point itself is never a margin point; points lacking oxygen or pressure never are. The matrix note says "Points whose oxygen partial pressure exceeds the target's are margin points."

Source for the FM2 margin remark: NTRS 20260001966, PDF p. 5 (slide 4): "4. Start at 25% not expected to ignite but would provide a margin of safety if the limit was lower than expected."

Test: `engine/test/experiments.test.ts` ("margin points are exactly those whose oxygen partial pressure exceeds the target's").
