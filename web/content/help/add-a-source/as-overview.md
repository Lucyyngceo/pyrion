---
id: as-overview
title: Add a source: what it will do and what exists today
chapter: add-a-source
order: 110
keywords: add a source, add source, overview, new evidence, ntrs, external evidence, next build, today, design
link: /envelope
page: global
dataHelp:
sources: pyrion-ops/FASE-3-ADD-SOURCE.md
---
“Add a source” is the feature that lets a visitor bring one new NASA document into PYRION and see exactly how every scenario changes. Its rule is that no value gets in unless code can find it in the source, the same rule that holds for the 10077 records already in the app.

In plain words: an AI may read the document and propose values, but it cannot make a value count. A program checks each proposed value against the document, and anything it cannot find is rejected with the reason shown.

## What works today, and what does not

| | Status |
|---|---|
| The “+ Add a source” button and the dialog, on the Envelope and Data pages | **Working today** |
| The NTRS number field and the file chooser (CSV, Excel or PDF up to 20 MB) that check what you type or pick | **Working today** |
| The strip of steps that will run | **Working today** (display only) |
| The submit button | Disabled: **in the next build** |
| Reading, extracting, verifying, locating by code, classifying, recalculating | **In the next build** |
| The recorded run on LUCI, the external-evidence switch, before and after per scenario | **In the next build** |
| The precision exam on the LUCI golden set | **In the next build** (the golden set itself exists today) |

Nothing is added to the evidence yet. Everything below the first two rows describes the design, not a working feature.

## For engineers

- Design document: `FASE-3-ADD-SOURCE.md`, section “Corrección tras la auditoría independiente” (the corrected design).
- The hook in the web code is `addSource()`; the dialog is wired to it and the submit is disabled until the pipeline exists.
- The golden set and the validator changes it needed are in place: `data/external/ntrs-20250010653/` and `--conditions` in both validators.
