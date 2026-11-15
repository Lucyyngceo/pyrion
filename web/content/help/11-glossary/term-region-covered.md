---
id: term-region-covered
title: Region covered by tests (hull)
chapter: 11
order: 24
dataHelp: [chart-hulls]
sources: ["engine/src/geometry.ts"]
---

On the oxygen-pressure chart, the smallest convex shape that contains all the points an investigation's tests measured: the region its tests cover. Inside it (with the 0.5 % tolerance) your condition is Applicable; outside, Extrapolation.

## For engineers

Convex hull (Andrew's monotone chain, `convexHull`, `engine/src/geometry.ts:25`) of the points normalized by the axis scales; `hullContains` (line 70, `EPS = 1e-9`), `hullNearBox` (line 88). One point and one segment are valid (degenerate) hulls.
