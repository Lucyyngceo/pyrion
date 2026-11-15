---
id: ds-psi-98
title: PSI-98 SAFFIRE-I: Spacecraft Fire Safety Experiment-I
chapter: 9
order: 14
keywords: PSI-98, SAFFIRE-I, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp: []
sources: ["doi:10.60555/0t15-1z43", "psi-data/PSI-98/_investigation/PSI-98.json section=objective", "psi-data/PSI-98/Experimental table/PSI-98_Experimental table_SAFFIRE-1.csv", "psi-data/PSI-98/_investigation/PSI-98.json", "psi-data/PSI-98/Science Documents/PSI-98_Science Documents_SAFFIRE-I and SAFFIRE-III Readme.docx"]
---
PSI-98 SAFFIRE-I is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Spacecraft Fire Safety Experiment-I”. Release 18-Sep-2024, version 4. DOI [10.60555/0t15-1z43](https://doi.org/10.60555/0t15-1z43). License: CC0-1.0.

In plain words: this page says what PSI-98 looked at, what conditions PYRION could read from it (with the place in NASA's files where each one is written), and what it could not read. 15 of its 21 records are usable as evidence.

## What it studied
PSI objective (quoted, section `objective`):

> The objectives of this investigation were to: (1) determine how rapidly a large scale fire grows in low-gravity and (2) investigate the low-g flammability limits compared to those obtained in NASA’s normal gravity material flammability screening test.

PSI hypothesis (quoted, section `hypothesis`):

> This investigation hypothesizes that due to large differences between fire behavior in normal and reduced gravity, the use of terrestrial fires and fire standards to design spacecraft fire safety systems presents an inherent risk to the vehicle because of the significant level of uncertainty. While this approach has been successful thus far, the uncertainty and risk will increase as exploration missions venture further from earth with considerably longer transit times for a safe return. There is a significant lack of microgravity data available for spacecraft designers on which to base their fire safety designs and procedures. [...]

As recorded by PSI: flight program: International Space Station (ISS); hardware: Saffire 1 enclosure in Cygnus; managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Cygnus** (quote: “Saffire 1 enclosure in Cygnus”, `section=experimentHardware`).
- Platform: **Cygnus resupply vehicle** (quote: “The Saffire-1 experiments was performed on the Orbital Science’s Cygnus resupply vehicle after it deberthed from the ISS.”, `section=approach`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “Flame spread over a large thin charring surface in low-gravity showed that steady flame spread was possible (unlike normal gravity)”, `page=18`, 20180005168.pdf).

## Fuel and flame configuration
fuel phase: solid (1); diluent: N2 (1); flow configuration: concurrent (1), opposed (1); material (1 distinct): SIBAL Fabric (2).

## What was extracted
21 condition records in `data/conditions/PSI-98.csv`: 15 usable, 6 marked `insufficient_evidence`. They cover 2 distinct tests (plus 9 records that apply to every test of the investigation).

| Variable | Usable records | Insufficient |
|---|---|---|
| gravity regime | 1 | 4 |
| fuel phase | 1 | 0 |
| diluent | 1 | 0 |
| ambient O2 (mole fraction) | 2 | 0 |
| flow velocity (cm/s) | 2 | 0 |
| sample thickness (mm) | 0 | 2 |
| material | 2 | 0 |
| flow configuration | 2 | 0 |
| platform | 2 | 0 |
| outcomes (measured results) | 2 | 0 |

Measured ranges over the usable records:
- ambient O2 (mole fraction): 0.215 to 0.217 (that is 21.5 to 21.7 % by volume, arithmetic on the stored fraction)
- flow velocity (cm/s): 20 to 20

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `sample_thickness` (2): cm x 10
- `gravity_regime` (1): Objective statement, not a statement of the test condition. The JSON field has line breaks after 'to:' and after 'normal', each joined with one space. Source term 'low-gravity'; no g-level stated; [...]
- `gravity_regime` (1): Objective statement for the SAFFIRE-I and SAFFIRE-III tests, not a statement of the test condition. Source term 'low-gravity'; no g-level stated; mapped to the controlled term microgravity.
- `gravity_regime` (1): States the purpose of the sample ('to demonstrate ... a large-scale low-gravity fire'), not the measured condition of the burn. Sentence spans two PDF lines ('0.4 m' / 'wide'), joined with one space. Source term 'low-gravity'; [...]
- `gravity_regime` (1): Research-impact summary, not a statement of the test condition. It speaks of 'several spacecraft materials', while section=approach names one material (Sibal) for Saffire-I, so the sentence may describe the Saffire series rather [...]

Ground (1 g) data check: `none` in the ground-test inventory (see the article on the ground inventory).

Published papers listed for this investigation: 6 (see `data/manifest/publications.csv`).

## For engineers
- `method`: 12 `table` records (read by code from a PSI table; the quote is the column header) and 9 `document` records (verbatim sentence with its page or section). `verified` status: 0 (no person has compared records with the source yet).
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-98/Experimental table/PSI-98_Experimental table_SAFFIRE-1.csv` (12 records)
  - `psi-data/PSI-98/_investigation/PSI-98.json` (6 records)
  - `psi-data/PSI-98/Science Documents/PSI-98_Science Documents_SAFFIRE-I and SAFFIRE-III Readme.docx` (1 records)
  - `psi-data/PSI-98/Engineering Documents/PSI-98_Engineering Documents_SAFFIRE-I Operations.pdf` (1 records)
  - `nasa/ntrs-20180005168/20180005168.pdf` (1 records)
- Every value is located in its source by code; see the articles on how values are located and on validation severities.
- Investigation record: `data/raw/psi-data/PSI-98/_investigation/PSI-98.json` (the text fields quoted above).
- Accession `PSI-98`; DOI `10.60555/0t15-1z43`; PSI version 4; files in version 76, files selected for PYRION 8.
