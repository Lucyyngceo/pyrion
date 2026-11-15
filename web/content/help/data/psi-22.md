---
id: ds-psi-22
title: PSI-22 ACME E-FIELD Flames: Advanced Combustion via Microgravity Experiments Electric-Field Effects on Laminar [...]
chapter: data
order: 104
keywords: PSI-22, ACME E-FIELD Flames, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/se5a-8c73, psi-data/PSI-22/_investigation/PSI-22.json section=objective, psi-data/PSI-22/Experimental table/PSI-22_Experimental table_ACME E-FIELD Flames.csv, psi-data/PSI-22/Reports/PSI-22_Reports_E-FIELD Flames Final Report.pdf, psi-data/PSI-22/_investigation/PSI-22.json
---
PSI-22 ACME E-FIELD Flames is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Advanced Combustion via Microgravity Experiments Electric-Field Effects on Laminar Diffusion Flames”. Release 15-Apr-2019, version 7. DOI [10.60555/se5a-8c73](https://doi.org/10.60555/se5a-8c73). License: CC0-1.0.

In plain words: this topic explains PSI-22, its cited sources and extraction limits. The [investigation sheet](/investigations/PSI-22) and [Data page](/data) provide the current records, statuses and coverage.

## What it studied
PSI objective (quoted, section `objective`):

> The objective of this investigation is to better understand the relationship between electric field voltage and chemi-ion current, analyze the dynamic response of flames to electric field changes, evaluate soot formation, and characterize stabilized near-limit lifted flames.

PSI hypothesis (quoted, section `hypothesis`):

> The application of electric fields in microgravity environments will significantly influence laminar diffusion flames by enabling precise manipulation of flame stability, soot behavior, and combustion dynamics through ion-driven convection and chemi-ionization processes.

As recorded by PSI: flight program: International Space Station (ISS); hardware: Combustion Integrated Rack (CIR), ACME; managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Combustion Integrated Rack (CIR)** (quote: “All experiments were conducted in the combustion integrated rack (CIR).”, `section=approach`).
- Platform: **International Space Station (ISS)** (quote: “International Space Station (ISS)”, `section=flightProgram`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “The E-FIELD flames experiment investigates how electric fields influence the behavior of laminar diffusion flames in microgravity.”, `section=approach`, PSI-22.json).
- Gravity regime: **microgravity** for test(s) `*` (quote: “Conducting the tests in microgravity allows for great simplifications in the analysis of ion-driven convection and flame interaction, enabling new understanding and the development of less polluting and more efficient combustion technology for use on Earth.”, `page=43`, PSI-22_Reports_E-FIELD Flames Final Report.pdf).

## Fuel and flame configuration
fuel phase: gas; diluent: N2; fuel descriptions: 100% CH4, 100% C2H4, 40% CH4, 30% C2H4.

## What was extracted

The [live investigation sheet](/investigations/PSI-22) shows the extracted variables, test identifiers, condition ranges and recorded outcomes. The [Data page](/data) reports the current record counts. These can change when extraction or validation changes.

Read each value's source and status. Records flagged as insufficient evidence are not usable evidence; rejected rows are separate from accepted records. A raw download row count does not establish how many records the engine can use.

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `diluent`: Plan, not an as-run statement ('will have'). Page 3 says this background is the Executive Summary of the March 2010 Science Requirements Document 'With minor editing'. [...]
- `o2_mole_fraction`: Plan, not an as-run statement ('will have'); basis stated as molar. Same provenance as R11 (2010 SRD Executive Summary reproduced 'With minor editing', page 3; the SRD itself was not in the source list). [...]

Ground (1 g) data check: `partial` in the ground-test inventory (see the article on the ground inventory).

Publications are listed on the [investigation sheet](/investigations/PSI-22) with their identifiers and sources.

## For engineers
- `method` distinguishes table cells from document quotations. The live download supplies each record's method and status; an extracted status does not imply independent scientific verification.
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-22/Experimental table/PSI-22_Experimental table_ACME E-FIELD Flames.csv`
  - `psi-data/PSI-22/Reports/PSI-22_Reports_E-FIELD Flames Final Report.pdf`
  - `psi-data/PSI-22/_investigation/PSI-22.json`
- Each record identifies its source. See the Data and Proof pages for how many values the checker located and which formats it could not check.
- Investigation record: `data/raw/psi-data/PSI-22/_investigation/PSI-22.json` (the text fields quoted above).
- Accession `PSI-22`; DOI `10.60555/se5a-8c73`; PSI version 7.
