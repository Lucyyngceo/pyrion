---
id: ds-psi-23
title: PSI-23 ACME s-Flame: Advanced Combustion via Microgravity Experiments-Structure and Response of Spherical [...]
chapter: data
order: 105
keywords: PSI-23, ACME s-Flame, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/k57n-p030, psi-data/PSI-23/_investigation/PSI-23.json section=objective, psi-data/PSI-23/Experimental table/PSI-23_Experimental table_ACME s-Flame.csv, psi-data/PSI-23/Reports/PSI-23_Reports_s_Flame_final_report_20210729.pdf, psi-data/PSI-23/_investigation/PSI-23.json
---
PSI-23 ACME s-Flame is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Advanced Combustion via Microgravity Experiments-Structure and Response of Spherical Diffusion Flames”. Release 05-Apr-2018, version 4. DOI [10.60555/k57n-p030](https://doi.org/10.60555/k57n-p030). License: CC0-1.0.

In plain words: this page says what PSI-23 looked at, what conditions PYRION could read from it (with the place in NASA's files where each one is written), and what it could not read. 61 of its 81 records are usable as evidence.

## What it studied
PSI objective (quoted, section `objective`):

> A series of experiments is proposed with the following specific objectives, in both soot-free and sooty flames, to compare with detailed computational simulation to assess transport properties and detailed chemical kinetics (including chemiluminescence): Objective A. Measure and characterize the transient structure (such as temperature and species distribution) of diffusion flames established at initially non-steady, spherical flame structures for mixtures of different H2/CH4/diluent ratios (soot-free) and different C2H4/diluent ratios (sooty), for different flow rates. Objective B. [...]

PSI hypothesis (quoted, section `hypothesis`):

> The transient numerical simulation of spherical flames developed as part of this program includes detailed chemistry and transport models, especially radiation mechanisms. Each description of the flames obtained from the experiment, including measurements of aspects of the flame structure, growth or flame front velocities, and the specific test conditions where steady state flames, flame extinctions, flame front instabilities, soot suppression limits, etc., comprise a rigorous test of the detailed model. Together they provide a measure of the comprehensiveness of the chemical kinetic and transport models. [...]

As recorded by PSI: flight program: International Space Station (ISS); hardware: Combustion Integrated Rack (CIR), ACME; managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Combustion Integrated Rack (CIR)** (quote: “Combustion Integrated Rack (CIR), ACME”, `section=experimentHardware`).
- Platform: **International Space Station (ISS)** (quote: “International Space Station (ISS)”, `section=flightProgram`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “The project has completed two (2) rounds of microgravity experimentation.”, `page=25`, PSI-23_Reports_s_Flame_final_report_20210729.pdf).

## Fuel and flame configuration
fuel phase: gas (1); diluent: He (9), N2 (3); fuel (14 distinct): 50% C2H4 with N2 (2), 100% H2 (2), 45% CH4 with N2 (1), 44.4% H2 with CH4 (1), 66.7% H2 with CH4 (1), 25% H2, 20% CH4, with He (1), 20% H2, 25% CH4, with He (1), 30% H2, 15% CH4, with He (1).

## What was extracted
81 condition records in `data/conditions/PSI-23.csv`: 61 usable, 20 marked `insufficient_evidence`. They cover 18 distinct tests (plus 10 records that apply to every test of the investigation).

| Variable | Usable records | Insufficient |
|---|---|---|
| gravity regime | 1 | 1 |
| fuel phase | 1 | 1 |
| diluent | 12 | 13 |
| ambient O2 (mole fraction) | 23 | 3 |
| pressure (kPa) | 4 | 0 |
| fuel | 16 | 2 |
| platform | 4 | 0 |

Measured ranges over the usable records:
- ambient O2 (mole fraction): 0.21 to 0.3 (that is 21 to 30 % by volume, arithmetic on the stored fraction)
- pressure (kPa): 101.325 to 101.325

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `diluent` (4): Table 1, Atmosphere column: this cell is merged over test days 19352, 20006, 20013, 20024 and 20029. The PSI table reads differently for four of them: CSV row=6 (20006) '~21% O2 with N3', row=7 (20013) '~21% O2 with N4', row=8 [...]
- `diluent` (2): 'N3' is not a gas: spreadsheet fill-series artifact
- `fuel` (2): contains a spreadsheet fill-series artifact (e.g. 'N3')
- `diluent` (2): 'N4' is not a gas: spreadsheet fill-series artifact
- `diluent` (1): 'N5' is not a gas: spreadsheet fill-series artifact

Ground (1 g) data check: `none` in the ground-test inventory (see the article on the ground inventory).

Published papers listed for this investigation: 44 (see `data/manifest/publications.csv`).

## For engineers
- `method`: 59 `table` records (read by code from a PSI table; the quote is the column header) and 22 `document` records (verbatim sentence with its page or section). `verified` status: 0 (no person has compared records with the source yet).
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-23/Experimental table/PSI-23_Experimental table_ACME s-Flame.csv` (60 records)
  - `psi-data/PSI-23/Reports/PSI-23_Reports_s_Flame_final_report_20210729.pdf` (17 records)
  - `psi-data/PSI-23/_investigation/PSI-23.json` (4 records)
- Every value is located in its source by code; see the articles on how values are located and on validation severities.
- Investigation record: `data/raw/psi-data/PSI-23/_investigation/PSI-23.json` (the text fields quoted above).
- Accession `PSI-23`; DOI `10.60555/k57n-p030`; PSI version 4; files in version 4165, files selected for PYRION 107.
