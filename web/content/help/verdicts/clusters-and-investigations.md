---
id: clusters-and-investigations
title: "Clusters and the verdict of an investigation"
chapter: 4
order: 8
dataHelp: [result-card, result-ref]
sources: ["engine/src/evidence.ts", "engine/src/verdict.ts"]
---

An investigation in PSI is often several experiments (tests). Different tests of the same investigation can have been run in different regimes (for example some in air and some in a helium mix). PYRION groups the tests of one investigation that share the same regime values into a **cluster** and judges each cluster on its own.

The verdict of the investigation is the **best** verdict among its clusters (Applicable beats Extrapolation, which beats Insufficient evidence, which beats Not comparable); ties are broken by the smaller distance. So an investigation is Applicable if at least one of its regime groups is.

This matters for honesty: a cluster that happens to be inside your condition cannot be hidden by another cluster that is not, and a cluster is never merged with a different regime just to make the ranges wider.

A test marked "*" in the records applies to all tests of that investigation unless a test has its own record for the same variable.

## For engineers

`buildCorpus` (`engine/src/evidence.ts:170`): records sorted by `compareRecords` (a total order); normalization scales per axis; per accession (numeric order): tests named by `test_id` (or one test `*` if none), with `*` records resolved per variable (a test's own records win, even if all of them are excluded); `regimeKey` groups tests with equal regime states; clusters sorted by key.

`TestEvidence` holds, per regime axis, a `RegimeState` (`known`, `missing`, `conflicting`) with its values; per continuous axis, the distinct numeric values (ranges `lo..hi` count as both ends); descriptors (fuel, material, geometry, flow configuration, platform).

Investigation verdict (`evaluate`, `engine/src/verdict.ts:523`): clusters sorted by `compareRanked`; the first is the `decidingCluster`. `counts` (`investigations`, `clusters`, `recordsUsed`, `recordsFlaggedInsufficient`, `recordsBelowMinimumStatus`) summarize.

Axis scale: `AxisScale.scale` = max - min of counted values over all PSI (`scaleRule: 'range'`); if max = min ≠ 0, |min| (`abs_value`); else 1 (`unit`).
