---
id: term-unreachable
title: "Unreachable route"
chapter: 11
order: 30
dataHelp: [no-route-item]
sources: ["engine/src/navigator.ts"]
---

An investigation for which no honest route exists (for example it did not record the pressure you set). It is listed with its reason, never silently skipped.

## For engineers

`RouteSet.unreachable[{ accession, reason }]` (`engine/src/navigator.ts`).
