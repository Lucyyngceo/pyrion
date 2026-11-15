---
id: not-safety-advice
title: "PYRION is not a safety tool"
chapter: 12
order: 5
dataHelp: [bridge-limits, tars-honesty]
sources: ["engine/src/levels.ts", "engine/src/experiments.ts"]
---

Nothing PYRION says is a statement that a material, a cabin atmosphere or a design is safe, or unsafe.

- **Applicable** means your numbers fall within what a recorded investigation tested, in the same regime. It does not mean the same result would happen to your material or geometry.
- **Extrapolation** levels measure *distance from the tested data*, not how reliable or safe a condition is. NASA's own work notes that flames can change abruptly near limits, so even "just outside" is an extrapolation.
- **Material selection for spacecraft** is governed by NASA's standards and tests. PYRION quotes what the NASA standard NASA-STD-6001B measures (for example maximum oxygen concentration and burn length in Test 1), but it does not apply the standard and does not replace it.
- **"What would close this gap"** is a testable plan proposed by PYRION. It is not a NASA plan and has not been reviewed or approved by anyone at NASA.

No one at NASA has endorsed, validated or reviewed PYRION, and the phrase "validated by NASA" must never be applied to it. Independent checks mentioned in the project (cross-checks between separate reviewers) are internal and are not a NASA review.

## For engineers

Code-level guarantees:

- `EXTRAPOLATION_LEVEL_NOTE` (`engine/src/levels.ts:19`): "PYRION convention: these levels measure distance from the tested data, not how reliable or safe the condition is; combustion can change abruptly near limits (e.g. extinction), so even "just outside" is an extrapolation." Attached as `technicalNote` to every `extrapolation_level` reason.
- `EXPERIMENT_LABEL` (`engine/src/experiments.ts:13`) heads every proposal.
- NASA-STD-6001B appears only as a quoted list of what its Test 1 measures (`TESTING_MEASURES`, PDF pp. 28-30) with `doi: null`.
- Wording tests forbid unsupported claims in engine sentences (`engine/test/wording.test.ts`: no snake_case or verdict codes, "verified" only with the verified-only option).
