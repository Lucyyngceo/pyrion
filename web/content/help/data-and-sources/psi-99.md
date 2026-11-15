---
id: ds-psi-99
title: PSI-99 SAFFIRE-II: Spacecraft Fire Experiment-II
chapter: 9
order: 15
keywords: PSI-99, SAFFIRE-II, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp: []
sources: ["doi:10.60555/2chp-m469", "psi-data/PSI-99/_investigation/PSI-99.json section=objective", "psi-data/PSI-99/Experimental table/PSI-99_Experimental table_SAFFIRE-2.csv", "psi-data/PSI-99/_investigation/PSI-99.json", "psi-data/PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE Objectives, Development and Status.pdf"]
---
PSI-99 SAFFIRE-II is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Spacecraft Fire Experiment-II”. Release 18-Sep-2024, version 5. DOI [10.60555/2chp-m469](https://doi.org/10.60555/2chp-m469). License: CC0-1.0.

In plain words: this page says what PSI-99 looked at, what conditions PYRION could read from it (with the place in NASA's files where each one is written), and what it could not read. 50 of its 58 records are usable as evidence.

## What it studied
PSI objective (quoted, section `objective`):

> The objectives of SAFFIRE-II are to determine how rapidly a large scale fire grows in low-gravity and to investigate the low-g flammability limits compared to those obtained in NASA’s normal gravity material flammability screening test.

PSI hypothesis (quoted, section `hypothesis`):

> This investigation hypothesizes that due to large differences between fire behavior in normal and reduced gravity, the use of terrestrial fires and fire standards to design spacecraft fire safety systems presents an inherent risk to the vehicle because of the significant level of uncertainty. While this approach has been successful thus far, the uncertainty and risk will increase as exploration missions venture further from earth with considerably longer transit times for a safe return. There is a significant lack of microgravity data available for spacecraft designers on which to base their fire safety designs and procedures. [...]

As recorded by PSI: flight program: Cygnus Spacecraft; hardware: Cygnus Pressurized Cargo Module, SAFFIRE; managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Cygnus Pressurized Cargo Module** (quote: “Cygnus Pressurized Cargo Module, SAFFIRE”, `section=experimentHardware`).
- Platform: **Orbital Science’s Cygnus resupply vehicle** (quote: “The Saffire-II experiment was performed on the Orbital Science’s Cygnus resupply vehicle after it deberthed from the ISS.”, `section=approach`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “µ-g Burn Length µ-g Spread Rate 1-g Burn Length 1-g Spread Rate”, `page=31`, 20180005168.pdf).

## Fuel and flame configuration
fuel phase: solid (1); diluent: N2 (1); flow configuration: concurrent (8), opposed (1); material (4 distinct): Silicone (4), Cotton-Fiberglass (SIBAL) (1), PMMA & Nomex (1), PMMA (1).

## What was extracted
58 condition records in `data/conditions/PSI-99.csv`: 50 usable, 8 marked `insufficient_evidence`. They cover 9 distinct tests (plus 10 records that apply to every test of the investigation).

| Variable | Usable records | Insufficient |
|---|---|---|
| gravity regime | 1 | 4 |
| fuel phase | 1 | 0 |
| diluent | 1 | 0 |
| ambient O2 (mole fraction) | 9 | 0 |
| flow velocity (cm/s) | 9 | 0 |
| sample thickness (mm) | 6 | 3 |
| material | 7 | 0 |
| flow configuration | 9 | 0 |
| platform | 2 | 1 |
| outcomes (measured results) | 5 | 0 |

Measured ranges over the usable records:
- ambient O2 (mole fraction): 0.215 to 0.221 (that is 21.5 to 22.1 % by volume, arithmetic on the stored fraction)
- flow velocity (cm/s): 20 to 20
- sample thickness (mm): 0.27 to 10

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `sample_thickness` (3): written without a decimal point (0.37 mm or 37 mm?)
- `gravity_regime` (1): Objective statement, not a statement of the conditions of the completed tests; 'low-gravity' mapped to the controlled value microgravity. [...]
- `gravity_regime` (1): Objective statement specific to SAFFIRE-II; 'long-duration low-gravity' mapped to microgravity. The 'NASA-STD-6001 Test 1 normal-gravity tests' are the ground reference, not tests reported in PSI-99.
- `gravity_regime` (1): Research-impact statement about the results; it does not say explicitly that the tests were conducted in microgravity.
- `gravity_regime` (1): Pre-flight paper (future tense, launches 'all planned for 2016'); the sentence covers Saffire-I, -II and -III together; 'low-gravity' mapped to microgravity.

Table cells that hold no readable number (listed in `extraction/skipped_cells.csv`):
- column `Burn Time (s)`: 4 cells (outcome:burn_time: not '<number> <unit>')
- column `Samle Thickness`: 1 cells (sample_thickness: not '<number> <unit>')

Ground (1 g) data check: `partial` in the ground-test inventory (see the article on the ground inventory).

Published papers listed for this investigation: 7 (see `data/manifest/publications.csv`).

## For engineers
- `method`: 48 `table` records (read by code from a PSI table; the quote is the column header) and 10 `document` records (verbatim sentence with its page or section). `verified` status: 0 (no person has compared records with the source yet).
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-99/Experimental table/PSI-99_Experimental table_SAFFIRE-2.csv` (48 records)
  - `psi-data/PSI-99/_investigation/PSI-99.json` (6 records)
  - `psi-data/PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE Objectives, Development and Status.pdf` (2 records)
  - `psi-data/PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE-II Readme.docx` (1 records)
  - `nasa/ntrs-20180005168/20180005168.pdf` (1 records)
- Every value is located in its source by code; see the articles on how values are located and on validation severities.
- Investigation record: `data/raw/psi-data/PSI-99/_investigation/PSI-99.json` (the text fields quoted above).
- Accession `PSI-99`; DOI `10.60555/2chp-m469`; PSI version 5; files in version 217, files selected for PYRION 6.
