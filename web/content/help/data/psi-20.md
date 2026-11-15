---
id: ds-psi-20
title: PSI-20 ACME BRE: Advanced Combustion via Microgravity Experiments - Burning Rate Emulator
chapter: data
order: 102
keywords: PSI-20, ACME BRE, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/vb93-3y72, psi-data/PSI-20/_investigation/PSI-20.json section=objective, psi-data/PSI-20/Reports/PSI-20_Reports_Final_20220201.pdf, psi-data/PSI-20/Experimental table/PSI-20_Experimental table_ACME BRE.csv, psi-data/PSI-20/Reports/PSI-20_Reports_Dissertation-PD-revised_.pdf
---
PSI-20 ACME BRE is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Advanced Combustion via Microgravity Experiments - Burning Rate Emulator”. Release 15-Sep-2022, version 4. DOI [10.60555/vb93-3y72](https://doi.org/10.60555/vb93-3y72). License: CC0-1.0.

In plain words: this topic explains PSI-20, its cited sources and extraction limits. The [investigation sheet](/investigations/PSI-20) and [Data page](/data) provide the current records, statuses and coverage.

## What it studied
PSI objective (quoted, section `objective`):

> The BRE flight program seeks to establish the burning conditions in a quiescent microgravity ambient in terms of material properties. The specific flight objectives are as follows. 1. Observe burning behavior in long-duration microgravity for CH4/N2 and C2H4/N2mixtures on porous circular burners of 25 and 50 mm diameter. Consider O2/N2 ambients with various pressures and ambient O2 concentrations and pressures. NASA - considered atmosphere for human space missions will be examined: 14.7 psia, 21 % oxygen: 10.2 psia, 26.5 %; and 8.2 psia, 34 % oxygen. Emphasize fuel conditions that can be related to a diverse range of condensed fuels. 2. [...]

PSI hypothesis (quoted, section `hypothesis`):

> The BRE investigation hypothesizes that there can exist a regime of quasi-steady burning in microgravity as a function of materials properties. Steady burning may never be achieved, and only slowly changing unsteady flames are possible. The proposed tests aboard the ISS aims to query this hypothesis by establishing a range of quasi-steady burning conditions for condensed fuels in the microgravity environment. It is hypothesized that BRE can determine a range of burning conditions in microgravity as a function of heat of gasification, reradiation heat flux, applied radiant heat flux, heat of combustion and smoke point. [...]

As recorded by PSI: flight program: International Space Station (ISS); hardware: Combustion Integrated Rack (CIR), ACME; managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Combustion Integrated Rack (CIR)** (quote: “The Burning Rate Emulator (BRE) experiment is one of six independent experiments that make up the Advanced Combustion via Microgravity Experiments (ACME) project for which tests are conducted within the Combustion [...]”, `page=3`).
- Platform: **International Space Station (ISS)** (quote: “International Space Station (ISS)”, `section=flightProgram`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “Quasi-steady burning corresponding to various condensed-phase materials (such as PMMA and Nylon) was observed in microgravity despite the absence of air flow, where the cessation of ventilation is an established step in putting out spacecraft fires.”, `section=researchImpacts`, PSI-20.json).
- Gravity regime: **microgravity** for test(s) `*` (quote: “We see this as well in the extended ISS microgravity tests.”, `page=18`, PSI-20_Reports_Final_20220201.pdf).
- Gravity regime: **normal_gravity** for test(s) `1-g BRE series (Auth [55], ground burner), heat of combustion 43.7 kJ/g (dissertation Fig. 5.4 legend, 1-g table row 1)` (quote: “The data measured in 1-g and discussed in [55] is added to the plot for comparison between micro- and normal gravity burning.”, `page=104`, PSI-20_Reports_Dissertation-PD-revised_.pdf).

## Fuel and flame configuration
fuel phase: gas; diluent: N2; fuel descriptions: 100% C2H4, 50% C2H4, 100%C2H4, 100% CH4.

## What was extracted

The [live investigation sheet](/investigations/PSI-20) shows the extracted variables, test identifiers, condition ranges and recorded outcomes. The [Data page](/data) reports the current record counts. These can change when extraction or validation changes.

Read each value's source and status. Records flagged as insufficient evidence are not usable evidence; rejected rows are separate from accepted records. A raw download row count does not establish how many records the engine can use.

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `pressure`: Nominal atmospheres of round 1 (Appendix D, written after round 1 ended). 'especially focused' is not exhaustive: Table 1 (p.24) also lists 40% O2 on 19039, 19056 and 19063, which this sentence does not cover (see R16). [...]
- `pressure`: Read from the legend text inside Figure 14 (Appendix D). Each legend row is SE, FT (plot symbols, missing from the text layer), Xf, XO2, p (bar); the LAST number of each row is p. Distinct p values: 1, 0.56, 0.7 bar. [...]
- `pressure`: confidence ambiguous ('most of' the round-2 tests, not all, and 'roughly'. Known exceptions: 2021-Jan-20 (0.57 bar for five tests, R18) and the p.149 test at roughly 0.6 atm (R20). Day mapping: report day 20261 (17 Sept. [...]
- `o2_mole_fraction`: reads as thousands of percent

Ground (1 g) data check: `partial` in the ground-test inventory (see the article on the ground inventory).

Publications are listed on the [investigation sheet](/investigations/PSI-20) with their identifiers and sources.

## For engineers
- `method` distinguishes table cells from document quotations. The live download supplies each record's method and status; an extracted status does not imply independent scientific verification.
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-20/Reports/PSI-20_Reports_Final_20220201.pdf`
  - `psi-data/PSI-20/Experimental table/PSI-20_Experimental table_ACME BRE.csv`
  - `psi-data/PSI-20/Reports/PSI-20_Reports_Dissertation-PD-revised_.pdf`
  - `psi-data/PSI-20/_investigation/PSI-20.json`
  - `psi-data/PSI-20/Science Documents/PSI-20_Science Documents_BRE_data_interpretation_20220804.pdf`
- Each record identifies its source. See the Data and Proof pages for how many values the checker located and which formats it could not check.
- Investigation record: `data/raw/psi-data/PSI-20/_investigation/PSI-20.json` (the text fields quoted above).
- Accession `PSI-20`; DOI `10.60555/vb93-3y72`; PSI version 4.
