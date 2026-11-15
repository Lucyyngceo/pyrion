---
id: term-test
title: "Test"
chapter: 11
order: 28
dataHelp: [result-card]
sources: ["engine/src/evidence.ts"]
---

One run of an experiment inside an investigation (one test_id). A test has its own measured values.

## For engineers

`TestEvidence` (`engine/src/evidence.ts`); `testPoints` returns its measured points on given axes, or `null` when pairing is unknown.
