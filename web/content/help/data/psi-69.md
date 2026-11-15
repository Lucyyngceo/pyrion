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

In plain words: this page says what PSI-69 looked at, what conditions PYRION could read from it (with the place in NASA's files where each one is written), and what it could not read. 2096 of its 2358 records are usable as evidence.

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
fuel phase: liquid (1); diluent: mixed (173), N2 (95); fuel (2 distinct): Methanol (157), Heptane (117).

## What was extracted
2358 condition records in `data/conditions/PSI-69.csv`: 2096 usable, 262 marked `insufficient_evidence`. They cover 274 distinct tests (plus 9 records that apply to every test of the investigation).

| Variable | Usable records | Insufficient |
|---|---|---|
| gravity regime | 2 | 3 |
| fuel phase | 1 | 0 |
| diluent | 268 | 0 |
| ambient O2 (mole fraction) | 274 | 0 |
| pressure (kPa) | 273 | 1 |
| initial droplet diameter (mm) | 262 | 0 |
| fuel | 274 | 0 |
| platform | 3 | 0 |
| outcomes (measured results) | 739 | 258 |

Measured ranges over the usable records:
- ambient O2 (mole fraction): 0.12 to 0.34 (that is 12 to 34 % by volume, arithmetic on the stored fraction)
- pressure (kPa): 70.1676 to 309.295
- initial droplet diameter (mm): 1.1 to 4.67

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `outcome:burning_rate` (258): header gives the unit 'mm', which is not a unit of burning rate
- `pressure` (1): mmHg x 101.325/760
- `gravity_regime` (1): Objective statement ('aims to'), not a statement that the tests were run in microgravity (brief rule 3). No g-level stated. 'reduced gravity conditions' in the same sentence refers to the predictive models; [...]
- `gravity_regime` (1): Scope sentence of the Description of Data: says what FLEX investigates, not that the tests were run in microgravity. No g-level stated. Grammar ('quantify') as in the source.
- `gravity_regime` (1): Facility-purpose sentence about the MDCA, not about FLEX tests. Sentence spans three PDF lines, joined with one space. [...]

Table cells that hold no readable number (listed in `extraction/skipped_cells.csv`):
- column `Droplet initial diameter; mm`: 6 cells (cell marks 'no value')
- column `Visible flame extinction diameter; mm`: 28 cells (cell marks 'no value')

Ground (1 g) data check: `requirements_only` in the ground-test inventory (see the article on the ground inventory).

Published papers listed for this investigation: 51 (see `data/manifest/publications.csv`).

## For engineers
- `method`: 2349 `table` records (read by code from a PSI table; the quote is the column header) and 9 `document` records (verbatim sentence with its page or section). `verified` status: 0 (no person has compared records with the source yet).
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-69/Experimental table/PSI-69_Experimental table_FLEX.csv` (2349 records)
  - `psi-data/PSI-69/_investigation/PSI-69.json` (5 records)
  - `psi-data/PSI-69/Science Documents/PSI-69_Science Documents_FLEX DoD.docx` (1 records)
  - `psi-data/PSI-69/Engineering Documents/PSI-69_Engineering Documents_FLEX Engineering Requirements Document.pdf` (1 records)
  - `nasa/iss-combustion-guide-2015/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf` (1 records)
  - `psi-data/PSI-39/Reports/PSI-39_Reports_CFI Science Final Report.pdf` (1 records)
- Every value is located in its source by code; see the articles on how values are located and on validation severities.
- Investigation record: `data/raw/psi-data/PSI-69/_investigation/PSI-69.json` (the text fields quoted above).
- Accession `PSI-69`; DOI `10.60555/mbq8-0451`; PSI version 5; files in version 6555, files selected for PYRION 131.
