---
id: data-limits
title: What the data can and cannot tell you
chapter: 12
order: 4
dataHelp: [data-evidence-status, evidence-panel]
sources: ["data/manifest/investigations.csv", "engine/src/evidence.ts"]
---

Everything PYRION says rests on **condition records** extracted from PSI investigations: tables and documents, one value at a time, with the quote it came from. That has consequences, stated plainly:

- **Only PSI.** Experiments outside PSI do not exist for PYRION. A condition with no comparable investigation here may have been tested elsewhere; PYRION says "in PSI".
- **Only what was extracted.** If a table has a column PYRION has not extracted, or states a regime in a figure rather than in text, the investigation shows as "insufficient evidence" for that point. That is a limit of the extraction, not a finding about the experiment.
- **Unverified is not wrong, but it is not checked.** Records are extracted with their quotes and the numbers are located in the source by code; a record is "verified" only after a person has compared it with the source. Verification wording appears in a result only if you ask the engine to count only verified records.
- **Ranges and approximate values.** A range like 15 to 25 % counts as both ends; "about 21 %" is stored as 21. The engine does not know the uncertainty of a measurement unless the source states it.
- **Several regimes in one investigation** are judged cluster by cluster; an investigation can be Applicable in one regime and not comparable in another.
- **The numbers change as extraction advances.** More records can turn "insufficient evidence" into a verdict. Counts quoted in this encyclopedia are not fixed; what is fixed is the rules.

When the data cannot answer, the engine says exactly what is missing and what would help (routes, and "What would close this gap").

## For engineers

- Record validation (`parseConditionCsv`, `engine/src/records.ts`): required fields, allowed variables (regime axes, continuous axes, `fuel`, `material`, `geometry`, `flow_configuration`, `platform`, `outcome:*`), statuses `extracted | verified | insufficient_evidence`, ranges `lo..hi`, rejected rows reported with file and line (`ParseResult.rejected`).
- Counting: `counts(status, minimum)` in `engine/src/evidence.ts`: `insufficient_evidence` never counts; `minimumStatus: 'verified'` drops `extracted`. `Evaluation.counts` reports `recordsUsed`, `recordsFlaggedInsufficient`, `recordsBelowMinimumStatus`.
- Missing regimes: `RegimeState.state` `missing` (no usable record) or `conflicting` (several values); `regimeUntested` when the target regime is stated by no cluster (`engine/src/verdict.ts`).
- No uncertainty model: values are numbers, ranges are intervals; the only tolerance is the 0.5 % convention.
- The condition records are produced and audited outside the engine (extraction and validation; `validation/run_all.py` checks quotes, numbers and units of every record); the engine takes them as given.
