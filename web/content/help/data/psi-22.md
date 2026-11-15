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

In plain words: this page says what PSI-22 looked at, what conditions PYRION could read from it (with the place in NASA's files where each one is written), and what it could not read. 29 of its 31 records are usable as evidence.

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
fuel phase: gas (2); diluent: N2 (1); fuel (4 distinct): 100% CH4 (6), 100% C2H4 (6), 40% CH4 (5), 30% C2H4 (4).

## What was extracted
31 condition records in `data/conditions/PSI-22.csv`: 29 usable, 2 marked `insufficient_evidence`. They cover 20 distinct tests (plus 10 records that apply to every test of the investigation).

| Variable | Usable records | Insufficient |
|---|---|---|
| gravity regime | 2 | 0 |
| fuel phase | 2 | 0 |
| diluent | 1 | 1 |
| ambient O2 (mole fraction) | 1 | 1 |
| fuel | 21 | 0 |
| platform | 2 | 0 |

Measured ranges over the usable records:
- ambient O2 (mole fraction): 0.21 to 0.21 (that is 21 to 21 % by volume, arithmetic on the stored fraction)

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `diluent` (1): Plan, not an as-run statement ('will have'). Page 3 says this background is the Executive Summary of the March 2010 Science Requirements Document 'With minor editing'. [...]
- `o2_mole_fraction` (1): Plan, not an as-run statement ('will have'); basis stated as molar. Same provenance as R11 (2010 SRD Executive Summary reproduced 'With minor editing', page 3; the SRD itself was not in the source list). [...]

Ground (1 g) data check: `partial` in the ground-test inventory (see the article on the ground inventory).

Published papers listed for this investigation: 25 (see `data/manifest/publications.csv`).

## For engineers
- `method`: 21 `table` records (read by code from a PSI table; the quote is the column header) and 10 `document` records (verbatim sentence with its page or section). `verified` status: 0 (no person has compared records with the source yet).
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-22/Experimental table/PSI-22_Experimental table_ACME E-FIELD Flames.csv` (21 records)
  - `psi-data/PSI-22/Reports/PSI-22_Reports_E-FIELD Flames Final Report.pdf` (6 records)
  - `psi-data/PSI-22/_investigation/PSI-22.json` (4 records)
- Every value is located in its source by code; see the articles on how values are located and on validation severities.
- Investigation record: `data/raw/psi-data/PSI-22/_investigation/PSI-22.json` (the text fields quoted above).
- Accession `PSI-22`; DOI `10.60555/se5a-8c73`; PSI version 7; files in version 2590, files selected for PYRION 88.
