---
id: navigator-overview
title: "NAVIGATOR: where is the evidence?"
chapter: 3
order: 1
dataHelp: [route-group-heading, no-route-item]
sources: ["engine/src/navigator.ts"]
---

When you set a condition and PYRION says "not comparable" or "insufficient evidence", that is only half an answer. NAVIGATOR gives the other half: **what is the smallest change to your condition that would make a given investigation in PSI comparable?**

For every investigation that is not yet *Applicable*, NAVIGATOR looks for one route. A route says things like "move oxygen from 30 % to 22.7 %, the nearest condition tested in PSI-26" or "switch the gravity regime to microgravity: PSI-20 was tested only in microgravity. This is another regime, not a small step." Each route also carries the exact condition you would end up with, so the app can take you there and re-run the verdict.

Three things NAVIGATOR never does:

- It never changes a verdict to make a route look better. The route only says what to change; the verdict is still given by the engine, afterwards, on the changed condition. Every route is checked this way before it is shown.
- It never presents a change of regime (for example from partial gravity to microgravity) as a small step. A different regime is a different situation.
- It never ignores something you asked about. Gravity, oxygen and pressure that you set are never "left open" to reach an investigation (see "Why gravity, oxygen and pressure are never left open").

Investigations for which no honest route exists are listed with the reason in plain words (see "Routes that cannot be built").

## For engineers

Entry point: `routesToEvidence(records, target, options)` (`engine/src/navigator.ts:323`). Result: `RouteSet { engine, target, routes[], unreachable[], notes[] }`.

Algorithm:

1. Validate the target, build the corpus (`buildCorpus`, `engine/src/evidence.ts:170`) and judge every cluster with `judgeCluster` (`engine/src/verdict.ts:149`).
2. Skip every investigation that has at least one APPLICABLE cluster.
3. For each remaining investigation, plan one route per cluster with `planCluster` (`navigator.ts:120`), keep the best one by `compareRoutes` (`navigator.ts:313`), or an `unreachable` entry if no cluster yields a route.
4. **Verification:** the planned target is run through `judgeCluster` again; only an APPLICABLE result is accepted (`navigator.ts`, "verify with the engine's own judgement").

A `continuous.gravity_level` in the target is moved to `informational.gravity_level` before anything else, and a note says so, because no condition record carries a gravity level (it can neither be moved nor left open). The target passed in is never modified.

Invariant tested in `engine/test/navigator.test.ts`: for every preset, for the presets with the gravity regime switched, and for 50 seeded random targets, on the synthetic fixtures, on inline synthetic records and on the real records, **every** route's target gives APPLICABLE for its investigation under `evaluate()`, every non-APPLICABLE investigation has a route or an `unreachable` entry, and nothing else has a route.
