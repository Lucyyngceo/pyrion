---
id: ds-psi-21
title: PSI-21 ACME CLD Flame: Advanced Combustion via Microgravity Experiments / Coflow Laminar Diffusion Flame
chapter: data
order: 103
keywords: PSI-21, ACME CLD Flame, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/23e1-9950, psi-data/PSI-21/_investigation/PSI-21.json section=objective, psi-data/PSI-21/Experimental table/PSI-21_Experimental table_CLD Flame.csv, psi-data/PSI-21/_investigation/PSI-21.json, nasa/glenn-factsheet-acme/advanced-combustion-via-microgravity-experiments-acme.pdf
---
PSI-21 ACME CLD Flame is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Advanced Combustion via Microgravity Experiments / Coflow Laminar Diffusion Flame”. Release 15-Sep-2023, version 4. DOI [10.60555/23e1-9950](https://doi.org/10.60555/23e1-9950). License: CC0-1.0.

In plain words: this topic explains PSI-21, its cited sources and extraction limits. The [investigation sheet](/investigations/PSI-21) and [Data page](/data) provide the current records, statuses and coverage.

## What it studied
PSI objective (quoted, section `objective`):

> In order to provide the experimental data needed to allow rigorous testing of computational models at the extremes of the fuel dilution spectrum, we have the following objectives: A) Characterize the behavior of weak coflow diffusion flames of methane and ethylene, as a function of velocity and fuel dilution, through measurement of flame shape, lift-off heights, temperatures and extinction limits. [...]

PSI hypothesis (quoted, section `hypothesis`):

> This investigation was focused on gathering bench mark data to validate the hypothesis of computation models, the details of which are available within the following publications: 1) Smooke, M.D., Hall, R.J., Colket, M.B., Fielding, J., Long, M.B., McEnally, C.S., and Pfefferle, L.D., Investigation of the transition from lightly sooting towards heavily sooting co-flow ethylene diffusion flames. Combustion Theory and Modelling, 2004. 8(3): p. 593-606. [...]

As recorded by PSI: flight program: International Space Station (ISS); hardware: Combustion Integrated Rack (CIR), ACME; managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Combustion Integrated Rack (CIR)** (quote: “Combustion Integrated Rack (CIR), ACME”, `section=experimentHardware`).
- Platform: **International Space Station (ISS)** (quote: “International Space Station (ISS)”, `section=flightProgram`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “For sooty flames, results show that the absence of gravity can have a major effect. Flames are taller, wider, cooler, and far sootier in microgravity as compared to normal gravity.”, `page=3`, advanced-combustion-via-microgravity-experiments-acme.pdf).
- Gravity regime: **microgravity** for test(s) `*` (quote: “The data has shown that for highly diluted weak flames, microgravity flames are more stable than their normal gravity counterparts.”, `page=4`, advanced-combustion-via-microgravity-experiments-acme.pdf).

## Fuel and flame configuration
fuel phase: gas; flow configuration: coflow; fuel descriptions: 40% CH4, 100% CH4, 100% C2H4, 50% C2H4, 30% C2H4.

## What was extracted

The [live investigation sheet](/investigations/PSI-21) shows the extracted variables, test identifiers, condition ranges and recorded outcomes. The [Data page](/data) reports the current record counts. These can change when extraction or validation changes.

Read each value's source and status. Records flagged as insufficient evidence are not usable evidence; rejected rows are separate from accepted records. A raw download row count does not establish how many records the engine can use.

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `fuel`: formula looks like a spreadsheet fill-series artifact
- `gravity_regime`: A plan ('will be important'), not a statement that the tests were run in microgravity. section=researchImpacts has another goal sentence of the same kind: 'A goal of the study will be to apply sophisticated numerical tools and [...]
- `gravity_regime`: PSI category label for the whole investigation, not a sentence about the test conditions.
- `diluent`: Planned oxidizer coflow (fact sheet p.3, future tense 'will be made ... in an air coflow'): air = oxygen balanced mainly by nitrogen. Oxidizer stream only. [...]

Ground (1 g) data check: `none` in the ground-test inventory (see the article on the ground inventory).

Publications are listed on the [investigation sheet](/investigations/PSI-21) with their identifiers and sources.

## For engineers
- `method` distinguishes table cells from document quotations. The live download supplies each record's method and status; an extracted status does not imply independent scientific verification.
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-21/Experimental table/PSI-21_Experimental table_CLD Flame.csv`
  - `psi-data/PSI-21/_investigation/PSI-21.json`
  - `nasa/glenn-factsheet-acme/advanced-combustion-via-microgravity-experiments-acme.pdf`
- Each record identifies its source. See the Data and Proof pages for how many values the checker located and which formats it could not check.
- Investigation record: `data/raw/psi-data/PSI-21/_investigation/PSI-21.json` (the text fields quoted above).
- Accession `PSI-21`; DOI `10.60555/23e1-9950`; PSI version 4.
