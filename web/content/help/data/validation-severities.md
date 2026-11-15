---
id: ds-validation-severities
title: Validation severities: BLOCKER, MAJOR, MINOR
chapter: data
order: 202
keywords: validation, blocker, major, minor, severity, report, run_all, validator, checks, language
link: /data
page: data
dataHelp:
sources: validation/run_all.py, validation/reports/latest.md
---
The validator reads every condition record and every public text and reports each problem with a severity.

In plain words: a **BLOCKER** is a problem that must be fixed before anything is published; a **MAJOR** is a real problem that does not break a record outright; a **MINOR** is a note for a reader to know about. The exit code of the run is 1 if there is any BLOCKER.

The Proof page shows the timestamp and severities from the validation report included in the deployed build. Read that report for the latest results; the counts change between runs.

## What each severity means

| Severity | Examples |
|---|---|
| BLOCKER | A required field is empty; a variable that is not in the schema; a regime value that is not allowed; a wrong unit for a variable; a source file that is not among the verified downloads; a converted value that does not match its recomputation; a range that is not ascending; a value outside physical bounds; two sources that disagree for the same test; an investigation without a DOI; a quote or a table cell that is not found in the source; a number of a quote that is not written as in the source; overstating wording in public text (superlatives, endorsements and absolute claims on a list the validator keeps). |
| MAJOR | A value that is not numeric where a number is expected; a unit conversion the validator cannot recompute; a license that PSI does not state but whose records lack the “license not stated” note; a trace check that could not run; the word “discovery” in public text. |
| MINOR | A documented unit-label mismatch (the header says one unit and the cells hold another); a summary row that covers several conditions; the word “safe” in public text, to be reviewed by a person. |

A finding's severity describes the validator's rule, not a NASA review or scientific approval. Read the current report for each finding and its reason. `validation/reports/latest.md` refers to the latest report in the repository checkout; a deployed site can contain an earlier snapshot.

## Where the report is

`validation/reports/latest.md` and `latest.json` are rewritten on every run. A second, independent validator for the extraction itself is `extraction/validate.py`; both must pass.

## For engineers

- `python -I validation/run_all.py` (all checks, needs `data/raw/`), `--no-trace` (what CI runs), `--conditions DIR` and `--reports DIR` (self-test and external folders).
- Checks, in order: schema, provenance, units, bounds, consistency, citation, trace, language.
- A line carrying `lang-ok` is an explicit, reviewed exception to the language gate.
