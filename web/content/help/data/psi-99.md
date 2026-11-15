---
id: ds-psi-99
title: PSI-99 SAFFIRE-II: Spacecraft Fire Experiment-II
chapter: data
order: 115
keywords: PSI-99, SAFFIRE-II, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/2chp-m469, psi-data/PSI-99/_investigation/PSI-99.json section=objective, psi-data/PSI-99/Experimental table/PSI-99_Experimental table_SAFFIRE-2.csv, psi-data/PSI-99/_investigation/PSI-99.json
---
PSI-99 SAFFIRE-II is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Spacecraft Fire Experiment-II”. Release 18-Sep-2024, version 5. DOI [10.60555/2chp-m469](https://doi.org/10.60555/2chp-m469). License: CC0-1.0.

In plain words: this topic explains PSI-99, its cited sources and extraction limits. The [investigation sheet](/investigations/PSI-99) and [Data page](/data) provide the current records, statuses and coverage.

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
fuel phase: solid; diluent: N2; flow configuration: concurrent, opposed; material descriptions: Silicone, Cotton-Fiberglass (SIBAL), PMMA & Nomex, PMMA.

## What was extracted

The [live investigation sheet](/investigations/PSI-99) shows the extracted variables, test identifiers, condition ranges and recorded outcomes. The [Data page](/data) reports the current record counts. These can change when extraction or validation changes.

Read each value's source and status. Records flagged as insufficient evidence are not usable evidence; rejected rows are separate from accepted records. A raw download row count does not establish how many records the engine can use.

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `sample_thickness`: written without a decimal point (0.37 mm or 37 mm?)
- `gravity_regime`: Objective statement, not a statement of the conditions of the completed tests; 'low-gravity' mapped to the controlled value microgravity. [...]
- `gravity_regime`: Objective statement specific to SAFFIRE-II; 'long-duration low-gravity' mapped to microgravity. The 'NASA-STD-6001 Test 1 normal-gravity tests' are the ground reference, not tests reported in PSI-99.
- `gravity_regime`: Research-impact statement about the results; it does not say explicitly that the tests were conducted in microgravity.
- `gravity_regime`: Pre-flight paper (future tense, launches 'all planned for 2016'); the sentence covers Saffire-I, -II and -III together; 'low-gravity' mapped to microgravity.

Table cells that hold no readable number (listed in `extraction/skipped_cells.csv`):
- Column `Burn Time (s)`: some cells have no usable numeric value; see `extraction/skipped_cells.csv` for the source text.
- Column `Samle Thickness`: some cells have no usable numeric value; see `extraction/skipped_cells.csv` for the source text.
Ground (1 g) data check: `partial` in the ground-test inventory (see the article on the ground inventory).

Publications are listed on the [investigation sheet](/investigations/PSI-99) with their identifiers and sources.

## For engineers
- `method` distinguishes table cells from document quotations. The live download supplies each record's method and status; an extracted status does not imply independent scientific verification.
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-99/Experimental table/PSI-99_Experimental table_SAFFIRE-2.csv`
  - `psi-data/PSI-99/_investigation/PSI-99.json`
  - `psi-data/PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE Objectives, Development and Status.pdf`
  - `psi-data/PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE-II Readme.docx`
  - `nasa/ntrs-20180005168/20180005168.pdf`
- Each record identifies its source. See the Data and Proof pages for how many values the checker located and which formats it could not check.
- Investigation record: `data/raw/psi-data/PSI-99/_investigation/PSI-99.json` (the text fields quoted above).
- Accession `PSI-99`; DOI `10.60555/2chp-m469`; PSI version 5.
