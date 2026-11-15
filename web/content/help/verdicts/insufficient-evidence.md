---
id: insufficient-evidence
title: "Insufficient evidence"
keywords: insufficient evidence, not enough evidence, why grey, not recorded, no usable value, unknown, flagged, cannot place my condition, undefined
chapter: 4
order: 5
dataHelp: [verdict-headline, result-blocker-action]
sources: ["engine/src/verdict.ts"]
---

*Insufficient evidence* means that PSI's extracted records for this investigation do not say enough to place your condition. It is a legitimate result, not a failure, and never a hidden "no".

It happens when:

- an axis you set (a regime axis like fuel phase, or a number like pressure) was not recorded for the investigation;
- it was recorded but flagged in the extraction as insufficient (such values are never counted as evidence);
- the records disagree with each other on a regime;
- the investigation recorded your axes, but never together in one test, so no tested condition can be named;
- oxygen and pressure were listed as several values without saying which go together.

Each of these has a fixed code and a plain sentence (see "Why an investigation is not comparable: the blocker codes"). When a safe action exists (for example "leave fuel phase open"), it is offered; when it would mean ignoring something you asked about, it is not.

Insufficient evidence has no distance and is never ranked.

## For engineers

Triggers in `judgeCluster`: `regimeUnknown` (stated regime axis `missing` or `conflicting`, or the informational `gravity_not_covered`), `missingAxis` (a stated continuous axis has no usable value in any test), `complete.length === 0` (no test records all stated axes), or `hullUnknown` (no pairable points) without any axis outside.

`distance = null`, distance note `'not defined: insufficient evidence to place the target'` (the word "undefined" never appears in text shown to a reader; checked by `engine/test/wording.test.ts`).

Excluded records: status `insufficient_evidence` is never counted; the reason says "N records exist but are not counted (flagged as insufficient in the extraction)" (`excludedWhy`, `engine/src/labels.ts`; with `minimumStatus: 'verified'` the text also says "not verified").

When the target states a gravity regime that no investigation was tested in, `evaluation.regimeUntested = { axis: 'gravity_regime', value, testedValues }` (`regimeUntestedOf`, `engine/src/verdict.ts`) so the interface can say "No PSI test in this gravity regime".
