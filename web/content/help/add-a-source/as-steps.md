---
id: as-steps
title: The steps, in order
chapter: add-a-source
order: 130
keywords: steps, pipeline, read, extract, verify, validate, classify, recalculate, what changed, add a source
link: /envelope
page: global
dataHelp:
sources: pyrion-ops/FASE-3-ADD-SOURCE.md
---
This topic describes the proposed Add a source feature. Its button and dialog were removed from the live site, and visitors cannot add evidence. The design below is an archived proposal; no release date is confirmed.

In plain words: read the document, let an AI propose records with quotes, let a different AI object, let a program have the last word, label only what the source states, then recalculate every scenario and show what changed.

1. **Source.** An NTRS number. The file’s SHA-256 is stored; title, author and license are shown when the source states them.
2. **Reading.** Text and tables per page, by code (tables of CSV and Excel by code, PDF by the PDF reader). The page and table counts are shown.
3. **Extraction.** A model proposes records in the schema. Each carries the value as written, the original unit, the quote and the page or cell. The model never converts units; the engine does.
4. **Check by a model of another family.** It objects to or approves each record, with a quote.
5. **Validator in code (the last word).** The same checks as `validation/run_all.py`: the quote must appear word for word, or the cell in its row and column; units and ranges must be physically plausible. A record that cannot be located is rejected, with the reason shown.
6. **Classification.** Regime, fuel phase, diluent and flame type are filled **only if the source says so**, with its quote. Otherwise the axis stays “not stated”. Gravity is never inferred.
7. **Recalculation.** The engine recalculates the four cards, the map, the routes, “experiments needed”, the results and the receipts, and shows a before and after per scenario.

Before you accept anything, a table lists every proposed record: value, unit, quote, page, the checker’s verdict and the validator’s verdict. At the end, “What changed” shows the before and after and lets you see it on the map.

## Status

**Planned, not available** The dialog that listed these steps is no longer on the site; nothing runs them.

## For engineers

- Steps 3 and 4 use two different model families so that one model’s habit is not the other’s. Neither decides: step 5 does.
- In the proposed design, CSV and Excel files would be read by code after the visitor maps their columns. PDF extraction would need a model. None of these inputs is available on the live site.
