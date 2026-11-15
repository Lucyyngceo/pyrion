---
id: close-the-gap-overview
title: What would close this gap: what it is and what it is not
chapter: 5
order: 1
dataHelp: [gap-dialog, gap-label, gap-close]
sources: ["engine/src/experiments.ts"]
---

Sometimes PSI simply has nothing comparable to your condition. "What would close this gap" turns that gap into a plan someone could test: which conditions to run, in what configuration, measuring what, and what NASA's own planned experiments are stated to cover.

Its title carries a label that must never be dropped: **"What would close this gap — PYRION proposal (a testable plan, not a NASA plan)"**. Everything in it is PYRION's proposal. The parts that come from NASA documents (for example FM2's planned atmospheres) are quoted word for word, with the document and page, so you can tell them apart from what PYRION proposes.

The plan has these parts, each explained in its own topic: the gap itself, a test matrix around your condition, additional axes to be chosen by the experimenter, the configuration of the nearest comparable investigations, what such tests measure, what NASA's planned experiments are stated to cover, the part left uncovered, and the order of priority.

It is not a prediction of what you would find, not a design approved by anyone, and not a substitute for NASA's test standards.

## For engineers

`experimentsNeeded(records, target, { catalog?, minimumStatus? })` (`engine/src/experiments.ts:328`; alias `whatWouldCloseThisGap`). Pure: it reads no files; the investigation catalog (acronym, title, DOI) is passed in (`parseInvestigationCatalog` on `data/manifest/investigations.csv`). Label constant: `EXPERIMENT_LABEL` (`experiments.ts:13`).

The target is normalized like everywhere in the engine: `continuous.gravity_level` becomes `informational.gravity_level`.

Gap kinds (`ExperimentsNeeded.gap`):

- `regime_untested` (from `evaluation.regimeUntested`): "No PSI test was run in partial gravity; the investigations state only microgravity and normal gravity.";
- `outside_tested_data`: no investigation is APPLICABLE and some extrapolate: the closest level sentence;
- `insufficient`: no investigation is APPLICABLE and none extrapolates: the first blockers' sentences;
- `covered`: some investigation is APPLICABLE ("At least one investigation is comparable at this condition for solid fuel." or "... but not for solid fuel.").

`phaseCoverage` evaluates the target with `fuel_phase` set to solid, liquid and gas in turn; `best` is `APPLICABLE`, `EXTRAPOLATION` or `NONE` (no comparable investigation), and `zeroCoveragePhases` lists the `NONE` phases.
