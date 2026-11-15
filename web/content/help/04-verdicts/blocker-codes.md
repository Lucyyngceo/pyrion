---
id: blocker-codes
title: Why an investigation is not comparable: the blocker codes
chapter: 4
order: 6
dataHelp: [result-blocker-action, result-reasons, no-route-item]
sources: ["engine/src/verdict.ts"]
---

For every investigation whose verdict is *Insufficient evidence* or *Not comparable*, the engine attaches one or more **blockers**. A blocker has a fixed code, a plain sentence and, sometimes, an action. The codes:

- **AXIS_NOT_RECORDED.** The investigation did not record something you set. Example: "PSI-9401 did not record fuel phase." Action offered only for fuel phase, diluent and flame type: "Leave fuel phase open." For pressure, oxygen or gravity there is no action: leaving them open would ignore your question.
- **NO_USABLE_VALUE.** Records exist but cannot be used as evidence. Example: "PSI-9403 has records for fuel phase, but none can be used as evidence (flagged as insufficient in the extraction)."
- **REGIME_NOT_TESTED.** The investigation was tested only in other regimes. Example: "PSI-9402 was tested only in gaseous fuel, not in solid fuel (fuel phase)." The action is a switch and says so: "Switch fuel phase to gaseous fuel: another regime, not a small step."
- **RECORDS_DISAGREE.** Records of the investigation disagree on a regime. Example: "The records of PSI-9404 disagree on fuel phase (liquid fuel / solid fuel)."
- **AXES_NOT_RECORDED_TOGETHER.** Example: "No single test of PSI-9406 records all the axes you set together."
- **VALUES_NOT_PAIRED.** Example: "PSI-xx lists several oxygen and pressure values without saying which go together."

(The investigation numbers in the examples are the synthetic ones used by the tests. The first three codes are the ones most often met.)

In the answer from TARS, blockers are grouped by code and axis with the number of investigations affected, always worded "in PSI".

## For engineers

`Blocker { code, axis, testedValues?, sentence, action? }` and `BlockerCode` in `engine/src/types.ts`; produced by `blockersOf` (`engine/src/verdict.ts:100`) from the non-informational reasons of the deciding cluster of the investigation; attached to `InvestigationVerdict.blockers` only when the investigation verdict is INSUFFICIENT_EVIDENCE or REGIME_BARRIER.

Mapping from reason code to blocker:

| Reason | Blocker |
|---|---|
| `regime_barrier` (axis) | `REGIME_NOT_TESTED`, `testedValues` = the values of that axis the investigation's clusters state; action `{ kind: 'switch_regime', axis, to: tested[0] }` |
| `regime_missing` or `axis_missing` with an axis, no excluded records | `AXIS_NOT_RECORDED` |
| same, with excluded records (reason citations non-empty) | `NO_USABLE_VALUE` |
| `regime_conflicting` | `RECORDS_DISAGREE`, `testedValues` = the recorded values |
| `axis_missing` without an axis | `AXES_NOT_RECORDED_TOGETHER` |
| `unpaired_values` (non-informational) | `VALUES_NOT_PAIRED` |

Actions: `leave_open` only if `axis` is a member of `REGIME_AXES` and not `gravity_regime`; none for continuous axes. Tests: `engine/test/blockers.test.ts`.

Summaries for TARS: `threePartAnswer` groups barrier blockers by axis (kind `regime`), insufficient blockers by `code|axis` (kind `insufficient`) with `count` and `accessions` (`engine/src/answer.ts`).
