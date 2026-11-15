---
id: ds-locating-values
title: How code finds each value in the NASA source
chapter: data
order: 201
keywords: located by code, trace, quote, cell, row, column, numbers as written, excel, sheet, verbatim, validator, 1.5 not 15
link: /data
page: data
dataHelp:
sources: validation/run_all.py, schema/README.md, extraction/validate.py
---
Every condition record identifies a location in a NASA file. The automated checker can locate supported table cells and quotations; some file formats are not yet readable by that checker. The Data page reports those cases separately.

In plain words: a receipt records where a value was read. A successful automated trace check confirms a supported cell or finds a quotation in the file. That is different from confirming the cited page or checking scientific interpretation. A failed check, an unreadable format and a value flagged as insufficient evidence are reported separately.

## The three kinds of location

- **A table cell.** The record says `row=<n>;column=<header>` (and `sheet=<name>` for an Excel file). The program opens the CSV or Excel file, finds the header row, goes to data row n and reads the cell. The cell must contain the value as written (`value_original`). For Excel the program reads cell values, never formulas, and a record without its sheet name is rejected.
- **A sentence in a document.** The record says `page=<n>`, `paragraph=<n>` or `section=<name>` and carries the sentence as `quote`. The program extracts the text of the file with the same PDF library every time and looks for the quote, word for word. Differences in spacing, line breaks and typographic punctuation are ignored; a word that differs is not.
- **An elision.** A quote may be cut with `[...]`; each fragment must appear, in order.

## Numbers as written

The numbers of a quote must appear in the file exactly as written, in the same order. The check keeps the decimal point, so `1.5` is not `15` and `.15` is not `15`. The `value_original` of a record must itself be written in its quote. This rule was added after an audit by a separate AI reviewer agent found that an earlier version compared numbers without their points and signs.

## What it checks today, and what it does not

- Today: supported table cells are checked at their recorded row and column, and document quotations are searched in the source file. The Data and Proof pages give the latest counts and report timestamp.
- Not yet: that the quote sits on the **cited page**. The page number is stored and shown, but the program searches the whole file. A page check is planned.
- The text comes from the text layer of the original file. A value that exists only in a figure or an image cannot be located and is never accepted.

## For engineers

- `validation/run_all.py` (`check_trace`) is written separately from `extraction/validate.py` on purpose: two implementations catch mistakes that one shares with the code that produced the records.
- Text normalisation: NFKC (ligatures), hyphenated line breaks joined, case and punctuation dropped for the word-for-word comparison; numbers are compared as tokens with `numbers_in`.
- `validation/selftest.py` seeds errors (a number off by a decimal point, a wrong cell, an invented quote) and checks the validator catches them.
- Table units are recomputed from `value_original` and `unit_original` where a supported conversion is available. Consult the current validation report for the count and any conversions it could not recompute.
