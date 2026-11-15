---
id: margin-points
title: Margin points
chapter: 5
order: 3
dataHelp: [gap-section-matrix]
sources: ["engine/src/experiments.ts", "NTRS 20260001966 PDF p. 5"]
---

Some points of the matrix are more severe than your target: they have **more oxygen pressing on the flame** than your target has. Those are *margin points*. If something burns at your target, it will probably burn at them; if it does not burn at your target, the margin points are where you would look for how much room there is.

FM2 does the same kind of thing: one of its four planned tests (25 % oxygen) "is not expected to ignite" and is there to provide a margin of safety if the limit is lower than expected.

The measure used is the **oxygen partial pressure**: oxygen fraction times total pressure. A point is a margin point when its oxygen partial pressure is higher than your target's. A point with more oxygen but much less pressure may not be a margin point, and the other way round.

## For engineers

`marginPoint: true` on a `MatrixPoint` iff `o2 × pressure > targetPp × (1 + 1e-9)` where `targetPp = target.o2 × target.pressure` (`matrixPoints`, `engine/src/experiments.ts`). The target point itself is never a margin point; points lacking oxygen or pressure never are. The matrix note says "Points whose oxygen partial pressure exceeds the target's are margin points."

Source for the FM2 margin remark: NTRS 20260001966, PDF p. 5 (slide 4): "4. Start at 25% not expected to ignite but would provide a margin of safety if the limit was lower than expected."

Test: `engine/test/experiments.test.ts` ("margin points are exactly those whose oxygen partial pressure exceeds the target's").
