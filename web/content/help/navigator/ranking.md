---
id: ranking
title: "How routes are ranked"
keywords: route order, ranking, which route first, fewest changes, distance, why this order, sorted routes, closest route
chapter: 3
order: 4
dataHelp: [route-group-heading, route-more]
sources: ["engine/src/navigator.ts"]
---

Routes are shown in an order that never rewards a regime switch:

1. First come the routes that need **no regime switch** (move, leave open, or both). Among them, the route with the **fewest changes** comes first.
2. If two routes have the same number of changes, the one that moves your condition **least** comes first. "Least" is measured on a scale that makes oxygen and pressure comparable: each axis is divided by the range of that axis across all of PSI.
3. If they are still tied, the investigation with the smaller PSI number comes first (so the order never depends on how the records happen to be stored).
4. Only after all of those come the **different-regime** routes, sorted by the same three rules. A different-regime route with zero distance still comes after a no-switch route that moves a long way, because a regime change is not a distance: it is a different situation.

Each investigation gets at most one route (its best). When an investigation has several clusters (several regime combinations), the best cluster's route is the one shown.

## For engineers

`compareRoutes` (`engine/src/navigator.ts:313`): tier (`different_regime` = 1, otherwise 0), then `changeCount`, then `distance`, then `compareAccession` (numeric order of the PSI number), then `clusterKey` (string order). One route per investigation: the cluster routes of an investigation are sorted with the same comparator and the first is kept; `testedRegimes` (all regime combinations the investigation was tested in) is attached to a different-regime route.

`distance` is the square root of the sum over moved axes of ((to - from) / scale)^2, with `scale` the `AxisScale.scale` of the corpus normalization (`engine/src/evidence.ts`, `buildCorpus`): the global range of counted values, or the absolute value when the range is 0, or 1.

`threePartAnswer` (`engine/src/answer.ts:87`) shows at most the first 3 routes.

Invariant (`navigator.test.ts`, `checkInvariant`): all different-regime routes come after all others; among routes of the same tier, order is by `changeCount` then `distance`.
