---
id: determinism-and-fingerprint
title: Determinism and the SHA-256 fingerprint
chapter: 4
order: 11
dataHelp: [tars-fingerprint, result-receipt]
sources: ["engine/src/json.ts", "engine/src/sha256.ts", "engine/src/answer.ts"]
---

The engine has no randomness, no clock, no network and no language model inside. Given the same records and the same condition, it produces exactly the same result, byte for byte, on any machine. Records are put in a fixed order before anything is computed, so the order of the files does not matter.

That makes a result **checkable**. TARS shows a *fingerprint*: a 64-character code computed from the whole evaluation (every verdict, every reason, every number). If someone re-runs the same question on the same data and gets a different fingerprint, something changed: the data, the condition or the engine. If the fingerprint matches, the result is identical.

A fingerprint does not say the result is right; it says the result is reproducible. The correctness of a verdict rests on the rules in this encyclopedia and on the records and their sources.

Swapping the language model that writes the explanation does not change the verdict or the fingerprint, because the model never decides.

## For engineers

`canonicalJson` (`engine/src/json.ts:4`): keys sorted, two-space indent, trailing newline, `undefined` dropped, non-finite numbers rejected with a `TypeError` (undefined distances are `null` by contract).

`sha256Hex(text)` (`engine/src/sha256.ts:34`): pure TypeScript SHA-256 of the UTF-8 text, no dependencies and no platform API; tested against standard vectors and Node's `crypto` (`engine/test/answer.test.ts`).

`threePartAnswer` (`engine/src/answer.ts:87`): `fingerprint = sha256Hex(canonicalJson(evaluate(records, target, options)))`, where `target` is normalized (`continuous.gravity_level` moved to `informational`). The fingerprint is identical in easy and advanced mode and independent of record order (tested).

Ordering that makes this true: `compareRecords` (total order over record fields), `compareAccession` (numeric), `compareNatural` (test ids: "T2" before "T10", locale-free), sorted keys in output, deterministic tie-breaks in `compareRanked`, `compareRoutes`. Tests use fixed-seed linear-congruential generators, never `Math.random`.

Engine version in every evaluation: `ENGINE_VERSION = '0.2.0'` (`engine/src/types.ts:301`), part of the hashed output.
