---
id: term-doi
title: "DOI"
keywords: doi, digital object identifier, citation, dataset link, ntrs no doi
chapter: 11
order: 8
dataHelp: [result-doi, route-doi, comparable-doi]
sources: ["data/manifest/investigations.csv"]
---

A DOI is a persistent identifier for a published research object, such as a dataset, paper or report. PYRION shows the PSI dataset DOI with investigation results. NASA technical reports may also have DOIs; where no DOI is supplied, cite the NTRS record number or the source URL.

## For engineers

Stored in `data/manifest/investigations.csv` (`doi` column) and passed to the engine as a catalog; `NASA_STD_6001B.doi` is `null` on purpose.
