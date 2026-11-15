---
id: three-part-answer
title: The three-part answer: what is known, unknown, and next
chapter: 10
order: 5
dataHelp: [tars-bubble, tars-steps, tars-fingerprint, tars-related]
sources: ["engine/src/answer.ts"]
---

TARS answers in three parts, built from the engine's results:

1. **What PSI supports.** The investigations that are Applicable for your condition, each with its receipts (the records behind the statement, with DOI). If there are none, the answer says so: "Nothing in PSI applies directly to this condition."
2. **Where the evidence ends, and why.** Whether PSI has any test in your gravity regime; which investigations are just outside, outside or far outside the tested data; and which are not comparable for which reason, grouped with counts.
3. **What to do next.** At most three of the nearest routes (regime switches labelled), and the "What would close this gap" proposal.

A **fingerprint** and the list of **steps** (which engine tools actually ran) close the answer, so it can be re-checked.

The same facts come out in the easy and the advanced wording. Easy is shorter, uses no numbers beyond oxygen %, pressure and gravity, and avoids acronyms; advanced adds numbers with units, levels and counts. Take away the words and the two answers are identical.

## For engineers

`threePartAnswer(records, target, { catalog?, mode: 'easy' | 'advanced', minimumStatus? })` (`engine/src/answer.ts:87`) returns `{ mode, engine, target, known[], unknown[], next[], fingerprint, steps[] }`.

- `known[]`: `{ sentence, citations: [{ accession, acronym?, doi?, recordIds[] }] }`; `recordIds` are `accession|test|variable|source file|location` from the inside-range and inside-hull reasons of the deciding cluster.
- `unknown[]`: kinds `regime` (`regimeUntested` first, then barrier blockers by axis), `outside` (one item per extrapolation level, `EXTRAPOLATION_LEVEL_ORDER`), `insufficient` (blockers by `code|axis`), each with `count` and `accessions`.
- `next[]`: up to 3 routes (`routesToEvidence`), then `{ kind: 'proposal', action: { label: EXPERIMENT_LABEL, gapKind, pointCount, firstPriority? } }`.
- `steps`: `evaluate`, then `routesToEvidence` and `experimentsNeeded` only when some investigation is not APPLICABLE.
- `fingerprint`: `sha256Hex(canonicalJson(evaluation))`.

Easy-mode rules (tested, `engine/test/answer.test.ts`): digits only for oxygen %, pressure (kPa/psia) and gravity; no acronym except "NASA"; counts as words ("one", "two", "three", "several"). Facts identical across modes: removing every `sentence` field makes the two answers deep-equal.
