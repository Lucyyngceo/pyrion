---
id: never-left-open
title: "Why gravity, oxygen and pressure are never left open"
keywords: leave open, gravity open, never left open, why not leave pressure open, ignore gravity, ignore oxygen, cheating, honest route, stated axis
chapter: 3
order: 3
dataHelp: [route-sentence, no-route-item]
sources: ["engine/src/navigator.ts", "engine/test/navigator.test.ts"]
---

It would be easy to produce more routes by quietly dropping parts of your question: "leave gravity open and this investigation is comparable". PYRION does not do that, on purpose.

**Gravity.** If an investigation's records do not state its gravity regime, PYRION cannot compare it with your gravity. Leaving your gravity "open" would mean comparing a lunar cabin with an experiment whose gravity nobody stated, and calling the result applicable. That would treat "unknown" as if it were "the same". So such an investigation is listed as unreachable, with the reason: "the extracted records do not state its gravity regime, so it cannot be compared on gravity." Whether the records of an investigation do state its gravity is a question for the extraction of the data, not something NAVIGATOR may fill in.

**Oxygen, pressure and any other number you set.** These are the heart of your question. If an investigation did not record pressure, it cannot be compared at your pressure, and NAVIGATOR says exactly that: "PSI-22 did not record pressure, so it cannot be compared at your pressure." It does not offer "leave pressure open" as a way to make it comparable. The same holds when oxygen and pressure were recorded, but never together in one test.

**What may be left open.** Only the regime axes that are about *what* is burning and in *what* gas: fuel phase, diluent and flame type. If you did not state them, they are not compared at all; if you did and the investigation did not record them, NAVIGATOR may suggest leaving them open, in words.

The rule is about honesty, not convenience: a route is a promise that the change makes the comparison fair.

## For engineers

Where it is enforced (`engine/src/navigator.ts`, `planCluster`):

- `gravity_regime` with cluster state `missing`: `route: null`, `why: 'the extracted records do not state its gravity regime, so it cannot be compared on gravity'`; with state `conflicting`: `'the extracted records disagree on its gravity regime (...), so it cannot be compared on gravity'`.
- A stated continuous axis that no test records: `why: '${acc} did not record ${axisLabel}, so it cannot be compared at your ${axisLabel}.'`
- Stated axes never recorded in one test: `why: 'No single test of ${acc} records ${labels} together, so it cannot be compared at the values you set.'`

The blockers of `evaluate()` follow the same rule: `AXIS_NOT_RECORDED` on a continuous axis, and any blocker on `gravity_regime`, carry no `action` (`engine/src/verdict.ts:100`, `blockersOf`); only fuel phase, diluent and flame type get "Leave ... open."

Invariants in `engine/test/navigator.test.ts` ("routes never drop an axis the target states" and the main invariant): no route has a `leave_open` change on `gravity_regime` or on a member of `CONTINUOUS_AXES`; every route target keeps every stated continuous axis (except `gravity_level`, which is informational); after a gravity switch to microgravity or normal gravity there is no `informational.gravity_level`.
