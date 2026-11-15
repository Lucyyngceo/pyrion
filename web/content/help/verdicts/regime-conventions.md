---
id: regime-conventions
title: "Gravity conventions: below 0.01 g, 0.9 to 1.1 g, and above"
keywords: microgravity, 0.01 g, normal gravity, 0.9 g, 1.1 g, partial gravity, lunar, moon base, mars, above 1 g, gravity cut, 1e-4 g
chapter: 4
order: 10
dataHelp: [ctl-gravity-level, ctl-regime-axis]
sources: ["engine/src/quantity.ts", "NTRS 20260001966 PDF p. 17", "NTRS 20010074003 PDF p. 2"]
---

A gravity regime is a name, but people type numbers ("0.165 g", "1e-4 g"). PYRION turns a level into a regime with three cuts. **All three cuts are PYRION conventions, not NASA values**, and the notes say so with every result.

- **Below 0.01 g: microgravity.** "0 g" and "1e-4 g" are microgravity. NASA's own flammability chart puts 1e-4 g and 1e-2 g on one continuous axis, so this cut is a modelling choice.
- **0.01 g up to 0.9 g: partial gravity.** The Moon (0.165 g in the FM2 plan; 0.16 g in a lunar-gravity presentation) and Mars (0.38 g, NASA's Mars fact sheet) are in this range.
- **0.9 g to 1.1 g: normal gravity.** A band, not the single value 1: 0.998 g and 1.003 g are both ground gravity.
- **Above 1.1 g: not covered by this dataset.** No regime exists there. Every investigation is then Insufficient evidence with the reason "above 1 g: not covered by this dataset". It is never treated as an open axis.

Anything below 0 g or above 3 g is rejected as a mistake.

The gravity *level* you type is only shown. The regime it selects is what is compared, because no condition record carries a gravity level. Naming a regime ("microgravity", "freefall", "Moon") sets the regime directly; "microgravity" asserts no level at all.

## For engineers

`engine/src/quantity.ts`: `MICROGRAVITY_BELOW_G = 0.01` (line 385), `NORMAL_GRAVITY_BAND = { lo: 0.9, hi: 1.1 }` (line 392), `regimeOfLevel` (line 399): `0 ≤ g < 0.01` microgravity; `0.01 ≤ g < 0.9` partial; `0.9 ≤ g ≤ 1.1` normal; otherwise no regime. Bounds `gravity_level: [0.0, 3.0]` (`BOUNDS`, line 125). Notes: `MICROGRAVITY_CONVENTION_NOTE`, `NORMAL_GRAVITY_CONVENTION_NOTE`, `ABOVE_NORMAL_GRAVITY_MESSAGE` (line 396).

A numeric level goes to `Target.informational.gravity_level` (never to `continuous`); `informational.gravity_not_covered` is set above 1.1 g and makes `judgeCluster` return `regime_missing` ("Gravity regime: above 1 g: not covered by this dataset...") for every cluster. The name "microgravity" (and its aliases: freefall, free fall, weightless, in orbit, ISS, zero-g, microgravedad, caída libre, ...) sets the regime and no level (`targetFromQuantities`).

Named gravities (`GRAVITY_TARGETS`, `engine/src/transfer.ts:61`): Moon 0.165 g (NTRS 20260001966, PDF p. 13, slide 12, "Lunar-g = 0.165 gE"; 0.16 g from NTRS 20210020446 p. 3), Mars 0.38 g (NASA GSFC NSSDC Mars Fact Sheet, "Surface gravity (mean) (m/s2) 3.73 9.82 0.380"; NTRS 20010074003 PDF p. 2 lists 0.38 g only as one of the partial-gravity levels used in combustion studies), Earth 1 g.

Source of the cut context: NTRS 20260001966, PDF p. 17 (slide 16).
