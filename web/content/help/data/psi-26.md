---
id: ds-psi-26
title: PSI-26 BASS: Burning and Suppression of Solids
chapter: data
order: 107
keywords: PSI-26, BASS, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/58h4-dy80, psi-data/PSI-26/_investigation/PSI-26.json section=objective, psi-data/PSI-26/Science Documents/PSI-26_Science Documents_As Run_Test Matrix.xlsx, psi-data/PSI-26/Experimental table/PSI-26_Experimental table_BASS.csv, psi-data/PSI-26/Science Documents/PSI-26_Science Documents_FlammabilityAspectsofFabric_USNationalCombustion.2013.docx
---
PSI-26 BASS is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Burning and Suppression of Solids”. Release 30-Jun-2013, version 4. DOI [10.60555/58h4-dy80](https://doi.org/10.60555/58h4-dy80). License: CC0-1.0.

In plain words: this page says what PSI-26 looked at, what conditions PYRION could read from it (with the place in NASA's files where each one is written), and what it could not read. 379 of its 387 records are usable as evidence.

## What it studied
PSI objective (quoted, section `objective`):

> The two main objectives for BASS are to: 1.) Begin to bridge the gap between the normal gravity NASA-STD-6001 Test#1 method, ground-based microgravity tests, and actual material flammability in microgravity. The relation between these can be investigated by observing flames burning for the longer times available in flight. Practical, realistic (thicker) fuels in typical geometries will be examined, including wake flames which have characteristics of a fire burning behind another object (for example, a fire burning in tight area which may not be easily accessible). [...]

PSI hypothesis (quoted, section `hypothesis`):

> BASS experiments were based on the hypothesis that materials in microgravity, with adequate ventilation, burn as well if not better than the same material in normal gravity with other conditions being identical (pressure, oxygen concentration, temperature, etc.) To test this hypothesis with any but the thinnest materials requires extended microgravity time – longer than available in drop towers or parabolic aircraft.

As recorded by PSI: flight program: International Space Station (ISS); hardware: Microgravity Science Glovebox; managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **International Space Station (ISS)** (quote: “The experiment was conducted aboard the International Space Station (ISS) inside the Microgravity Glove Box (MSG).”, `section=approach`).
- Platform: **Microgravity Science Glovebox** (quote: “Microgravity Science Glovebox”, `section=experimentHardware`).
- Gravity regime: **microgravity** for test(s) `1` (quote: “Microgravity combustion tests burning fabric samples were performed aboard the International Space Station.”, `paragraph=17`, PSI-26_Science Documents_FlammabilityAspectsofFabric_USNationalCombustion.2013.docx).

## Fuel and flame configuration
fuel phase: solid (1); diluent: N2 (1); material (33 distinct): 2 cm sphere (18), PMMA sphere 2 cm (10), SIBAL 2 cm (9), PMMA 2 cm (8), Japan Wax Candle wake (8), 1 cm sphere (6), pmma 2 cm (5), PMMA sphere 1 cm (4).

## What was extracted
387 condition records in `data/conditions/PSI-26.csv`: 379 usable, 8 marked `insufficient_evidence`. They cover 116 distinct tests (plus 12 records that apply to every test of the investigation).

| Variable | Usable records | Insufficient |
|---|---|---|
| gravity regime | 12 | 2 |
| fuel phase | 1 | 1 |
| diluent | 1 | 0 |
| ambient O2 (mole fraction) | 121 | 1 |
| pressure (kPa) | 121 | 0 |
| flow velocity (cm/s) | 0 | 2 |
| material | 121 | 0 |
| flow configuration | 0 | 2 |
| platform | 2 | 0 |

Measured ranges over the usable records:
- ambient O2 (mole fraction): 0.159 to 0.22722 (that is 15.9 to 22.72 % by volume, arithmetic on the stored fraction)
- pressure (kPa): 98.2852 to 102.208

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `gravity_regime` (1): Scope sentence of the PSI Data Layout Document: says what BASS examines, not that the tests were run in microgravity. Same rule as the FLEX description-of-data sentence (PSI-69). [...]
- `fuel_phase` (1): 'BASS Requirement' column of the requirements table, row 'Configuration' (planning document, February 2010). Note for the auditor: SRD page 4, Figure 1 labels the sample 'Solid fuel or wax-impregnated “wick”', and the test matrix [...]
- `flow_configuration` (1): Investigation-level statement that both configurations were used; it does not say which test used which, so this value does not hold for every test. [...]
- `flow_configuration` (1): Same sentence as R10: both configurations were used; it does not say which test used which. Per-test directions for the fabric tests are in Table I of the 2013 paper (paragraphs 79-142, paper numbering).
- `flow_velocity` (1): Upper bound only ('as high as'); the sentence gives no lower bound. Agrees with the 40 cm/s maximum in R14; disagrees with the 5 to 50 cm/s of the planning SRD (R15). [...]

Ground (1 g) data check: `none` in the ground-test inventory (see the article on the ground inventory).

Published papers listed for this investigation: 10 (see `data/manifest/publications.csv`).

## For engineers
- `method`: 363 `table` records (read by code from a PSI table; the quote is the column header) and 24 `document` records (verbatim sentence with its page or section). `verified` status: 0 (no person has compared records with the source yet).
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-26/Science Documents/PSI-26_Science Documents_As Run_Test Matrix.xlsx` (242 records)
  - `psi-data/PSI-26/Experimental table/PSI-26_Experimental table_BASS.csv` (121 records)
  - `psi-data/PSI-26/Science Documents/PSI-26_Science Documents_FlammabilityAspectsofFabric_USNationalCombustion.2013.docx` (12 records)
  - `psi-data/PSI-26/_investigation/PSI-26.json` (6 records)
  - `psi-data/PSI-26/Science Documents/PSI-26_Science Documents_SRD_BASS.pdf` (4 records)
  - `psi-data/PSI-26/Science Documents/PSI-26_Science Documents_DLD_BASS.pdf` (1 records)
- Every value is located in its source by code; see the articles on how values are located and on validation severities.
- Investigation record: `data/raw/psi-data/PSI-26/_investigation/PSI-26.json` (the text fields quoted above).
- Accession `PSI-26`; DOI `10.60555/58h4-dy80`; PSI version 4; files in version 210, files selected for PYRION 37.
