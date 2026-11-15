---
id: term-doi
title: DOI
chapter: 11
order: 8
dataHelp: [result-doi, route-doi, comparable-doi]
sources: ["data/manifest/investigations.csv"]
---

A permanent web identifier for a published dataset. Every PSI investigation has one, and PYRION shows it with every result that rests on that investigation. NASA technical reports (NTRS) and NASA standards have no DOI; they are cited by their NTRS number or URL instead.

## For engineers

Stored in `data/manifest/investigations.csv` (`doi` column) and passed to the engine as a catalog; `NASA_STD_6001B.doi` is `null` on purpose.
