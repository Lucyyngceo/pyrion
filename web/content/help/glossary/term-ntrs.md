---
id: term-ntrs
title: "NTRS"
keywords: ntrs, nasa technical reports server, nasa report, ntrs number, pdf page
chapter: 11
order: 18
dataHelp: [tars-document-link]
sources: ["https://ntrs.nasa.gov"]
---

The NASA Technical Reports Server: where NASA's published papers, presentations and reports live. PYRION cites them by NTRS number (for example NTRS 20260001966) and by PDF page.

## For engineers

NTRS documents have no DOI; the NTRS id is the identifier (`SourceRef.identifier`, `engine/src/presets.ts`). Page numbers are PDF pages, with the printed slide number beside them when the PDF has one (the slide number is the PDF page minus one for NTRS 20260001966).
