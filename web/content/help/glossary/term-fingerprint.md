---
id: term-fingerprint
title: "Fingerprint"
keywords: fingerprint, hash, sha-256, reproducible, checksum
chapter: 11
order: 11
dataHelp: [tars-fingerprint]
sources: ["engine/src/sha256.ts"]
---

A 64-character code computed from an engine evaluation. The same interpreted target, records, engine and options give the same fingerprint. A natural-language question alone does not identify all of those inputs.

## For engineers

`sha256Hex(canonicalJson(evaluation))` (`engine/src/answer.ts`, `engine/src/sha256.ts:34`).
