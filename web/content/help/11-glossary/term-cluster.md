---
id: term-cluster
title: Cluster
chapter: 11
order: 3
dataHelp: [result-card]
sources: ["engine/src/evidence.ts"]
---

The tests of one investigation that were run in the same regime. An investigation with tests in air and tests in a helium mix has two clusters; each gets its own verdict and the best one becomes the investigation's verdict.

## For engineers

`Cluster { accession, key, regime, tests }`, key from `regimeKey` over `REGIME_AXES` (`engine/src/evidence.ts`). One verdict per cluster (`judgeCluster`).
