---
id: ds-psi-25
title: PSI-25 BASS-II: Burning and Suppression of Solids - II
chapter: data
order: 106
keywords: PSI-25, BASS-II, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/4qc4-de67, psi-data/PSI-25/_investigation/PSI-25.json section=objective, psi-data/PSI-25/Experimental table/PSI-25_Experimental table_BASS-II.csv, psi-data/PSI-25/_investigation/PSI-25.json, psi-data/PSI-25/Science Documents/PSI-25_Science Documents_BASS-II_SRD.pdf
---
PSI-25 BASS-II is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Burning and Suppression of Solids - II”. Release 31-Dec-2022, version 4. DOI [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67). License: CC0-1.0.

In plain words: this page says what PSI-25 looked at, what conditions PYRION could read from it (with the place in NASA's files where each one is written), and what it could not read. 707 of its 834 records are usable as evidence.

## What it studied
PSI objective (quoted, section `objective`):

> BASS-II results contribute to the combustion computational models used in the design of fire detection and suppression systems in microgravity and on Earth. Objectives Include: 1) Study the ignition, flame growth, flame spread, and extinction limits for solid fuels burning in low-velocity forced flows in microgravity. 2) Begin to bridge the gap between the normal gravity NASA-STD-6001 Test #1 method, ground-based microgravity tests, and actual material flammability in microgravity. 3) Provide SoFIE PIs with preliminary data to refine Science Requirements. [...]

PSI hypothesis (quoted, section `hypothesis`):

> BASS–II tests the hypothesis that materials in microgravity, with adequate ventilation, burn as well if not better than the same material in normal gravity with other conditions being identical (pressure, O2 concentration, temperature, etc.). NASA tests and controls materials from a flammability perspective using an upward burning test in normal gravity, which is considered to be the worst-case geometry for flammability of the material on Earth. However, it may not be conservative for flammability in space. Testing at constant O2 mole fractions permits studying flame spread and extinction at low and high flow speed. [...]

As recorded by PSI: flight program: International Space Station (ISS); hardware: Microgravity Science Glovebox (MSG); managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **International Space Station (ISS)** (quote: “International Space Station (ISS)”, `section=flightProgram`).
- Platform: **Microgravity Science Glovebox (MSG)** (quote: “Microgravity Science Glovebox (MSG)”, `section=experimentHardware`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “To summarize, BASS-II's approach, microgravity combustion tests were performed aboard the International Space Station.”, `section=approach`, PSI-25.json).
- Gravity regime: **normal_gravity** for test(s) `1-g downward PMMA sheet series (SDSU Flame Stabilizer, Summary Report section 2.3.5, condition stated once for the series)` (quote: “PMMA (NASA and Astra) in 1g at San Diego State University”, `page=49`, PSI-25_Reports_BASS-II Summary Report.pdf).

## Fuel and flame configuration
fuel phase: solid (257); diluent: N2 (1); flow configuration: opposed (17); material (49 distinct): 2 cm SIBAL (17), 1/4" clear rod (15), 1/4" black rod (12), 1 cm SIBAL (8), 3/8" black rod (7), 1 cm wide 200 micron thick PMMA (5), 3/8" clear rod (5), 1/2" clear PMMA rod (4).

## What was extracted
834 condition records in `data/conditions/PSI-25.csv`: 707 usable, 127 marked `insufficient_evidence`. They cover 130 distinct tests (plus 5 records that apply to every test of the investigation).

| Variable | Usable records | Insufficient |
|---|---|---|
| gravity regime | 2 | 0 |
| fuel phase | 257 | 0 |
| diluent | 1 | 0 |
| ambient O2 (mole fraction) | 130 | 0 |
| pressure (kPa) | 1 | 0 |
| flow velocity (cm/s) | 0 | 126 |
| sample thickness (mm) | 41 | 1 |
| material | 129 | 0 |
| flow configuration | 17 | 0 |
| platform | 2 | 0 |
| outcomes (measured results) | 127 | 0 |

Measured ranges over the usable records:
- ambient O2 (mole fraction): 0.136 to 0.222 (that is 13.6 to 22.2 % by volume, arithmetic on the stored fraction)
- pressure (kPa): 101 to 101
- sample thickness (mm): 0.1 to 5

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `flow_velocity` (125): display reading series during the test, not a test condition
- `sample_thickness` (1): the description states two different thicknesses: 3 mm thick, 2 cm thick
- `flow_velocity` (1): Capability claim from the PSI record ('could impose'), not tested speeds; contradicted by Summary Report page=12 (max ~55 cm/s without restrictors, ~35 cm/s with two), page=72 (Olson 0-55 cm/s) and page=104 Table 7.1 (T17 '6 to [...]

Table cells that hold no readable number (listed in `extraction/skipped_cells.csv`):
- column `Calibrated final O2 % by vol`: 2 cells (cell marks 'no value')

Ground (1 g) data check: `partial` in the ground-test inventory (see the article on the ground inventory).

Published papers listed for this investigation: 17 (see `data/manifest/publications.csv`).

## For engineers
- `method`: 552 `table` records (read by code from a PSI table; the quote is the column header) and 282 `document` records (verbatim sentence with its page or section). `verified` status: 0 (no person has compared records with the source yet).
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-25/Experimental table/PSI-25_Experimental table_BASS-II.csv` (552 records)
  - `psi-data/PSI-25/_investigation/PSI-25.json` (133 records)
  - `psi-data/PSI-25/Science Documents/PSI-25_Science Documents_BASS-II_SRD.pdf` (128 records)
  - `psi-data/PSI-25/Science Documents/PSI-25_Science Documents_BASS-II_ReadMe.docx` (17 records)
  - `psi-data/PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf` (4 records)
- Every value is located in its source by code; see the articles on how values are located and on validation severities.
- Investigation record: `data/raw/psi-data/PSI-25/_investigation/PSI-25.json` (the text fields quoted above).
- Accession `PSI-25`; DOI `10.60555/4qc4-de67`; PSI version 4; files in version 695, files selected for PYRION 10.
