---
id: as-external-evidence
title: Added evidence is external, and looks it
chapter: add-a-source
order: 150
keywords: external evidence, labelled, toggle, per visitor, browser, export, csv, json, luci, partial gravity, rotating vehicle, not applicable
link: /envelope
page: global
dataHelp:
sources: pyrion-ops/FASE-3-ADD-SOURCE.md, nasa/ntrs-20250010653/ASGSR 2025-LUCI-Ferkul-Presentation-v2-20250010653.pdf
---
Evidence you add is **external**: it is never mixed silently with the curated PSI base.

In plain words: added evidence has its own colour or mark on the map, its own label on the cards and a switch, “show added evidence”, so you can see the app with and without it.

- **Per visitor.** What you add changes only your view. It lives in your browser and the engine recalculates there.
- **You can take it with you.** The added records can be exported as CSV plus JSON with their receipts. A button will explain how to propose them to the repository as a pull request on GitHub.
- **Limits.** A maximum number of pages per source, a cap per visitor and per day, and the extraction model has the same budget as the rest of the app.

## The example: LUCI

LUCI is the first external source and the exam case. Its lunar gravity is **simulated partial gravity from a rotating vehicle**, and every screen says so. In the planned video, the lunar-gravity card changes from “none in PSI” to “1 external flight with simulated gravity, far from your condition”. It is **never shown as applicable unless the engine says so**.

## Status

**In the next build.** The first version is planned as: an NTRS number box with LUCI as a **recorded run** of the process, labelled as recorded, with a receipt per record; the external-evidence switch and before-and-after per scenario; CSV and Excel upload with hand-mapped columns and no model; and live PDF extraction only behind an “experimental” option if time allows.

## For engineers

- Golden data: `data/external/ntrs-20250010653/conditions.csv` with accession `NTRS-20250010653`; the citation check requires the id in `data/manifest/external_sources.json`.
- A cache by SHA-256 makes the LUCI demo cost nothing and avoids model rate limits; a global daily cap works as a switch.
