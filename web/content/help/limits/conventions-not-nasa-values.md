---
id: conventions-not-nasa-values
title: "The conventions PYRION chose (not NASA values)"
chapter: 12
order: 3
dataHelp: [result-technical]
sources: ["engine/src/types.ts", "engine/src/levels.ts", "engine/src/quantity.ts", "engine/src/experiments.ts"]
---

Some numbers in PYRION are not measurements and not NASA's: they are choices made so that the tool is usable. They are listed here, each with the reason, and each is shown as a convention wherever it changes a result.

- **0.5 % measurement tolerance.** So 101.3 kPa and 101.325 kPa are the same condition.
- **Below 0.01 g is microgravity.** NASA's chart shows 1e-4 g and 1e-2 g on one continuous axis, so this cut is a modelling choice.
- **0.9 to 1.1 g is normal gravity.** A band so that 0.998 g is not "partial".
- **Above 1.1 g: not covered.** No PSI regime exists there.
- **Extrapolation levels at 10 % and 30 %.** To make the word "extrapolation" informative; the axis floor is 5 % of the axis range.
- **Plausibility windows** for habitat questions: oxygen 5 to 60 %, pressure 20 to 120 kPa. They only trigger a warning.
- **Test matrix.** Oxygen steps of 4 and 8 points (the 4-point step follows FM2's own steps) and pressure steps of 15 %.
- **Order of priority** of the proposal: untested regime, then solids, then far outside, outside, just outside.

If you disagree with one of these, the constants are named in the code and the reasoning is in the matching topic; the engine would be re-run with another value, and the results would change accordingly. Nothing here is hidden.

## For engineers

| Convention | Constant | Location |
|---|---|---|
| tolerance | `MEASUREMENT_TOLERANCE_REL = 0.005` | `engine/src/types.ts:175` |
| microgravity cut | `MICROGRAVITY_BELOW_G = 0.01` | `engine/src/quantity.ts:385` |
| normal band | `NORMAL_GRAVITY_BAND = { lo: 0.9, hi: 1.1 }` | `engine/src/quantity.ts:392` |
| gravity bound | `BOUNDS.gravity_level = [0, 3]` | `engine/src/quantity.ts:125` |
| level thresholds | `EXTRAPOLATION_LEVELS = { just_outside: 0.1, outside: 0.3 }` | `engine/src/levels.ts:14` |
| axis floor | `EXTRAPOLATION_AXIS_FLOOR = 0.05` | `engine/src/levels.ts:17` |
| plausibility windows | `HABITAT_WINDOWS = { o2_mole_fraction: [0.05, 0.6], pressure: [20, 120] }` | `engine/src/quantity.ts:184` |
| matrix steps | `TEST_MATRIX_O2_OFFSETS_POINTS = [-8, -4, 0, 4, 8]`, `TEST_MATRIX_PRESSURE_FRACTIONS = [-0.15, 0, 0.15]` | `engine/src/experiments.ts:16-17` |

Each has a note constant (`MEASUREMENT_TOLERANCE_NOTE`, `MICROGRAVITY_CONVENTION_NOTE`, `NORMAL_GRAVITY_CONVENTION_NOTE`, `EXTRAPOLATION_LEVEL_NOTE`, `TEST_MATRIX_NOTE`) that begins "PYRION convention, not a NASA value" or says "PYRION design convention, not a NASA design", and the plausibility warnings say "PYRION plausibility window, not a NASA value". Tests check these strings (`engine/test/judge.test.ts`, `levels.test.ts`, `quantity.test.ts`, `experiments.test.ts`).
