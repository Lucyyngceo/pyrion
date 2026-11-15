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

In plain words: this page says what PSI-21 looked at, what conditions PYRION could read from it (with the place in NASA's files where each one is written), and what it could not read. 13 of its 42 records are usable as evidence.

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
fuel phase: gas (1); flow configuration: coflow (2); fuel (5 distinct): 40% CH4 (2), 100% CH4 (1), 100% C2H4 (1), 50% C2H4 (1), 30% C2H4 (1).

## What was extracted
42 condition records in `data/conditions/PSI-21.csv`: 13 usable, 29 marked `insufficient_evidence`. They cover 32 distinct tests (plus 10 records that apply to every test of the investigation).

| Variable | Usable records | Insufficient |
|---|---|---|
| gravity regime | 2 | 2 |
| fuel phase | 1 | 0 |
| diluent | 0 | 1 |
| fuel | 6 | 26 |
| flow configuration | 2 | 0 |
| platform | 2 | 0 |

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `fuel` (26): formula looks like a spreadsheet fill-series artifact
- `gravity_regime` (1): A plan ('will be important'), not a statement that the tests were run in microgravity. section=researchImpacts has another goal sentence of the same kind: 'A goal of the study will be to apply sophisticated numerical tools and [...]
- `gravity_regime` (1): PSI category label for the whole investigation, not a sentence about the test conditions.
- `diluent` (1): Planned oxidizer coflow (fact sheet p.3, future tense 'will be made ... in an air coflow'): air = oxygen balanced mainly by nitrogen. Oxidizer stream only. [...]

Ground (1 g) data check: `none` in the ground-test inventory (see the article on the ground inventory).

Published papers listed for this investigation: 18 (see `data/manifest/publications.csv`).

## For engineers
- `method`: 32 `table` records (read by code from a PSI table; the quote is the column header) and 10 `document` records (verbatim sentence with its page or section). `verified` status: 0 (no person has compared records with the source yet).
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-21/Experimental table/PSI-21_Experimental table_CLD Flame.csv` (32 records)
  - `psi-data/PSI-21/_investigation/PSI-21.json` (6 records)
  - `nasa/glenn-factsheet-acme/advanced-combustion-via-microgravity-experiments-acme.pdf` (4 records)
- Every value is located in its source by code; see the articles on how values are located and on validation severities.
- Investigation record: `data/raw/psi-data/PSI-21/_investigation/PSI-21.json` (the text fields quoted above).
- Accession `PSI-21`; DOI `10.60555/23e1-9950`; PSI version 4; files in version 4883, files selected for PYRION 2.
