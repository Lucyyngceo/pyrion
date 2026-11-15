---
id: ds-psi-20
title: PSI-20 ACME BRE: Advanced Combustion via Microgravity Experiments - Burning Rate Emulator
chapter: 9
order: 2
keywords: PSI-20, ACME BRE, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp: []
sources: ["doi:10.60555/vb93-3y72", "psi-data/PSI-20/_investigation/PSI-20.json section=objective", "psi-data/PSI-20/Reports/PSI-20_Reports_Final_20220201.pdf", "psi-data/PSI-20/Experimental table/PSI-20_Experimental table_ACME BRE.csv", "psi-data/PSI-20/Reports/PSI-20_Reports_Dissertation-PD-revised_.pdf"]
---
PSI-20 ACME BRE is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Advanced Combustion via Microgravity Experiments - Burning Rate Emulator”. Release 15-Sep-2022, version 4. DOI [10.60555/vb93-3y72](https://doi.org/10.60555/vb93-3y72). License: CC0-1.0.

In plain words: this page says what PSI-20 looked at, what conditions PYRION could read from it (with the place in NASA's files where each one is written), and what it could not read. 101 of its 163 records are usable as evidence.

## What it studied
PSI objective (quoted, section `objective`):

> The BRE flight program seeks to establish the burning conditions in a quiescent microgravity ambient in terms of material properties. The specific flight objectives are as follows. 1. Observe burning behavior in long-duration microgravity for CH4/N2 and C2H4/N2mixtures on porous circular burners of 25 and 50 mm diameter. Consider O2/N2 ambients with various pressures and ambient O2 concentrations and pressures. NASA - considered atmosphere for human space missions will be examined: 14.7 psia, 21 % oxygen: 10.2 psia, 26.5 %; and 8.2 psia, 34 % oxygen. Emphasize fuel conditions that can be related to a diverse range of condensed fuels. 2. [...]

PSI hypothesis (quoted, section `hypothesis`):

> The BRE investigation hypothesizes that there can exist a regime of quasi-steady burning in microgravity as a function of materials properties. Steady burning may never be achieved, and only slowly changing unsteady flames are possible. The proposed tests aboard the ISS aims to query this hypothesis by establishing a range of quasi-steady burning conditions for condensed fuels in the microgravity environment. It is hypothesized that BRE can determine a range of burning conditions in microgravity as a function of heat of gasification, reradiation heat flux, applied radiant heat flux, heat of combustion and smoke point. [...]

As recorded by PSI: flight program: International Space Station (ISS); hardware: Combustion Integrated Rack (CIR), ACME; managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Combustion Integrated Rack (CIR)** (quote: “The Burning Rate Emulator (BRE) experiment is one of six independent experiments that make up the Advanced Combustion via Microgravity Experiments (ACME) project for which tests are conducted within the Combustion [...]”, `page=3`).
- Platform: **International Space Station (ISS)** (quote: “International Space Station (ISS)”, `section=flightProgram`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “Quasi-steady burning corresponding to various condensed-phase materials (such as PMMA and Nylon) was observed in microgravity despite the absence of air flow, where the cessation of ventilation is an established step in putting out spacecraft fires.”, `section=researchImpacts`, PSI-20.json).
- Gravity regime: **microgravity** for test(s) `*` (quote: “We see this as well in the extended ISS microgravity tests.”, `page=18`, PSI-20_Reports_Final_20220201.pdf).
- Gravity regime: **normal_gravity** for test(s) `1-g BRE series (Auth [55], ground burner), heat of combustion 43.7 kJ/g (dissertation Fig. 5.4 legend, 1-g table row 1)` (quote: “The data measured in 1-g and discussed in [55] is added to the plot for comparison between micro- and normal gravity burning.”, `page=104`, PSI-20_Reports_Dissertation-PD-revised_.pdf).

## Fuel and flame configuration
fuel phase: gas (7); diluent: N2 (11); fuel (4 distinct): 100% C2H4 (8), 50% C2H4 (5), 100%C2H4 (3), 100% CH4 (2).

## What was extracted
163 condition records in `data/conditions/PSI-20.csv`: 101 usable, 62 marked `insufficient_evidence`. They cover 22 distinct tests (plus 9 records that apply to every test of the investigation).

| Variable | Usable records | Insufficient |
|---|---|---|
| gravity regime | 6 | 0 |
| fuel phase | 7 | 0 |
| diluent | 11 | 0 |
| ambient O2 (mole fraction) | 45 | 2 |
| pressure (kPa) | 12 | 60 |
| fuel | 18 | 0 |
| platform | 2 | 0 |

Measured ranges over the usable records:
- ambient O2 (mole fraction): 0.21 to 0.4 (that is 21 to 40 % by volume, arithmetic on the stored fraction)
- pressure (kPa): 56 to 101.353

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `pressure` (27): Nominal atmospheres of round 1 (Appendix D, written after round 1 ended). 'especially focused' is not exhaustive: Table 1 (p.24) also lists 40% O2 on 19039, 19056 and 19063, which this sentence does not cover (see R16). [...]
- `pressure` (24): Read from the legend text inside Figure 14 (Appendix D). Each legend row is SE, FT (plot symbols, missing from the text layer), Xf, XO2, p (bar); the LAST number of each row is p. Distinct p values: 1, 0.56, 0.7 bar. [...]
- `pressure` (9): confidence ambiguous ('most of' the round-2 tests, not all, and 'roughly'. Known exceptions: 2021-Jan-20 (0.57 bar for five tests, R18) and the p.149 test at roughly 0.6 atm (R20). Day mapping: report day 20261 (17 Sept. [...]
- `o2_mole_fraction` (2): reads as thousands of percent

Ground (1 g) data check: `partial` in the ground-test inventory (see the article on the ground inventory).

Published papers listed for this investigation: 16 (see `data/manifest/publications.csv`).

## For engineers
- `method`: 61 `table` records (read by code from a PSI table; the quote is the column header) and 102 `document` records (verbatim sentence with its page or section). `verified` status: 0 (no person has compared records with the source yet).
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-20/Reports/PSI-20_Reports_Final_20220201.pdf` (81 records)
  - `psi-data/PSI-20/Experimental table/PSI-20_Experimental table_ACME BRE.csv` (62 records)
  - `psi-data/PSI-20/Reports/PSI-20_Reports_Dissertation-PD-revised_.pdf` (16 records)
  - `psi-data/PSI-20/_investigation/PSI-20.json` (3 records)
  - `psi-data/PSI-20/Science Documents/PSI-20_Science Documents_BRE_data_interpretation_20220804.pdf` (1 records)
- Every value is located in its source by code; see the articles on how values are located and on validation severities.
- Investigation record: `data/raw/psi-data/PSI-20/_investigation/PSI-20.json` (the text fields quoted above).
- Accession `PSI-20`; DOI `10.60555/vb93-3y72`; PSI version 4; files in version 2361, files selected for PYRION 64.
