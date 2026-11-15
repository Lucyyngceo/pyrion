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

In plain words: this topic explains PSI-39, its cited sources and extraction limits. The [investigation sheet](/investigations/PSI-39) and [Data page](/data) provide the current records, statuses and coverage.

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
fuel phase: liquid; diluent: N2, mixed; fuel descriptions: [.60]/[.40] C12H26/iso-dodecane, [.75]/[.25] C12H26/iso-dodecane, C12H26.

## What was extracted

The [live investigation sheet](/investigations/PSI-39) shows the extracted variables, test identifiers, condition ranges and recorded outcomes. The [Data page](/data) reports the current record counts. These can change when extraction or validation changes.

Read each value's source and status. Records flagged as insufficient evidence are not usable evidence; rejected rows are separate from accepted records. A raw download row count does not establish how many records the engine can use.

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `o2_mole_fraction`: header gives no unit
- `gravity_regime`: Rationale statement (Final Report section 3b); it implies, but does not state, that the CFI tests were burned in microgravity. 'onboard the ISS' is a platform, not a gravity statement.
- `gravity_regime`: Hypothesis field: names microgravity as the intended condition, not as a reported condition of the tests.
- `gravity_regime`: Pre-flight objective (SRD dated November 7, 2014, 'proposed experiments'); not a statement about the tests as run.
- `flow_configuration`: Pre-flight plan (SRD dated November 7, 2014, section 6.1, 'proposed CFI experiments'); the Final Report (2020) does not restate the flow configuration. 'q quiescent' and 'envrionment' are typos in the source, kept verbatim.

Ground (1 g) data check: `none` in the ground-test inventory (see the article on the ground inventory).

Publications are listed on the [investigation sheet](/investigations/PSI-39) with their identifiers and sources.

## For engineers
- `method` distinguishes table cells from document quotations. The live download supplies each record's method and status; an extracted status does not imply independent scientific verification.
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-39/Experimental table/PSI-39_Experimental table_CFI.csv`
  - `psi-data/PSI-39/_investigation/PSI-39.json`
  - `psi-data/PSI-39/Science Documents/PSI-39_Science Documents_SRD_CFI.pdf`
  - `psi-data/PSI-39/Reports/PSI-39_Reports_CFI Science Final Report.pdf`
- Each record identifies its source. See the Data and Proof pages for how many values the checker located and which formats it could not check.
- Investigation record: `data/raw/psi-data/PSI-39/_investigation/PSI-39.json` (the text fields quoted above).
- Accession `PSI-39`; DOI `10.60555/m6pj-a914`; PSI version 4.
