---
id: ds-psi-69
title: PSI-69 FLEX: Flame Extinguishment Experiment
chapter: data
order: 113
keywords: PSI-69, FLEX, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/mbq8-0451, psi-data/PSI-69/_investigation/PSI-69.json section=objective, psi-data/PSI-69/Experimental table/PSI-69_Experimental table_FLEX.csv, psi-data/PSI-69/_investigation/PSI-69.json, psi-data/PSI-69/Science Documents/PSI-69_Science Documents_FLEX DoD.docx
---
PSI-69 FLEX is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Flame Extinguishment Experiment”. Release 31-Jul-2016, version 5. DOI [10.60555/mbq8-0451](https://doi.org/10.60555/mbq8-0451). License: CC0-1.0.

In plain words: this topic explains PSI-69, its cited sources and extraction limits. The [investigation sheet](/investigations/PSI-69) and [Data page](/data) provide the current records, statuses and coverage.

## What it studied
PSI objective (quoted, section `objective`):

> The FLEX (Flame Extinguishment Experiment) investigation aims to map the flammability limits of liquid fuels in microgravity environments, measure the effectiveness of various gaseous fire suppressants such as CO2, He, and SF6, and develop reliable predictive models for combustion limits under reduced gravity conditions. The mission seeks to validate and improve simplified models by incorporating detailed chemical reactions, heat transfer, and material movement, using both space-based data and extensive ground-based tests. [...]

PSI hypothesis (quoted, section `hypothesis`):

> The primary hypothesis of the FLEX mission is that microgravity conditions fundamentally alter the combustion and extinction characteristics of liquid fuel droplets due to changes in species and energy transport dynamics, radiative heat loss, and chemical kinetics. Specifically, the hypothesis posits that the lack of buoyant convection in microgravity will lead to significant differences in the flammability limits and suppression efficacy of various fire suppressant agents compared to normal gravity conditions. [...]

As recorded by PSI: flight program: International Space Station (ISS); hardware: Combustion Integrated Rack (CIR)-Fluids and Combustion Facility (FCF), Multi-user Droplet Combustion Appartatus (MDCA); managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Combustion Integrated Rack (CIR)-Fluids and Combustion Facility (FCF)** (quote: “Combustion Integrated Rack (CIR)-Fluids and Combustion Facility (FCF), Multi-user Droplet Combustion Appartatus (MDCA)”, `section=experimentHardware`).
- Platform: **International Space Station (ISS)** (quote: “International Space Station (ISS)”, `section=flightProgram`).
- Platform: **Multi-user Droplet Combustion Appartatus (MDCA)** (quote: “Combustion Integrated Rack (CIR)-Fluids and Combustion Facility (FCF), Multi-user Droplet Combustion Appartatus (MDCA)”, `section=experimentHardware`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “FLEX and the follow-on FLEX–2 experiments are exploiting the microgravity environment to study the spherically symmetric combustion of liquid droplets.”, `page=36`, np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf).
- Gravity regime: **microgravity** for test(s) `*` (quote: “FLEX series of experiments showed for the first time that quasi-steady stable flames can be established surrounding a droplet in microgravity under certain conditions”, `page=3`, PSI-39_Reports_CFI Science Final Report.pdf).

## Fuel and flame configuration
fuel phase: liquid; diluent: mixed, N2; fuel descriptions: Methanol, Heptane.

## What was extracted

The [live investigation sheet](/investigations/PSI-69) shows the extracted variables, test identifiers, condition ranges and recorded outcomes. The [Data page](/data) reports the current record counts. These can change when extraction or validation changes.

Read each value's source and status. Records flagged as insufficient evidence are not usable evidence; rejected rows are separate from accepted records. A raw download row count does not establish how many records the engine can use.

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `outcome:burning_rate`: header gives the unit 'mm', which is not a unit of burning rate
- `pressure`: mmHg x 101.325/760
- `gravity_regime`: Objective statement ('aims to'), not a statement that the tests were run in microgravity (brief rule 3). No g-level stated. 'reduced gravity conditions' in the same sentence refers to the predictive models; [...]
- `gravity_regime`: Scope sentence of the Description of Data: says what FLEX investigates, not that the tests were run in microgravity. No g-level stated. Grammar ('quantify') as in the source.
- `gravity_regime`: Facility-purpose sentence about the MDCA, not about FLEX tests. Sentence spans three PDF lines, joined with one space. [...]

Table cells that hold no readable number (listed in `extraction/skipped_cells.csv`):
- Column `Droplet initial diameter; mm`: some cells have no usable numeric value; see `extraction/skipped_cells.csv` for the source text.
- Column `Visible flame extinction diameter; mm`: some cells have no usable numeric value; see `extraction/skipped_cells.csv` for the source text.
Ground (1 g) data check: `requirements_only` in the ground-test inventory (see the article on the ground inventory).

Publications are listed on the [investigation sheet](/investigations/PSI-69) with their identifiers and sources.

## For engineers
- `method` distinguishes table cells from document quotations. The live download supplies each record's method and status; an extracted status does not imply independent scientific verification.
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-69/Experimental table/PSI-69_Experimental table_FLEX.csv`
  - `psi-data/PSI-69/_investigation/PSI-69.json`
  - `psi-data/PSI-69/Science Documents/PSI-69_Science Documents_FLEX DoD.docx`
  - `psi-data/PSI-69/Engineering Documents/PSI-69_Engineering Documents_FLEX Engineering Requirements Document.pdf`
  - `nasa/iss-combustion-guide-2015/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf`
  - `psi-data/PSI-39/Reports/PSI-39_Reports_CFI Science Final Report.pdf`
- Each record identifies its source. See the Data and Proof pages for how many values the checker located and which formats it could not check.
- Investigation record: `data/raw/psi-data/PSI-69/_investigation/PSI-69.json` (the text fields quoted above).
- Accession `PSI-69`; DOI `10.60555/mbq8-0451`; PSI version 5.
