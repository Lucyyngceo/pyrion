---
id: ds-psi-25
title: PSI-25 BASS-II: Burning and Suppression of Solids - II
chapter: data
order: 106
keywords: PSI-25, BASS-II, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/4qc4-de67, psi-data/PSI-25/_investigation/PSI-25.json section=objective, psi-data/PSI-25/Experimental table/PSI-25_Experimental table_BASS-II.csv, psi-data/PSI-25/_investigation/PSI-25.json, psi-data/PSI-25/Science Documents/PSI-25_Science Documents_BASS-II_SRD.pdf
---
PSI-25 BASS-II is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Burning and Suppression of Solids - II”. Release 31-Dec-2022, version 4. DOI [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67). License: CC0-1.0.

In plain words: this topic explains PSI-25, its cited sources and extraction limits. The [investigation sheet](/investigations/PSI-25) and [Data page](/data) provide the current records, statuses and coverage.

## What it studied
PSI objective (quoted, section `objective`):

> BASS-II results contribute to the combustion computational models used in the design of fire detection and suppression systems in microgravity and on Earth. Objectives Include: 1) Study the ignition, flame growth, flame spread, and extinction limits for solid fuels burning in low-velocity forced flows in microgravity. 2) Begin to bridge the gap between the normal gravity NASA-STD-6001 Test #1 method, ground-based microgravity tests, and actual material flammability in microgravity. 3) Provide SoFIE PIs with preliminary data to refine Science Requirements. [...]

PSI hypothesis (quoted, section `hypothesis`):

> BASS–II tests the hypothesis that materials in microgravity, with adequate ventilation, burn as well if not better than the same material in normal gravity with other conditions being identical (pressure, O2 concentration, temperature, etc.). NASA tests and controls materials from a flammability perspective using an upward burning test in normal gravity, which is considered to be the worst-case geometry for flammability of the material on Earth. However, it may not be conservative for flammability in space. Testing at constant O2 mole fractions permits studying flame spread and extinction at low and high flow speed. [...]

As recorded by PSI: flight program: International Space Station (ISS); hardware: Microgravity Science Glovebox (MSG); managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **International Space Station (ISS)** (quote: “International Space Station (ISS)”, `section=flightProgram`).
- Platform: **Microgravity Science Glovebox (MSG)** (quote: “Microgravity Science Glovebox (MSG)”, `section=experimentHardware`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “To summarize, BASS-II's approach, microgravity combustion tests were performed aboard the International Space Station.”, `section=approach`, PSI-25.json).
- Gravity regime: **normal_gravity** for test(s) `1-g downward PMMA sheet series (SDSU Flame Stabilizer, Summary Report section 2.3.5, condition stated once for the series)` (quote: “PMMA (NASA and Astra) in 1g at San Diego State University”, `page=49`, PSI-25_Reports_BASS-II Summary Report.pdf).

## Fuel and flame configuration
The live PSI-25 sheet lists fuel phase, material, diluent and flow configuration wherever the extracted records state them. Read each test's source and status; a value flagged as insufficient is not counted as usable evidence.

## What was extracted

The [live investigation sheet](/investigations/PSI-25) shows the extracted variables, test identifiers, condition ranges and recorded outcomes. The [Data page](/data) reports the current record counts. These can change when extraction or validation changes.

Read each value's source and status. Records flagged as insufficient evidence are not usable evidence; rejected rows are separate from accepted records. A raw download row count does not establish how many records the engine can use.

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `flow_velocity`: display reading series during the test, not a test condition
- `pressure`: Figure 2.20 caption text (section 2.3.7, printed page 41), not a value read from the image. NOMINAL condition: one set of conditions is written for all four panels. test_id: the caption writes 'B03'; [...]
- `pressure`: MEASURED (monitored) total pressure, section 2.3.5 'Microgravity and Normal-Gravity Experiments', in the paragraph describing the BASS-II opposed-flow duct in the ISS (preceding sentences on the same page describe the O2 sensor [...]
- `outcome:o2_mole_fraction_after_test`: as written in PSI
- `sample_thickness`: the description states two different thicknesses: 3 mm thick, 2 cm thick

Table cells that hold no readable number (listed in `extraction/skipped_cells.csv`):
- Column `Calibrated final O2 % by vol`: some cells have no usable numeric value; see `extraction/skipped_cells.csv` for the source text.
Ground (1 g) data check: `partial` in the ground-test inventory (see the article on the ground inventory).

Publications are listed on the [investigation sheet](/investigations/PSI-25) with their identifiers and sources.

## For engineers

Use the live download for the current record-status counts. Source files named in that snapshot (paths under `data/raw/`):

- `psi-data/PSI-25/Experimental table/PSI-25_Experimental table_BASS-II.csv`
- `psi-data/PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf`
- `psi-data/PSI-25/Science Documents/PSI-25_Science Documents_BASS-II_ReadMe.docx`
- `psi-data/PSI-25/Science Documents/PSI-25_Science Documents_BASS-II_SRD.pdf`
- `psi-data/PSI-25/_investigation/PSI-25.json`

The source record is `data/raw/psi-data/PSI-25/_investigation/PSI-25.json`. The receipt of each value identifies its source and location. A located quotation is not a scientific validation.
