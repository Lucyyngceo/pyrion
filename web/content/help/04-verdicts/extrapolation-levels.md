---
id: extrapolation-levels
title: Extrapolation and its four levels
chapter: 4
order: 4
dataHelp: [verdict-ring, chart-map-legend]
sources: ["engine/src/levels.ts", "NTRS 20260001966 PDF p. 17"]
---

The word "extrapolation" alone would say little, because at some oxygen and pressure almost every condition is an extrapolation for *some* investigation. So the verdict carries one of four levels:

- **Inside each tested range, but this combination was not tested.** Every number is within the range tested, but the pairing (oxygen, pressure) was never tested. Shown with a hatch on the map.
- **Just outside the tested data.** The worst axis is beyond the tested range by up to 10 % of the nearest tested value.
- **Outside the tested data.** Up to 30 %.
- **Far outside the tested data.** More than 30 %.

Example with an investigation tested only at exactly 1 atm (101.325 kPa): 101.3 kPa is Applicable (inside the tolerance); 110 kPa is 8.6 % beyond, so *just outside*; 125 kPa is 23 %, so *outside*; 140 kPa is 38 %, so *far outside*.

The note shown with every level is part of the meaning: **"PYRION convention: these levels measure distance from the tested data, not how reliable or safe the condition is; combustion can change abruptly near limits (e.g. extinction), so even "just outside" is an extrapolation."**

The 10 % and 30 % cuts are conventions chosen by PYRION. They are not NASA values. Their purpose is to make the word informative, not to define a safety margin.

## For engineers

Constants (`engine/src/levels.ts`):

- `EXTRAPOLATION_LEVELS = { just_outside: 0.1, outside: 0.3 }` (line 14);
- `EXTRAPOLATION_AXIS_FLOOR = 0.05` (line 17);
- `EXTRAPOLATION_LEVEL_ORDER = ['combination', 'just_outside', 'outside', 'far_outside']`;
- `EXTRAPOLATION_LEVEL_NOTE` (line 19), the note quoted above.

Rule: for each continuous axis outside its range (beyond the 0.5 % tolerance), `relativeGap = gap / max(|nearest tested value|, 0.05 × axisScale)` (`relativeGap`, line 32), where `nearest tested value` is the range bound that was crossed and `axisScale` is `AxisScale.scale` of the corpus normalization. The worst axis decides (`levelFromRelativeGaps`, line 37): `≤ 0.1` just_outside, `≤ 0.3` outside, otherwise far_outside. No axis outside (so the cause is the hull): `combination`. The floor keeps the quotient finite when the nearest tested value is 0 or tiny.

Sentences: `levelSentence` in `engine/src/labels.ts` ("Inside each tested range, but this combination was not tested", "Just outside the tested data", "Outside the tested data", "Far outside the tested data"). The reason `extrapolation_level` is informational; its `technicalNote` names the worst axis and the percentage to one decimal and carries the convention note.

The map: `EvidenceCell.extrapolationLevel` is the closest level among the cell's extrapolating investigations (`engine/src/navigator.ts`, `evidenceMap`), equal to `evaluate()` cell by cell (tested on 200+ random cells).

Source cited for the microgravity cut that the levels sit next to: NTRS 20260001966, PDF p. 17 (slide 16), flammability chart with 1e-4 g and 1e-2 g on one continuous axis.
