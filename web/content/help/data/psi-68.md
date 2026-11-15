---
id: ds-psi-68
title: PSI-68 FLEX-2: Flame Extinguishment Experiment - 2
chapter: data
order: 112
keywords: PSI-68, FLEX-2, psi, investigation, doi, license, extracted, conditions
link: /data
page: data
dataHelp:
sources: doi:10.60555/byp8-h018, psi-data/PSI-68/_investigation/PSI-68.json section=objective, psi-data/PSI-68/Experimental table/PSI-68_Experimental table_Flex2.csv, psi-data/PSI-68/_investigation/PSI-68.json, psi-data/PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf
---
PSI-68 FLEX-2 is a NASA microgravity investigation in the PSI (Physical Sciences Informatics) archive: “Flame Extinguishment Experiment - 2”. Release 30-Sep-2019, version 6. DOI [10.60555/byp8-h018](https://doi.org/10.60555/byp8-h018). License: CC0-1.0.

In plain words: this topic explains PSI-68, its cited sources and extraction limits. The [investigation sheet](/investigations/PSI-68) and [Data page](/data) provide the current records, statuses and coverage.

## What it studied
PSI objective (quoted, section `objective`):

> The primary goal of the FLEX-2 flight experiments is to extend the results of FLEX-1 to fuels and environmental conditions that mimic real combustor conditions, as well as, provide benchmark experimental data on bi-component droplet combustion over a wide range of initial conditions in order to validate numerical simulations and to develop new theoretical models. Detailed experimental objectives can be further itemized as: 1. Investigate the role of liquid-phase mixing on the burning characteristics of bi-component fuel droplets. 2. Examine the steady and unsteady liquid and gas-phase phenomena in pure fuel combustion. 3. [...]

PSI hypothesis (quoted, section `hypothesis`):

> Fairly sophisticated numerical simulations of convective droplet combustion have been developed in the last decade where the key contribution is the inclusion of full Navier-Stokes equations for the gas-phase flow field. However, due to the inherent complexity of the problem, varying degrees of approximations have been made in treating the chemistry, radiation, and the coupling between the gas and liquid phases. The validity of the assumptions or the hypothesis used in these simulation have not been confirmed by using benchmark data. [...]

As recorded by PSI: flight program: International Space Station (ISS); hardware: Combustion Integrated Rack (CIR), Multi-user Droplet Combustion Appartatus (MDCA); managing center: Glenn Research Center (GRC).

## Platform and gravity, as stated
- Platform: **Combustion Integrated Rack (CIR)** (quote: “Combustion Integrated Rack (CIR), Multi-user Droplet Combustion Appartatus (MDCA)”, `section=experimentHardware`).
- Platform: **International Space Station (ISS)** (quote: “FLEX-2 (The Flame Extinguishment - 2) experiment is the second experiment to fly on the ISS which uses small droplets of fuel to study the special spherical characteristics of burning fuel droplets in space.”, `paragraph=1`).
- Platform: **Multi-user Droplet Combustion Appartatus (MDCA)** (quote: “Combustion Integrated Rack (CIR), Multi-user Droplet Combustion Appartatus (MDCA)”, `section=experimentHardware`).
- Gravity regime: **microgravity** for test(s) `*` (quote: “4. Allow the droplet to stabilize in the microgravity environment.”, `section=approach`, PSI-68.json).

## Fuel and flame configuration
fuel phase: liquid; diluent: N2, He; fuel descriptions: IsoOctane (pure), n-Octane (pure), Heptane (pure), Decane (pure), Ethanol (pure), Propanol (95%) Glycerol (5%) (mixture), Heptane (50%) IsoOctane (50%) (mixture), Propanol (80%) Glycerol (20%) (mixture).

## What was extracted

The [live investigation sheet](/investigations/PSI-68) shows the extracted variables, test identifiers, condition ranges and recorded outcomes. The [Data page](/data) reports the current record counts. These can change when extraction or validation changes.

Read each value's source and status. Records flagged as insufficient evidence are not usable evidence; rejected rows are separate from accepted records. A raw download row count does not establish how many records the engine can use.

## What could not be extracted, and why
Records kept as `insufficient_evidence` carry their reason in the `note` field. The most common ones:

- `gravity_regime`: The sentence sits in the PSI 'hypothesis' field and gives the rationale for microgravity, so it is proposed as ambiguous (brief rule 3). The double space after 'processes,' and the run-on ending are as written in the record.
- `fuel_phase`: Pre-flight requirement ('shall') in SRD 5.1.1 Test Fuels (printed page 33), dated March 15, 2010; 'all liquids' are the planned test fuels by context. Planned, not as-run: the PSI experimental table lists fuels the SRD does not.
- `fuel_phase`: Objective statement in the pre-flight SRD introduction (printed page 1), not a description of the tests run; '[...]' skips 'fundamental', hyphenated across a line break.

Ground (1 g) data check: `requirements_only` in the ground-test inventory (see the article on the ground inventory).

Publications are listed on the [investigation sheet](/investigations/PSI-68) with their identifiers and sources.

## For engineers
- `method` distinguishes table cells from document quotations. The live download supplies each record's method and status; an extracted status does not imply independent scientific verification.
- Source files used (path under `data/raw/`):
  - `psi-data/PSI-68/Experimental table/PSI-68_Experimental table_Flex2.csv`
  - `psi-data/PSI-68/_investigation/PSI-68.json`
  - `psi-data/PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf`
  - `psi-data/PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 DoD.docx`
- Each record identifies its source. See the Data and Proof pages for how many values the checker located and which formats it could not check.
- Investigation record: `data/raw/psi-data/PSI-68/_investigation/PSI-68.json` (the text fields quoted above).
- Accession `PSI-68`; DOI `10.60555/byp8-h018`; PSI version 6.
