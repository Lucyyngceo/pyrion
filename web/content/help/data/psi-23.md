---
id: ds-psi-23
title: PSI-23 ACME s-Flame: Advanced Combustion via Microgravity Experiments-Structure and Response of Spherical [...]
chapter: data
order: 105
keywords: PSI-23, ACME s-Flame, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/k57n-p030, psi-data/PSI-23/_investigation/PSI-23.json section=objective, psi-data/PSI-23/Experimental table/PSI-23_Experimental table_ACME s-Flame.csv, psi-data/PSI-23/Reports/PSI-23_Reports_s_Flame_final_report_20210729.pdf, psi-data/PSI-23/_investigation/PSI-23.json
---
PSI-23 ACME s-Flame is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Advanced Combustion via Microgravity Experiments-Structure and Response of Spherical Diffusion Flames”. Release 05-Apr-2018, version 4. DOI [10.60555/k57n-p030](https://doi.org/10.60555/k57n-p030). License: CC0-1.0.

In plain words: this topic explains PSI-23, its cited sources and extraction limits. The [investigation sheet](/investigations/PSI-23) and [Data page](/data) provide the current records, statuses and coverage.

## What it studied
PSI objective (quoted, section `objective`):

> A series of experiments is proposed with the following specific objectives, in both soot-free and sooty flames, to compare with detailed computational simulation to assess transport properties and detailed chemical kinetics (including chemiluminescence): Objective A. Measure and characterize the transient structure (such as temperature and species distribution) of diffusion flames established at initially non-steady, spherical flame structures for mixtures of different H2/CH4/diluent ratios (soot-free) and different C2H4/diluent ratios (sooty), for different flow rates. Objective B. [...]

PSI hypothesis (quoted, section `hypothesis`):

> The transient numerical simulation of spherical flames developed as part of this program includes detailed chemistry and transport models, especially radiation mechanisms. Each description of the flames obtained from the experiment, including measurements of aspects of the flame structure, growth or flame front velocities, and the specific test conditions where steady state flames, flame extinctions, flame front instabilities, soot suppression limits, etc., comprise a rigorous test of the detailed model. Together they provide a measure of the comprehensiveness of the chemical kinetic and transport models. [...]

As recorded by PSI: flight program: International Space Station (ISS); hardware: Combustion Integrated Rack (CIR), ACME; managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Combustion Integrated Rack (CIR)** (quote: “Combustion Integrated Rack (CIR), ACME”, `section=experimentHardware`).
- Platform: **International Space Station (ISS)** (quote: “International Space Station (ISS)”, `section=flightProgram`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “The project has completed two (2) rounds of microgravity experimentation.”, `page=25`, PSI-23_Reports_s_Flame_final_report_20210729.pdf).

## Fuel and flame configuration
fuel phase: gas; diluent: He, N2; fuel descriptions: 50% C2H4 with N2, 100% H2, 45% CH4 with N2, 44.4% H2 with CH4, 66.7% H2 with CH4, 25% H2, 20% CH4, with He, 20% H2, 25% CH4, with He, 30% H2, 15% CH4, with He.

## What was extracted

The [live investigation sheet](/investigations/PSI-23) shows the extracted variables, test identifiers, condition ranges and recorded outcomes. The [Data page](/data) reports the current record counts. These can change when extraction or validation changes.

Read each value's source and status. Records flagged as insufficient evidence are not usable evidence; rejected rows are separate from accepted records. A raw download row count does not establish how many records the engine can use.

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `diluent`: Table 1, Atmosphere column: this cell is merged over test days 19352, 20006, 20013, 20024 and 20029. The PSI table reads differently for four of them: CSV row=6 (20006) '~21% O2 with N3', row=7 (20013) '~21% O2 with N4', row=8 [...]
- `diluent`: 'N3' is not a gas: spreadsheet fill-series artifact
- `fuel`: contains a spreadsheet fill-series artifact (e.g. 'N3')
- `diluent`: 'N4' is not a gas: spreadsheet fill-series artifact
- `diluent`: 'N5' is not a gas: spreadsheet fill-series artifact

Ground (1 g) data check: `none` in the ground-test inventory (see the article on the ground inventory).

Publications are listed on the [investigation sheet](/investigations/PSI-23) with their identifiers and sources.

## For engineers
- `method` distinguishes table cells from document quotations. The live download supplies each record's method and status; an extracted status does not imply independent scientific verification.
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-23/Experimental table/PSI-23_Experimental table_ACME s-Flame.csv`
  - `psi-data/PSI-23/Reports/PSI-23_Reports_s_Flame_final_report_20210729.pdf`
  - `psi-data/PSI-23/_investigation/PSI-23.json`
- Each record identifies its source. See the Data and Proof pages for how many values the checker located and which formats it could not check.
- Investigation record: `data/raw/psi-data/PSI-23/_investigation/PSI-23.json` (the text fields quoted above).
- Accession `PSI-23`; DOI `10.60555/k57n-p030`; PSI version 4.
