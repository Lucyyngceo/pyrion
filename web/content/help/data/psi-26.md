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

In plain words: this topic explains PSI-26, its cited sources and extraction limits. The [investigation sheet](/investigations/PSI-26) and [Data page](/data) provide the current records, statuses and coverage.

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
The live PSI-26 sheet lists fuel phase, material, diluent and flow configuration wherever the extracted records state them. Read each test's source and status; a value flagged as insufficient is not counted as usable evidence.

## What was extracted

The [live investigation sheet](/investigations/PSI-26) shows the extracted variables, test identifiers, condition ranges and recorded outcomes. The [Data page](/data) reports the current record counts. These can change when extraction or validation changes.

Read each value's source and status. Records flagged as insufficient evidence are not usable evidence; rejected rows are separate from accepted records. A raw download row count does not establish how many records the engine can use.

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `gravity_regime`: Scope sentence of the PSI Data Layout Document: says what BASS examines, not that the tests were run in microgravity. Same rule as the FLEX description-of-data sentence (PSI-69). [...]
- `fuel_phase`: 'BASS Requirement' column of the requirements table, row 'Configuration' (planning document, February 2010). Note for the auditor: SRD page 4, Figure 1 labels the sample 'Solid fuel or wax-impregnated “wick”', and the test matrix [...]
- `flow_configuration`: Investigation-level statement that both configurations were used; it does not say which test used which, so this value does not hold for every test. [...]
- `flow_configuration`: Same sentence as R10: both configurations were used; it does not say which test used which. Per-test directions for the fabric tests are in Table I of the 2013 paper (paragraphs 79-142, paper numbering).
- `flow_velocity`: Upper bound only ('as high as'); the sentence gives no lower bound. Agrees with the 40 cm/s maximum in R14; disagrees with the 5 to 50 cm/s of the planning SRD (R15). [...]

Ground (1 g) data check: `none` in the ground-test inventory (see the article on the ground inventory).

Publications are listed on the [investigation sheet](/investigations/PSI-26) with their identifiers and sources.

## For engineers

Use the live download for the current record-status counts. Source files named in that snapshot (paths under `data/raw/`):

- `nasa/iss-combustion-guide-2015/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf`
- `psi-data/PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf`
- `psi-data/PSI-26/Experimental table/PSI-26_Experimental table_BASS.csv`
- `psi-data/PSI-26/Presentations/PSI-26_Presentations_BASS_Overview of Recent ISS Results.pdf`
- `psi-data/PSI-26/Science Documents/PSI-26_Science Documents_As Run_Test Matrix.xlsx`
- `psi-data/PSI-26/Science Documents/PSI-26_Science Documents_DLD_BASS.pdf`
- `psi-data/PSI-26/Science Documents/PSI-26_Science Documents_FlammabilityAspectsofFabric_USNationalCombustion.2013.docx`
- `psi-data/PSI-26/Science Documents/PSI-26_Science Documents_SRD_BASS.pdf`
- `psi-data/PSI-26/_investigation/PSI-26.json`

The source record is `data/raw/psi-data/PSI-26/_investigation/PSI-26.json`. The receipt of each value identifies its source and location. A located quotation is not a scientific validation.
