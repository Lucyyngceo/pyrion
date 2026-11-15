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
How do we know “Add a source” is precise? By an exam with a known answer key.

In plain words: the same program that will read a new document is run on documents whose correct records are already known, and its output is compared with the answer key. The result is reported as raw counts, for example “13 of 15 found, 0 incorrect accepted”, never as a percentage that hides the size.

## The answer key

The **LUCI golden set** was extracted by hand with the usual rigour (an extractor, a separate verifier, then the validator): 42 records in 4 tests, 37 usable and 5 `insufficient_evidence`, in `data/external/ntrs-20250010653/`. It exists today.

## The exam

- **Precision:** of the values the process accepts, how many are correct.
- **Coverage:** how many of the golden-set values it finds.
- **Zero invented values accepted:** every value the code cannot locate must be rejected.
- **Free extra test:** run the process on documents already curated in `data/conditions/`, where the answer is known.
- **Negative controls:** numbers deliberately altered, a false quote injected, and a value that exists only in a figure. All must be rejected.
- **Aim:** every accepted value correct, because the validator rejects what it doubts, and coverage of at least 80 %. If the aim is not met, the real number is published on the page.
- The judge battery gains an “add-source” section that runs this exam.

## Status

**In the next build.** The golden set and the validator changes it needed exist today; the exam itself runs once the pipeline exists.

## For engineers

- `python -I validation/run_all.py --conditions data/external/ntrs-20250010653` validates the golden set (0 BLOCKER).
- The judge battery lives in `validation/judge_battery/`.
