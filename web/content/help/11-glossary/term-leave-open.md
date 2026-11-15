---
id: term-leave-open
title: Leave open
chapter: 11
order: 15
dataHelp: [route-sentence, result-blocker-action]
sources: ["engine/src/navigator.ts"]
---

Not stating an axis, so it is not compared. Allowed as a route step only for fuel phase, diluent and flame type, when an investigation did not record them. Never for gravity, oxygen, pressure or any other number you set.

## For engineers

`RouteChange.kind === 'leave_open'`; enforced in `planCluster` (`engine/src/navigator.ts:120`) and `blockersOf` (`engine/src/verdict.ts:100`).
