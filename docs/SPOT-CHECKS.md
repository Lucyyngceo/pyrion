# Manual scientific spot checks

What was checked by hand, against which NASA file and page or table cell, what was found, and what remains unverified. This is a **sample**. It does not make the dataset human-verified: every record keeps its own `status`, and the records checked here were not changed to `verified`.

- Date: 15 November 2026. Reviewer: the laptop session (a separate process from the one that extracted the records). Not a review by NASA and not a validation by combustion experts.
- Repository state: branch `laptop/puntos-6-11` from `main` at `959473e`, 10,374 condition records (engine count, extracted or better).

## How the sample was chosen

1. **Influential envelope vertices.** The engine (`buildEnvelopes`, `minimumStatus: extracted`) gives 73 hull vertices across 8 investigations. A vertex moves the edge of an investigation's envelope, so it can change a verdict. For each regime layer, the minimum and maximum O₂ and the minimum and maximum pressure vertices were taken.
2. **Regime assignments** behind those layers (gravity regime, fuel phase, diluent).
3. **Campaign-wide (`*`) records**: of 172, the ones with an O₂ value or a regime that a layer depends on.

## Source files opened

Downloaded from PSI with the investigation's pre-signed link and compared with `data/manifest/checksums_*.csv` before use. **All 10 SHA-256 match.**

| File (under `data/raw/`) | Investigation (DOI) |
|---|---|
| `psi-data/PSI-69/Experimental table/PSI-69_Experimental table_FLEX.csv` | PSI-69 FLEX (10.60555/mbq8-0451) |
| `psi-data/PSI-39/Experimental table/PSI-39_Experimental table_CFI.csv` | PSI-39 CFI (10.60555/m6pj-a914) |
| `psi-data/PSI-159/Experimental table/PSI-159_Experimental table_CFI-G_Normal Flames.csv` | PSI-159 ACME CFI-G (10.60555/cyt1-kh64) |
| `psi-data/PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Normal Flame.csv` | PSI-10 ACME/Flame Design (10.60555/w4zy-bt45) |
| `psi-data/PSI-26/Science Documents/PSI-26_Science Documents_As Run_Test Matrix.xlsx` | PSI-26 BASS (10.60555/58h4-dy80) |
| `psi-data/PSI-20/Experimental table/PSI-20_Experimental table_ACME BRE.csv` | PSI-20 ACME BRE (10.60555/vb93-3y72) |
| `psi-data/PSI-20/Reports/PSI-20_Reports_Final_20220201.pdf` | PSI-20 ACME BRE (10.60555/vb93-3y72) |
| `psi-data/PSI-25/Experimental table/PSI-25_Experimental table_BASS-II.csv` | PSI-25 BASS-II (10.60555/4qc4-de67) |
| `psi-data/PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf` | PSI-25 BASS-II (10.60555/4qc4-de67) |
| `psi-data/PSI-22/Reports/PSI-22_Reports_E-FIELD Flames Final Report.pdf` | PSI-22 ACME E-FIELD Flames (10.60555/se5a-8c73) |

**Mechanical check of every record that cites these files.** 6,393 records were run through `validation/run_all.py` with the `trace` check, on a copy of `data/conditions/` that holds only those records. Result: 5,614 table cells and 253 quotes re-read from the files, **0 trace findings**. This shows that each value is written in its cell or quote. It does not show that the value means what the record says it means; the manual checks below cover that.

## Manual checks: vertices (cell or page read, header and unit judged)

