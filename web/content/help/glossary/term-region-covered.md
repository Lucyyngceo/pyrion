---
id: term-region-covered
title: "Region covered by tests (hull)"
keywords: region covered, hull, convex hull, tested region, envelope, oxygen pressure region
chapter: 11
order: 24
dataHelp: [chart-hulls]
sources: ["engine/src/geometry.ts"]
---

On the oxygen-pressure chart, the smallest convex outline containing the measured points of one investigation in one regime. The engine checks this outline with its 0.5% tolerance, alongside the other axes you set. Being inside does not by itself establish applicability, and no flame outcome is calculated between measurements.

## For engineers

Convex hull (Andrew's monotone chain, `convexHull`, `engine/src/geometry.ts:25`) of the points normalized by the axis scales; `hullContains` (line 70, `EPS = 1e-9`), `hullNearBox` (line 88). One point and one segment are valid (degenerate) hulls.
