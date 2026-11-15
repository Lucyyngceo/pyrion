---
id: ds-psi-98
title: PSI-98 SAFFIRE-I: Spacecraft Fire Safety Experiment-I
chapter: data
order: 114
keywords: PSI-98, SAFFIRE-I, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/0t15-1z43, psi-data/PSI-98/_investigation/PSI-98.json section=objective, psi-data/PSI-98/Experimental table/PSI-98_Experimental table_SAFFIRE-1.csv, psi-data/PSI-98/_investigation/PSI-98.json, psi-data/PSI-98/Science Documents/PSI-98_Science Documents_SAFFIRE-I and SAFFIRE-III Readme.docx
---
PSI-98 SAFFIRE-I is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Spacecraft Fire Safety Experiment-I”. Release 18-Sep-2024, version 4. DOI [10.60555/0t15-1z43](https://doi.org/10.60555/0t15-1z43). License: CC0-1.0.

In plain words: this topic explains PSI-98, its cited sources and extraction limits. The [investigation sheet](/investigations/PSI-98) and [Data page](/data) provide the current records, statuses and coverage.

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
fuel phase: solid; diluent: N2; flow configuration: concurrent, opposed; material descriptions: SIBAL Fabric.

## What was extracted

The [live investigation sheet](/investigations/PSI-98) shows the extracted variables, test identifiers, condition ranges and recorded outcomes. The [Data page](/data) reports the current record counts. These can change when extraction or validation changes.

Read each value's source and status. Records flagged as insufficient evidence are not usable evidence; rejected rows are separate from accepted records. A raw download row count does not establish how many records the engine can use.

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `sample_thickness`: cm x 10
- `gravity_regime`: Objective statement, not a statement of the test condition. The JSON field has line breaks after 'to:' and after 'normal', each joined with one space. Source term 'low-gravity'; no g-level stated; [...]
- `gravity_regime`: Objective statement for the SAFFIRE-I and SAFFIRE-III tests, not a statement of the test condition. Source term 'low-gravity'; no g-level stated; mapped to the controlled term microgravity.
- `gravity_regime`: States the purpose of the sample ('to demonstrate ... a large-scale low-gravity fire'), not the measured condition of the burn. Sentence spans two PDF lines ('0.4 m' / 'wide'), joined with one space. Source term 'low-gravity'; [...]
- `gravity_regime`: Research-impact summary, not a statement of the test condition. It speaks of 'several spacecraft materials', while section=approach names one material (Sibal) for Saffire-I, so the sentence may describe the Saffire series rather [...]

Ground (1 g) data check: `none` in the ground-test inventory (see the article on the ground inventory).

Publications are listed on the [investigation sheet](/investigations/PSI-98) with their identifiers and sources.

## For engineers
- `method` distinguishes table cells from document quotations. The live download supplies each record's method and status; an extracted status does not imply independent scientific verification.
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-98/Experimental table/PSI-98_Experimental table_SAFFIRE-1.csv`
  - `psi-data/PSI-98/_investigation/PSI-98.json`
  - `psi-data/PSI-98/Science Documents/PSI-98_Science Documents_SAFFIRE-I and SAFFIRE-III Readme.docx`
  - `psi-data/PSI-98/Engineering Documents/PSI-98_Engineering Documents_SAFFIRE-I Operations.pdf`
  - `nasa/ntrs-20180005168/20180005168.pdf`
- Each record identifies its source. See the Data and Proof pages for how many values the checker located and which formats it could not check.
- Investigation record: `data/raw/psi-data/PSI-98/_investigation/PSI-98.json` (the text fields quoted above).
- Accession `PSI-98`; DOI `10.60555/0t15-1z43`; PSI version 4.
