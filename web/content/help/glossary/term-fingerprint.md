---
id: term-fingerprint
title: "Fingerprint"
chapter: 11
order: 11
dataHelp: [tars-fingerprint]
sources: ["engine/src/sha256.ts"]
---

A 64-character code computed from the whole result. Same question, same data, same engine: same fingerprint. A different fingerprint means something changed.

## For engineers

`sha256Hex(canonicalJson(evaluation))` (`engine/src/answer.ts`, `engine/src/sha256.ts:34`).
