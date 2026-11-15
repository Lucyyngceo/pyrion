---
id: term-accession
title: "Accession (PSI-nn)"
keywords: accession, psi-25, psi number, investigation id, identifier
chapter: 11
order: 1
dataHelp: [result-ref, result-doi]
sources: ["data/manifest/investigations.csv"]
---

The identifier PSI gives each investigation, written like **PSI-25**. Every result in PYRION names the investigation by its accession, so you can find it in the archive. An accession is an identifier, not a number to calculate with.

## For engineers

Format `PSI-<number>`; sorted numerically by `compareAccession` (`engine/src/evidence.ts`). The manifest `data/manifest/investigations.csv` maps accession to acronym, title and DOI (`parseInvestigationCatalog`, `engine/src/experiments.ts`).
