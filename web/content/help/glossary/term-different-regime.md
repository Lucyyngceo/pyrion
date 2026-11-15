---
id: term-different-regime
title: "Different regime (route)"
chapter: 11
order: 7
dataHelp: [route-group-heading, route-sentence]
sources: ["engine/src/navigator.ts"]
---

A route that needs a change of regime, for example from partial gravity to microgravity. It is always ranked after every route that does not need one, and always labelled "another regime, not a small step".

## For engineers

`Route.kind === 'different_regime'` iff any change has `kind: 'switch_regime'` (`engine/src/navigator.ts`); `compareRoutes` gives it tier 1.
