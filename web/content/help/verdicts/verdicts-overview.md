---
id: verdicts-overview
title: "The four verdicts"
chapter: 4
order: 1
dataHelp: [verdict-headline, verdict-ring, verdict-panel]
sources: ["engine/src/verdict.ts", "engine/src/types.ts"]
---

Every investigation in PSI gets exactly one of four verdicts for your condition. They are decided by fixed rules; no language model takes part.

- **Applicable.** Your condition lies inside what the investigation tested, in every respect you stated. Its results are directly comparable.
- **Extrapolation.** Everything is comparable in kind (same regime), but your numbers fall outside the tested region. The verdict also says *how far outside* (see "Extrapolation and its four levels").
- **Insufficient evidence.** The investigation's records do not say enough to place your condition: something you asked about was not recorded, or cannot be used. This is not a "no"; it is "not enough is stated in the extracted records".
- **Not comparable (different regime).** You set a regime (gravity, fuel phase, diluent, flame type) that differs from the one the investigation was tested in. No distance is defined across a regime: it is a different situation, not a long distance.

When several verdicts exist inside one investigation (for different regimes it was tested in), the best one is the investigation's verdict. The order is Applicable, then Extrapolation, then Insufficient evidence, then Not comparable.

Two honest limits are built into the wording: PYRION says "in PSI" and never "no data exists", because it only knows the records it extracted from PSI; and none of the verdicts says a condition is safe or unsafe.

## For engineers

`type Verdict = 'APPLICABLE' | 'EXTRAPOLATION' | 'INSUFFICIENT_EVIDENCE' | 'REGIME_BARRIER'` (`engine/src/types.ts`). Order constant: `VERDICT_ORDER` (`engine/src/verdict.ts:42`). Display names: `VERDICT_LABELS` in `engine/src/labels.ts` (Applicable / Extrapolation / Insufficient evidence / Not comparable (different regime)).

Decision order inside `judgeCluster` (`verdict.ts:149`, "4. Verdict"):

1. a stated regime axis differs from the cluster's known value: `REGIME_BARRIER`;
2. else a stated regime axis is missing or conflicting, or a stated continuous axis has no usable value in any test, or no test is complete on all stated axes: `INSUFFICIENT_EVIDENCE`;
3. else any axis outside its range (beyond tolerance) or (O2, pressure) outside the hull: `EXTRAPOLATION`;
4. else, if there are no pairable (O2, pressure) points: `INSUFFICIENT_EVIDENCE`;
5. else `APPLICABLE`.

`distance` is defined only for APPLICABLE and EXTRAPOLATION (normalized Euclidean distance to the nearest measured point); for the other two it is `null`, never `Infinity` (`canonicalJson` refuses non-finite numbers, `engine/src/json.ts`). `compareRanked` (`verdict.ts:504`) sorts by verdict order, then distance, then accession, then cluster key.

Records with status `insufficient_evidence` never count as evidence; with the option `minimumStatus: 'verified'` only `verified` records count (`engine/src/evidence.ts`, `counts`).