| Investigation · test | Vertex (O₂, kPa) | Source location | What the source says | Interpretation check |
|---|---|---|---|---|
| PSI-69 · N06M101 | 0.12, 101.538 | FLEX.csv row 219 | `O initial ambient composition; mole fraction` = 0.12; `Ambient pressure; mmHg` = 761.6 | Ambient, initial: correct. 761.6 mmHg × 101.325/760 = 101.538 kPa ✓. N = 0.88, so the diluent is N₂ ✓ |
| PSI-69 · 220R001 | 0.34, 71.234 | row 37 | O 0.34; 534.3 mmHg | ✓ (534.3 mmHg = 71.234 kPa); N 0.66 → N₂ ✓ |
| PSI-69 · C12M101 | 0.18, 70.168 | row 121 | O 0.18; N 0.42; 526.3 mmHg | ✓; O + N = 0.60, so 0.40 is another gas → layer "diluent mixed" is consistent |
| PSI-69 · 264F003 | 0.21, 309.295 | row 12 | O 0.21; N 0.09; 2319.9 mmHg | ✓ (about 3 atm); O + N = 0.30 → "mixed" ✓. Header subscripts are lost in the CSV (O for O₂), as the record notes |
| PSI-39 · 1213 / 1340 / 1356 | 0.17, 101.325 / 0.21, 506.625 / 0.21, 50.663 | CFI.csv rows 7, 56, 63 | `Oxygen` 0.17 / 0.21 / 0.21 (no unit); `Pressure` "1 atm" / "5 atm " / "0.5 atm" | ✓. Oxygen + Nitrogen + Helium = 1 in these rows, so the reading as ambient mole fractions holds |
| PSI-159 · 21088 P1 / 21162A1 / 21106 H1 / 21130 G1 | 0.1797, 101.33 / 0.3997, 101.33 / 0.2067, 50.665 / 0.2167, 303.99 | Normal Flames.csv rows 14, 139, 43, 101 | `XO2 before test`; `approx p (bar)` 1.0133 / 1.0133 / 0.50665 / 3.0399 | ✓ as labelled (bar × 100). The values are exactly 1, 0.5 and 3 atm written in bar (1 atm = 1.01325 bar), which is consistent with the header unit. The header says "approx", and the record notes it |
| PSI-10 · 19206H4 / 21301A1 / 19189P1 | 0.198, 102.525 / 0.40, 94.432 / 0.3655, 131.414 | Normal Flame.csv rows 187, 188, 141 | `XO2 (init)`; `pinit (atm)` 1.01184402 / 0.931972789 / 1.29695676 | ✓ initial ambient values; atm × 101.325 ✓. PSI-10 has no license stated on PSI |
| PSI-26 · 100 / 60 / 80 | 0.1605, 99.501 / 0.2258, 102.208 / 0.1707, 98.285 | As Run_Test Matrix.xlsx, sheet `as run matrix`, rows 110, 61, 86 | `O2 % by volume` = 0.1605 / 0.22583… / 0.1707; `pressure, atm` 0.982 / 1.00871… / 0.97 | The values are fractions under a "%" header. The record's `unit-label-mismatch` note is justified: 0.16 % O₂ could not sustain the reported burns. **Unverified**: the header group is "ISS environment", and the sheet does not say where it was measured (cabin or chamber) |
| PSI-25 · T9 (16.4 % vertex) | 0.164, 101.33 | BASS-II.csv row 108; Summary Report p. 102 | `Calibrated initial O2 % by vol` 16.4; p. 102: tests "in ambient O2 molar fraction of 16 to 21 percent. Ambient pressure was 1 atm." | ✓. The O₂ is per test and the 1 atm is stated for the series. Row 81 (P8, also 16.4 %) has "would not stay lit" in `Air display`; that is outcome information, not a condition |
| PSI-25 · 1-g PMMA series | 0.21, 101 | Summary Report pp. 46, 49 | p. 46: "pressure 101 kPa, O2 level 21 percent"; p. 49 Fig. 2.20 caption: "in 1g at San Diego State University" | ✓ and regime normal_gravity ✓. The record already notes that the Fig. 2.20 caption gives 20.7 % for the same series (not averaged) |

## Manual checks: regime and campaign-wide (`*`) records

