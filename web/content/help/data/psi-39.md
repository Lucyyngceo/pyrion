---
id: ds-psi-39
title: PSI-39 CFI: Cool Flames Investigation
chapter: data
order: 108
keywords: PSI-39, CFI, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/m6pj-a914, psi-data/PSI-39/_investigation/PSI-39.json section=objective, psi-data/PSI-39/Experimental table/PSI-39_Experimental table_CFI.csv, psi-data/PSI-39/_investigation/PSI-39.json, psi-data/PSI-39/Science Documents/PSI-39_Science Documents_SRD_CFI.pdf
---
PSI-39 CFI is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Cool Flames Investigation”. Release 18-Sep-2024, version 4. DOI [10.60555/m6pj-a914](https://doi.org/10.60555/m6pj-a914). License: CC0-1.0.

In plain words: this page says what PSI-39 looked at, what conditions PYRION could read from it (with the place in NASA's files where each one is written), and what it could not read. 346 of its 357 records are usable as evidence.

## What it studied
PSI objective (quoted, section `objective`):

> The objectives of this investigation are to: 1) Examine the combustion behavior of n-dodecane and mixtures of n-dodecane/iso-dodecane at pressures ranging from 0.25 atm to 5 atm. 2) Analyze the effects of helium dilution on cool flame behavior. 3) Examine the behavior of combustion characteristics. 4) Investigate the relationship between droplet size, pressure, and flame extinction, and (5) understand the consequence of soot formation during cool flame combustion.

PSI hypothesis (quoted, section `hypothesis`):

> Flame combustion of liquid hydrocarbon fuels such as n-dodecane, n-dodecane/iso-dodecane mixtures, and faresane in microgravity can provide insights into low-temperature chemical kinetics, revealing critical parameters like droplet extinction diameters and flame dynamics that are not observable on Earth.

As recorded by PSI: flight program: International Space Station (ISS); hardware: Multi-User Droplet Combustion Apparatus (MDCA), Combustion Integrated Rack (CIR); managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Combustion Integrated Rack (CIR)** (quote: “The Combustion Integrated Rack (CIR) contains the Multi-User Droplet Combustion Apparatus (MDCA) which facilitates the controlled combustion of fuel droplets.”, `section=approach`).
- Platform: **International Space Station (ISS)** (quote: “CFI experiments were conducted onboard the ISS from January 2017 through September 2017.”, `page=4`).
- Platform: **Multi-User Droplet Combustion Apparatus (MDCA)** (quote: “The Combustion Integrated Rack (CIR) contains the Multi-User Droplet Combustion Apparatus (MDCA) which facilitates the controlled combustion of fuel droplets.”, `section=approach`).
- **No usable gravity-regime record.** Gravity is only recorded when a source sentence states it for the tests; the platform is never used for it. The engine reads gravity here as insufficient evidence.

## Fuel and flame configuration
fuel phase: liquid (2); diluent: N2 (69), mixed (14); fuel (3 distinct): [.60]/[.40] C12H26/iso-dodecane (41), [.75]/[.25] C12H26/iso-dodecane (24), C12H26 (22).

## What was extracted
357 condition records in `data/conditions/PSI-39.csv`: 346 usable, 11 marked `insufficient_evidence`. They cover 79 distinct tests (plus 13 records that apply to every test of the investigation).

| Variable | Usable records | Insufficient |
|---|---|---|
| gravity regime | 0 | 3 |
| fuel phase | 2 | 0 |
| diluent | 83 | 0 |
| ambient O2 (mole fraction) | 83 | 4 |
| pressure (kPa) | 87 | 0 |
| ambient temperature (K) | 0 | 1 |
| fuel | 87 | 0 |
| flow configuration | 0 | 3 |
| platform | 4 | 0 |

Measured ranges over the usable records:
- ambient O2 (mole fraction): 0.17 to 0.21 (that is 17 to 21 % by volume, arithmetic on the stored fraction)
- pressure (kPa): 50.6625 to 506.625

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `o2_mole_fraction` (4): header gives no unit
- `gravity_regime` (1): Rationale statement (Final Report section 3b); it implies, but does not state, that the CFI tests were burned in microgravity. 'onboard the ISS' is a platform, not a gravity statement.
- `gravity_regime` (1): Hypothesis field: names microgravity as the intended condition, not as a reported condition of the tests.
- `gravity_regime` (1): Pre-flight objective (SRD dated November 7, 2014, 'proposed experiments'); not a statement about the tests as run.
- `flow_configuration` (1): Pre-flight plan (SRD dated November 7, 2014, section 6.1, 'proposed CFI experiments'); the Final Report (2020) does not restate the flow configuration. 'q quiescent' and 'envrionment' are typos in the source, kept verbatim.

Ground (1 g) data check: `none` in the ground-test inventory (see the article on the ground inventory).

Published papers listed for this investigation: 7 (see `data/manifest/publications.csv`).

## For engineers
- `method`: 344 `table` records (read by code from a PSI table; the quote is the column header) and 13 `document` records (verbatim sentence with its page or section). `verified` status: 0 (no person has compared records with the source yet).
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-39/Experimental table/PSI-39_Experimental table_CFI.csv` (344 records)
  - `psi-data/PSI-39/_investigation/PSI-39.json` (5 records)
  - `psi-data/PSI-39/Science Documents/PSI-39_Science Documents_SRD_CFI.pdf` (5 records)
  - `psi-data/PSI-39/Reports/PSI-39_Reports_CFI Science Final Report.pdf` (3 records)
- Every value is located in its source by code; see the articles on how values are located and on validation severities.
- Investigation record: `data/raw/psi-data/PSI-39/_investigation/PSI-39.json` (the text fields quoted above).
- Accession `PSI-39`; DOI `10.60555/m6pj-a914`; PSI version 4; files in version 2812, files selected for PYRION 41.
