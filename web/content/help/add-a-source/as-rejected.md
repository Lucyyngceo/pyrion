---
id: as-rejected
title: What is rejected, and why
chapter: add-a-source
order: 140
keywords: rejected, reject, quote not found, number, figure, plot, gravity, oxygen during burn, ratio, slide table, header, row label
link: /envelope
page: global
dataHelp:
sources: pyrion-ops/FASE-3-ADD-SOURCE.md, data/external/ntrs-20250010653/README.md
---
A proposed record is rejected, with its reason on screen, whenever code cannot place it in the source or the source does not say what the record claims.

In plain words: the program prefers to throw away a true value it cannot prove than to accept a false one.

- **The quote is not in the file, word for word.** Rejected.
- **A number differs from the source.** The numbers of a quote must appear exactly as written: `1.5` is not `15`. A record whose `value_original` is not written in its quote is rejected.
- **The value is only in a figure or an image.** Rejected; nothing is read off a plot.
- **A table value on a slide needs its context.** The slide title, the header and the row label must appear in order on the same page; otherwise the record is kept only as insufficient evidence. (A real case: “1.5 mm/s” is the lunar-gravity PMMA spread rate on one slide of the LUCI deck and the 1 g SIBAL flame base on another.)
- **Gravity needs its own sentence.** Each test’s gravity must have its own quote on the same page. A slide that sits in a 1 g section but only says “Results: PMMA” does not state its gravity.
- **Oxygen that falls during the burn is a result, not a condition.** It is stored as an outcome and never widens a test’s oxygen range.
- **Different quantities stay apart.** Flame base and flame tip spread rates are different variables. Ratios between tests (partial gravity over 1 g) are not records.
- **No platform as gravity, no inferred gravity.** A flight on a rocket or a station says nothing about the gravity level by itself.
- **No wording that overstates.** Superlatives, endorsements and absolute claims are never copied into a record.

## Status

**In the next build** as an automatic pipeline. The same rules were applied by hand, with separate checkers, to the LUCI golden set today.

## For engineers

- These are the rules added to the validator after the audit by a separate AI reviewer agent on 14 November: numbers as written, `value_original` inside the quote, and trace against the original text layer. Still open: checking that the quote is on the cited page.
