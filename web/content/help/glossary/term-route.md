---
id: term-route
title: "Route"
chapter: 11
order: 25
dataHelp: [route-chip, route-sentence]
sources: ["engine/src/navigator.ts"]
---

The smallest change to your condition that would make a given investigation comparable: move a number, leave an axis open, or switch regime. Each route is checked by the engine before it is shown.

## For engineers

`Route` (`engine/src/navigator.ts`): `kind`, `changes[]`, `changeCount`, `distance`, `target`, `sentence`.
