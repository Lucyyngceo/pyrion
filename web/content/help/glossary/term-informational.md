---
id: term-informational
title: "Gravity level (informational)"
chapter: 11
order: 13
dataHelp: [ctl-gravity-level]
sources: ["engine/src/types.ts"]
---

The number of g you typed. It is **shown** and it selects the regime, but it is not compared with anything, because no PSI record states a gravity level.

## For engineers

`Target.informational.gravity_level` (`engine/src/types.ts`); a `continuous.gravity_level` in a target is moved there by `routesToEvidence`, `experimentsNeeded` and `threePartAnswer`.
