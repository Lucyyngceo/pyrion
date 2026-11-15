---
id: extrapolation
title: "Extrapolation"
chapter: 4
order: 3
dataHelp: [verdict-headline, result-reasons]
sources: ["engine/src/verdict.ts", "engine/src/levels.ts"]
---

*Extrapolation* means the investigation was tested in your regime, but at least one number you set is outside the tested range, or your oxygen and pressure together are outside the tested region.

It is the engine's way of saying "close in kind, not in measurement". It never says "this will behave like that experiment". Combustion can change abruptly near limits (extinction is the classic example), so even a condition just outside the tested data is an extrapolation and must be treated as one.

An Extrapolation verdict always comes with a **level** that says how far outside you are, and with the receipt: which axis is outside, by how much, and which records define the nearest bound.

The distance shown to specialists is the straight-line distance, after scaling each axis by its range across PSI, to the nearest measured point. For people it is replaced by the level.

## For engineers

Condition: `outside || outsideHull` in `judgeCluster` after the regime checks, where `outside` is any axis with status `below` or `above` (beyond tolerance) and `outsideHull` is `hasPoints && !(hullContains || hullNearBox)`.

Reasons produced: `outside_range` (`"Oxygen: your 45 % is above the tested 17 % to 30 % (15 points higher)."`, with `technicalNote` carrying the fraction of the axis scale), `outside_hull` (`"Oxygen and pressure together are outside the region covered by N tested conditions."`, `technicalNote` with the normalized distance), `extrapolation_level` (informational) and `nearest_point` (informational, nearest measured point and its test).

Numbers in sentences: oxygen as % with at most one decimal (`percentText`), pressure in kPa with psia at 3 significant figures, other axes 3 significant figures (`humanValue`, `humanGap`, `engine/src/labels.ts`).

The investigation-level level is the lowest among the investigation's EXTRAPOLATION clusters (`bestLevel`, `engine/src/levels.ts`), only when the investigation's best verdict is EXTRAPOLATION.
