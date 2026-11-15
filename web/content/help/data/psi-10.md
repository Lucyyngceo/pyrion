---
id: ds-psi-10
title: PSI-10 ACME/Flame Design: Advanced Combustion via Microgravity Experiments / Flame Design
chapter: data
order: 101
keywords: PSI-10, ACME/Flame Design, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/w4zy-bt45, psi-data/PSI-10/_investigation/PSI-10.json section=objective, psi-data/PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Normal Flame.csv, psi-data/PSI-10/Reports/PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf, psi-data/PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Inverse Flame.csv
---
PSI-10 ACME/Flame Design is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Advanced Combustion via Microgravity Experiments / Flame Design”. Release 20-Nov-2025, version 1. DOI [10.60555/w4zy-bt45](https://doi.org/10.60555/w4zy-bt45). License: not stated on its PSI page or record.

In plain words: this topic explains PSI-10, its cited sources and extraction limits. The [investigation sheet](/investigations/PSI-10) and [Data page](/data) provide the current records, statuses and coverage.

## What it studied
PSI objective (quoted, section `objective`):

> The primary objectives of this flight experiment are: A. Obtain soot-inception limits of quasi-steady normal and inverse spherical diffusion flames as functions of flow rate, Zst, amount of inert (N2 or CO2), and pressure for C2H4 and CH4 flames. Identify the corresponding temperatures in hot regions. Obtain similar limits and temperatures for inverse and normal coflow flames. B. Obtain detailed measurements in quasi-steady normal and inverse spherical diffusion flames for C2H4 and CH4. Determine the effects of flow rate, Zst, amount of N2, and pressure on flame temperature, size, color, and soot volume fraction. [...]

PSI hypothesis (quoted, section `hypothesis`):

> 1. Soot formation requires a region where local C/O ratio and T exceed their critical values, and where strain rate is sufficiently low. 2. Microgravity spherical diffusion flames extinguish when the peak temperature first decreases below 1130 K. 3. Steady-state spherical diffusion flames are possible.

As recorded by PSI: flight program: International Space Station (ISS); hardware: Advanced Combustion via Microgravity Experiments (ACME), Combustion Integrated Rack (CIR), Reconfiguration of Combustion Integrated Rack (CIR); managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Combustion Integrated Rack (CIR)** (quote: “The Flame Design experiment is one of six independent experiments that make up the Advanced Combustion via Microgravity Experiments (ACME) project for which the tests were conducted within the Combustion Integrated Rack [...]”, `page=3`).
- Platform: **International Space Station (ISS)** (quote: “International Space Station (ISS)”, `section=flightProgram`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “The challenges of normal-gravity studies are avoided by performing the tests on the International Space Station (ISS), where the non-buoyant microgravity flames allow the effects of convection direction and flame structure to be independently varied.”, `page=44`, PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf).
- Gravity regime: **microgravity** for test(s) `*` (quote: “In this work, experiments aboard the International Space Station and a transient numerical model are used to investigate the existence of steady-state microgravity spherical diffusion flames. [...]”, `page=25`, PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf).

## Fuel and flame configuration
fuel phase: gas; diluent: N2; flame type: normal, inverse; fuel descriptions: C2H4, ethylene, C3H8.

## What was extracted

The [live investigation sheet](/investigations/PSI-10) shows the extracted variables, test identifiers, condition ranges and recorded outcomes. The [Data page](/data) reports the current record counts. These can change when extraction or validation changes.

Read each value's source and status. Records flagged as insufficient evidence are not usable evidence; rejected rows are separate from accepted records. A raw download row count does not establish how many records the engine can use.

## What could not be extracted, and why
The audited snapshot had no records flagged as insufficient for this investigation. Consult the live sheet for the current statuses.

Table cells that hold no readable number (listed in `extraction/skipped_cells.csv`):
- Column `XO2`: some cells have no usable numeric value; see `extraction/skipped_cells.csv` for the source text.
Ground (1 g) data check: `none` in the ground-test inventory (see the article on the ground inventory).

Publications are listed on the [investigation sheet](/investigations/PSI-10) with their identifiers and sources.

## For engineers
- `method` distinguishes table cells from document quotations. The live download supplies each record's method and status; an extracted status does not imply independent scientific verification.
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Normal Flame.csv`
  - `psi-data/PSI-10/Reports/PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf`
  - `psi-data/PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Inverse Flame.csv`
  - `psi-data/PSI-10/_investigation/PSI-10.json`
- Each record identifies its source. See the Data and Proof pages for how many values the checker located and which formats it could not check.
- Investigation record: `data/raw/psi-data/PSI-10/_investigation/PSI-10.json` (the text fields quoted above).
- Accession `PSI-10`; DOI `10.60555/w4zy-bt45`; PSI version 1.