| Record | Source | What it says | Check |
|---|---|---|---|
| PSI-20 `*` fuel_phase = gas | Final report p. 45 | "A flat porous burner fed with gaseous fuel simulates the burning of solid and liquid fuels…" | ✓. What burns is gas; the solid and liquid fuels are emulated, as the note says. **Limit**: a "gas" verdict says nothing about real solid or liquid samples |
| PSI-22 `*` o2 = 0.21 (status extracted) | Final report p. 11; link on pp. 20–21 | p. 11: "21/79 oxygen/nitrogen mixture (on a volume basis)" in the bottles; p. 20: "the oxygen/nitrogen bottles used to fill the chamber" (stated "for most ACME experiments"); p. 21: coflow "air" "which also fills the chamber" | ✓ as the nominal chamber fill, not a measured value per test (the note says so) |
| PSI-22 `*` o2 = 0.21 (status insufficient_evidence) | Final report p. 4 | "will have a nominal molar composition of 21% O2" (a plan) | ✓ correctly excluded from evidence |

## Findings

**F1. A PSI-20 vertex is contradicted by its source; it changes a verdict (BLOCKER under `VALIDATION.md`).** The PSI-20 records pair every O₂ value of a test day with every pressure value of the same day (the `test_id` is the day). On 2021-Jan-20 this gives a vertex at **21 % O₂, 57 kPa**:

- the 21 % comes from the table cell `Oxygen Conc (percent)` = "21; 26.5; 34" (ACME BRE.csv row 17);
- the 57 kPa comes from report p. 154, which says the 0.57 bar tests were "at 30-35% oxygen", and that at "normal atmospheric conditions (e.g., ~21% oxygen by volume)" the flames self-extinguished.

The engine therefore answers a target of 21 % O₂ at 57 kPa (microgravity, gas, N₂) with **PSI-20 APPLICABLE**. The same holds for 22 % at 60 kPa. No 21 % test at 57 kPa is stated in the sources read.

**F2. Two more PSI-20 vertices are pairings the source does not state.**

- **40 % O₂, 70.33 kPa (day 2019-Feb-25).** Table 1 (p. 24) lists the day's O₂ as "21%, 26.5%, 34%, 40%" with no pressure per value. The 10.2 psia comes from the Fig. 6 caption (p. 25) for test 19056F1 at 27 % O₂.
- **40 % O₂, 101.35 kPa (day 2020-Dec-5).** The 14.7 psia comes from the Fig. 17 caption (p. 103) for a test at XO₂ = 37.95 %. Page 111 says "most of the round 2 tests" ran at "roughly 14.7 psia", so this pairing is plausible but not stated.

**Proposed fix (for the data and engine owners; not made here because `data/conditions/` and `engine/` belong to other teams).** Pair O₂ and pressure only where a source states the pair: split the PSI-20 day records by test where Table 1, the figure captions or Appendix F give per-test conditions. Mark the remaining cross-day combinations `insufficient_evidence`. Then re-run `validation/run_all.py` and the envelope tests.

## What remains unverified

- The other hull vertices are not reviewed by hand: the 5 PSI-23 vertices, the remaining PSI-26 and PSI-69 vertices, and any vertex whose records cite files not opened here. Only the table cells and quotes of the 10 files above were traced.
- 166 of the 172 `*` records were not reviewed by hand. This includes the gravity-regime records of PSI-21, PSI-69, PSI-98, PSI-99, PSI-100 and PSI-106, which cite PSI investigation JSON records, readme DOCX files and NTRS documents that were not downloaded in this session.
- `psi-data/PSI-20/Science Documents/PSI-20_Science Documents_BRE_data_interpretation_20220804.pdf` (fuel phase, p. 2) was not downloaded.
- Whether a PSI-20 BRE flame at a given O₂ ignited or self-extinguished is outcome information. The engine does not compare outcomes; the envelope uses conditions only.
- The location of the PSI-26 "ISS environment" O₂ measurement.

None of this sample changes the status of any record. The dataset remains "extracted, not human-verified" except where a record says otherwise.
