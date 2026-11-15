---
id: evaluation-pipeline
title: The evaluation, step by step
chapter: 10
order: 1
dataHelp: [verdict-panel, result-reasons, method-verdicts]
sources: ["engine/src/verdict.ts", "engine/src/evidence.ts", "engine/src/records.ts"]
---

This is what the engine does every time you change a condition, in order. Nothing else happens; there is no hidden step.

1. **Read the evidence.** The condition records come from PSI tables and documents, one record per measured value with the quote and the place it came from. Records flagged "insufficient evidence" by the extraction are never counted. (How records are extracted and checked is a separate process, described in the extraction chapters.)
2. **Read your condition.** Gravity, fuel phase, diluent and flame type (regimes), and numbers such as oxygen and pressure. A gravity level is turned into a regime and only shown.
3. **Group the tests.** The tests of each investigation that share the same regime values form a cluster.
4. **Check the regimes.** A regime you set that differs from the cluster's gives "Not comparable". One that is missing or contradictory gives "Insufficient evidence".
5. **Check each number.** Is your value inside the range the cluster's tests covered (with a 0.5 % tolerance)?
6. **Check oxygen and pressure together.** Is the pair inside the region those tests cover (their convex hull, with the same tolerance)?
7. **Decide.** Applicable if all is inside; Extrapolation if something is outside, with its level; Insufficient evidence if the records do not allow the check.
8. **Pick the best cluster** for each investigation, attach the reasons and, when not comparable, the blockers.
9. **Count and summarize**, and flag when no investigation was tested in your gravity regime.

Every sentence the engine writes comes from a fixed template, filled with numbers rounded for reading. The full-precision numbers stay in the structured result.

## For engineers

`evaluate(records, target, options)` (`engine/src/verdict.ts:523`):

1. `validateTarget(target)`; options `minimumStatus: 'extracted' | 'verified'` (default `'extracted'`). Records come from `parseConditionCsv` (`engine/src/records.ts`): fields `accession, test_id, variable, value, unit, value_original, unit_original, method, source_file, source_location, quote, status, note`; variables are the regime axes, the continuous axes, `fuel`, `material`, `geometry`, `flow_configuration`, `platform` and `outcome:*`; status `extracted | verified | insufficient_evidence`; values `lo..hi` are intervals.
2. `canonicalTarget`.
3. `buildCorpus` (`engine/src/evidence.ts:170`): normalization (`AxisScale`), tests, clusters.
4. `judgeCluster` (`verdict.ts:149`) per cluster: regime axes; continuous axes (`complete` tests = tests with values on every stated axis; `axisChecks`); plane check; verdict; distance; level; reasons (each `Reason { code, informational, axis, message, technicalNote?, citations }`).
5. Investigation verdict: clusters sorted by `compareRanked`; first is the deciding cluster; `blockers` when INSUFFICIENT_EVIDENCE or REGIME_BARRIER; `extrapolationLevel` when EXTRAPOLATION.
6. `Evaluation { engine, target, openRegimeAxes, regimeUntested?, options, normalization, counts, investigations, ranked, unranked }`; `ranked` = APPLICABLE then EXTRAPOLATION clusters, `unranked` = INSUFFICIENT_EVIDENCE then REGIME_BARRIER clusters.

Engine version `0.2.0` (`engine/src/types.ts:301`). Tests: `engine/test/verdict.test.ts`, `inputs.test.ts`, `judge.test.ts`.
