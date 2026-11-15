---
id: ds-psi-10
title: PSI-10 ACME/Flame Design: Advanced Combustion via Microgravity Experiments / Flame Design
chapter: data
order: 101
keywords: PSI-10, ACME/Flame Design, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/w4zy-bt45, psi-data/PSI-10/_investigation/PSI-10.json section=objective, psi-data/PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Normal Flame.csv, psi-data/PSI-10/Reports/PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf, psi-data/PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Inverse Flame.csv
---
PSI-10 ACME/Flame Design is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Advanced Combustion via Microgravity Experiments / Flame Design”. Release 20-Nov-2025, version 1. DOI [10.60555/w4zy-bt45](https://doi.org/10.60555/w4zy-bt45). License: not stated on its PSI page or record.

In plain words: this page says what PSI-10 looked at, what conditions PYRION could read from it (with the place in NASA's files where each one is written), and what it could not read. 2165 of its 2165 records are usable as evidence.

## What it studied
PSI objective (quoted, section `objective`):

> The primary objectives of this flight experiment are: A. Obtain soot-inception limits of quasi-steady normal and inverse spherical diffusion flames as functions of flow rate, Zst, amount of inert (N2 or CO2), and pressure for C2H4 and CH4 flames. Identify the corresponding temperatures in hot regions. Obtain similar limits and temperatures for inverse and normal coflow flames. B. Obtain detailed measurements in quasi-steady normal and inverse spherical diffusion flames for C2H4 and CH4. Determine the effects of flow rate, Zst, amount of N2, and pressure on flame temperature, size, color, and soot volume fraction. [...]

PSI hypothesis (quoted, section `hypothesis`):

> 1. Soot formation requires a region where local C/O ratio and T exceed their critical values, and where strain rate is sufficiently low. 2. Microgravity spherical diffusion flames extinguish when the peak temperature first decreases below 1130 K. 3. Steady-state spherical diffusion flames are possible.

As recorded by PSI: flight program: International Space Station (ISS); hardware: Advanced Combustion via Microgravity Experiments (ACME), Combustion Integrated Rack (CIR), Reconfiguration of Combustion Integrated Rack (CIR); managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Combustion Integrated Rack (CIR)** (quote: “The Flame Design experiment is one of six independent experiments that make up the Advanced Combustion via Microgravity Experiments (ACME) project for which the tests were conducted within the Combustion Integrated Rack [...]”, `page=3`).
- Platform: **International Space Station (ISS)** (quote: “International Space Station (ISS)”, `section=flightProgram`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “The challenges of normal-gravity studies are avoided by performing the tests on the International Space Station (ISS), where the non-buoyant microgravity flames allow the effects of convection direction and flame structure to be independently varied.”, `page=44`, PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf).
- Gravity regime: **microgravity** for test(s) `*` (quote: “In this work, experiments aboard the International Space Station and a transient numerical model are used to investigate the existence of steady-state microgravity spherical diffusion flames. [...]”, `page=25`, PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf).

## Fuel and flame configuration
fuel phase: gas (30); diluent: N2 (327); flame type: normal (207), inverse (120); fuel (3 distinct): C2H4 (187), ethylene (132), C3H8 (20).

## What was extracted
2165 condition records in `data/conditions/PSI-10.csv`: 2165 usable, 0 marked `insufficient_evidence`. They cover 327 distinct tests (plus 7 records that apply to every test of the investigation).

| Variable | Usable records | Insufficient |
|---|---|---|
| gravity regime | 2 | 0 |
| fuel phase | 30 | 0 |
| diluent | 327 | 0 |
| flame type | 327 | 0 |
| ambient O2 (mole fraction) | 207 | 0 |
| burner-stream O2 (mole fraction) | 109 | 0 |
| pressure (kPa) | 327 | 0 |
| fuel | 339 | 0 |
| platform | 3 | 0 |
| outcomes (measured results) | 494 | 0 |

Measured ranges over the usable records:
- ambient O2 (mole fraction): 0.198048 to 0.4 (that is 19.8 to 40 % by volume, arithmetic on the stored fraction)
- burner-stream O2 (mole fraction): 0.212017 to 0.849978 (that is 21.2 to 85 % by volume, arithmetic on the stored fraction)
- pressure (kPa): 43.0233 to 304.748

## What could not be extracted, and why
No record of this investigation is marked insufficient.

Table cells that hold no readable number (listed in `extraction/skipped_cells.csv`):
- column `XO2`: 11 cells (cell marks 'no value')

Ground (1 g) data check: `none` in the ground-test inventory (see the article on the ground inventory).

Published papers listed for this investigation: 33 (see `data/manifest/publications.csv`).

## For engineers
- `method`: 1671 `table` records (read by code from a PSI table; the quote is the column header) and 494 `document` records (verbatim sentence with its page or section). `verified` status: 0 (no person has compared records with the source yet).
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Normal Flame.csv` (1202 records)
  - `psi-data/PSI-10/Reports/PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf` (492 records)
  - `psi-data/PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Inverse Flame.csv` (469 records)
  - `psi-data/PSI-10/_investigation/PSI-10.json` (2 records)
- Every value is located in its source by code; see the articles on how values are located and on validation severities.
- Investigation record: `data/raw/psi-data/PSI-10/_investigation/PSI-10.json` (the text fields quoted above).
- Accession `PSI-10`; DOI `10.60555/w4zy-bt45`; PSI version 1; files in version 3807, files selected for PYRION 15.
