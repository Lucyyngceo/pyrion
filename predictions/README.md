# Pre-registered statements about FM2

**Sealed on November 14, 2026, during the NASA Space Apps Challenge.** On that date a web search found no flight confirmation and no published results for FM2 (Flammability of Materials on the Moon); the most recent public plan is Ferkul et al., LPSC 2026 (NTRS 20260001966), which targets late 2026.

This folder states, before any lunar result is public, what PYRION says and what it refuses to say. When FM2 reports, anyone can check this page against it.

## What FM2 plans to do (NASA's words)

From NTRS 20260001966 (`data/raw/nasa/ntrs-20260001966/`):

- p. 6: "Chamber volume 14.4 L"; "Four 20-cm tall fabric samples burned individually; atmosphere is refreshed between burns".
- p. 10: four tests at "8.2 psia (+/- 0.3 psi)" starting at 37 %, 33 %, 29 % and 25 % O2, balance nitrogen; fuel "Fabric sheets (Synergy Pro “Navy”)".
- p. 5: "Test a material with an expected Lunar LOC of 24-26% and an expected oxygen consumption of 0.08 mol fraction"; the 25 % test is "not expected to ignite".
- p. 14: "Expect oxygen concentration to decrease by up to 0.08 mol fraction in a test. This will enable “scanning” to the limit".

## Statement 1 — what PYRION refuses to say

**PYRION commits to no value for the lunar limiting oxygen of Synergy Pro fabric.** PSI holds no test of that material, at any gravity level. For that question PYRION's verdict is `INSUFFICIENT_EVIDENCE`, and a number from us would be invented. The 24–26 % above is NASA's expectation, recorded here as theirs.

## Statement 2 — the reading table (what the instrument will show under each hypothesis)

`fm2_reading_table.json`, built by `build_fm2.ts` from the engine's closed-chamber oxygen balance (`engine/src/fm2.ts`). It is a mass balance, not a flame model: ideal gas, fixed temperature (15 to 35 °C assumed; the plan does not state it), mole change from combustion products ignored.

For each hypothesised limit L from 20 % to 32 %, and each of the four planned starts, it gives: whether ignition is expected, the oxygen that can be consumed before the chamber reaches L, and the final oxygen (a) if fuel is not limiting and (b) if consumption stops at NASA's expected 0.08.

Read as a decision table:

| Tests that burn (37 / 33 / 29 / 25 % start) | Then the limit L is |
|---|---|
| all four | below 25 % |
| 37, 33, 29 | from 25 % up to, not including, 29 % |
| 37, 33 | from 29 % up to, not including, 33 % |
| 37 only | from 33 % up to, not including, 37 % |
| none | 37 % or above |

Within a row, the final oxygen of the lowest start that burns reads the limit directly, as long as the limit is within 0.08 of that start. For NASA's expected 24–26 %, that is the 29 % test (and the 33 % test for a limit of 25 % or more).

**What would prove this statement wrong:** an FM2 burn whose final oxygen and consumed oxygen cannot be reconciled with a closed 14.4 L chamber at 8.2 psia within the ±0.3 psi and temperature bands above. In that case the instrument model here is wrong, and this page will say so.

## Statement 3 — transfer hypotheses for materials PSI does hold

See `docs/TRANSFER.md` and the `/bridge` page. They concern PMMA rods, not the FM2 fabric, so FM2 as planned does not test them. They are listed here so that they are dated: any future partial-gravity test of PMMA rods can be compared with them. An addendum with the specific rod statements will be added and sealed separately when the rod limits are verified.

## How this is sealed

- `fm2_reading_table.json` is canonical JSON; its SHA-256 is in `SHA256SUMS`.
- The commit that adds this folder is stamped on GitHub's servers by the `provenance` workflow (time, commit, tree hash).
- `SHA256SUMS.ots`, when present, is an OpenTimestamps proof that anchors the hash list in the Bitcoin blockchain, verifiable without trusting GitHub or us.

Nothing in this folder is edited after sealing. Corrections are added as new dated files.
