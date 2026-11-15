---
id: ds-ground-inventory
title: The ground (1 g) test inventory
chapter: data
order: 203
keywords: ground, 1 g, normal gravity, inventory, terrestrial, psi-107, spice, dotson, ground tests, 1g
link: /data
page: data
dataHelp:
sources: extraction/ground_tests_inventory.md, psi-data/PSI-107
---
The ground (1 g) inventory answers one question: what normal-gravity test data are inside the NASA PSI files PYRION downloaded?

In plain words: PYRION compares flames in microgravity with flames on Earth, so it matters whether PSI contains ground tests with their oxygen and pressure. It almost never does. Of the 24 investigations, **only one has a clean per-test 1 g table: PSI-107 (SPICE)**, in Tables 6.3 and 6.4 of a thesis (fuel, nozzle, coflow velocity, fuel flow and smoke height). Its oxygen and pressure are not tabulated; ambient air is implied. **No investigation offers ground tests with both O2 and pressure per test in a table.**

## The rules used

- A ground test is a normal-gravity test on Earth. Drop towers, parabolic flights, KC-135 aircraft and microgravity wind tunnels are **not** ground: they are microgravity or partial gravity.
- Requirements and planning documents that only say ground testing is planned are not test data.
- A value that exists only in a figure, or an ambient condition that is implied, is reported as such.

## The classes

Per investigation: `none`, `partial`, `requirements_only`, `not_ground`, `yes_table`. The count in the inventory: none 10, partial 9, requirements_only 2, not_ground 2, yes_table 1.

## What was extracted from it

Nothing automatically. After approval, two stated 1 g conditions were extracted by hand with the usual extractor and verifier: one from PSI-25 (the downward PMMA series at San Diego State University, where the Summary Report gives 101 kPa and 21 % O2 on page 46 and 20.7 % O2 in a figure caption on page 49; the two are kept apart and not averaged) and one from PSI-20. Outside PSI, NTRS 20000004509 (Olson and T’ien) has a normal-gravity PMMA table of about 8 stretch-rate rows, with pressure not stated.

## For engineers

- Full inventory with files, pages and effort: `extraction/ground_tests_inventory.md` (written 2026-11-14 from a scan of every PDF, DOCX, XLSX and CSV under `data/raw/psi-data/`, 1 485 hits in 1 page/paragraph units, then a reading of the substantive documents).
- Ground records carry descriptive test ids (for example a series name), not table rows; the `ground_series` flag in the extraction marks them.
