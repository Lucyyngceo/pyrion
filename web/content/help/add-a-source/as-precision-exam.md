---
id: as-precision-exam
title: The precision exam
chapter: add-a-source
order: 160
keywords: exam, precision, golden set, luci, negative controls, counts, coverage, accepted, invented values, judge battery
link: /envelope
page: global
dataHelp:
sources: pyrion-ops/FASE-3-ADD-SOURCE.md, data/external/ntrs-20250010653/README.md
---
What it is: A proposed evaluation for the removed Add a source feature. The automatic extraction feature is not available on the live site.

What it shows: The intended comparison between proposed extracted records and a manually checked reference dataset, sometimes called a golden set.

How to use it: Read the reference dataset and its validation report in the repository. A future automatic evaluation would report accepted correct values, missed values and incorrect accepted values separately.

Example: An evaluation can include an altered decimal point, a quotation not present in the source and a value visible only in an image, then check whether those cases are rejected.

What it does not do: A reference dataset or a successful check does not establish that an unbuilt extraction pipeline works or that every accepted interpretation is scientifically correct. No release date is confirmed.

For engineers: the reference data are in `data/external/ntrs-20250010653/`. Read the current validation report for its status; this help topic does not freeze its record counts or test results.
