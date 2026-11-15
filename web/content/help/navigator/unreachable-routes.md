---
id: unreachable-routes
title: "Routes that cannot be built, and why"
chapter: 3
order: 5
dataHelp: [no-route-item]
sources: ["engine/src/navigator.ts"]
---

Some investigations get no route. They are listed, each with a plain sentence, so a missing route is never a mystery. The reasons are:

- **No gravity regime stated.** "The extracted records do not state its gravity regime, so it cannot be compared on gravity." (Or, if records disagree: "...disagree on its gravity regime ...".)
- **Gravity above what PSI covers.** If you set more than 1.1 g, no investigation covers it. A route can switch the regime for investigations that state one; for an investigation that does not state its gravity regime the sentence is: "PSI-xx does not record the gravity regime, and the gravity you gave is above everything this dataset covers."
- **An axis you set was not recorded.** "PSI-22 did not record pressure, so it cannot be compared at your pressure."
- **Axes recorded, but never together.** "No single test of PSI-xx records oxygen and pressure together, so it cannot be compared at the values you set."
- **Values listed without pairing.** "PSI-68 lists several oxygen and pressure values without saying which go together, so no tested point can be named."
- **No change of the offered kinds works.** "PSI-xx: no change of the kinds this tool offers makes it comparable (the engine's answer is: ...)." This is a safety net; the tests do not reach it.
- **Nothing to change.** "no change of the kinds this tool offers is needed or possible."

In the app, these appear under the routes, with the action button missing where the sentence says the investigation cannot be compared.

## For engineers

Every string is produced in `planCluster` (`engine/src/navigator.ts:120`) as `ClusterPlan.why`; `routesToEvidence` stores the first available `why` of the investigation's clusters in `RouteSet.unreachable[{accession, reason}]` (sorted by `compareAccession`).

| Code path | Reason |
|---|---|
| `gravity_regime` state `missing` | `the extracted records do not state its gravity regime, so it cannot be compared on gravity` |
| `gravity_regime` state `conflicting` | `the extracted records disagree on its gravity regime (...), so it cannot be compared on gravity` |
| `informational.gravity_not_covered` and cluster gravity not `known` | `${acc} does not record the gravity regime, and the gravity you gave is above everything this dataset covers.` |
| stated axis with no recorded value in any test | `${acc} did not record ${axis}, so it cannot be compared at your ${axis}.` |
| no test complete for all stated axes | `No single test of ${acc} records ${axes} together, so it cannot be compared at the values you set.` |
| O2 and pressure both stated, no pairable point (`testPoints` returns `null` for every test) | `${acc} lists several oxygen and pressure values without saying which go together, so no tested point can be named.` |
| verification `judgeCluster` is not APPLICABLE | `${acc}: no change of the kinds this tool offers makes it comparable (the engine's answer is: <verdict label>).` |
| `changes.length === 0` | `${acc}: no change of the kinds this tool offers is needed or possible.` |

`testPoints` (`engine/src/evidence.ts:270`) returns the measured points of a test on the given axes; it returns `null` when two or more of the axes have more than one value, because which value goes with which is then unknown.
