# Extraction: from PSI files to condition records

This folder turns the downloaded PSI files (`data/raw/`, see [`data/README.md`](../data/README.md)) into the condition records of [`schema/`](../schema/README.md), written to [`data/conditions/`](../data/conditions/).

```bash
python -I extraction/build_conditions.py   # build every data/conditions/<accession>.csv, SUMMARY.md, REVIEW.md, then validate
python -I extraction/validate.py           # validate only (standard library)
```

Python 3.10+. `openpyxl` is needed only for the spreadsheet sources (`.xlsx`).

## Two kinds of record

**`method = table`: read by code.** `tables/` holds one adapter per PSI experimental table. An adapter maps named columns to schema variables and converts units with exact factors written into each record's `note` (mmHg × 101.325/760, atm × 101.325, bar × 100, percent × 0.01, °C + 273.15). It keeps the cell as written in `value_original`, the header as written in `quote`, and the place as `row=<n>;column=<header>` (data rows numbered from 1 below the header). A cell that holds no readable number is not guessed: it is listed in `skipped_cells.csv` with the reason. Readings that rely on a judgement applied to a whole column (for example, a header whose subscripts were lost) are declared in the adapter's `INTERPRETATIONS` and printed in `SUMMARY.md` and `REVIEW.md`.

**`method = document`: read from a sentence.** Values that no table states (gravity regime, fuel phase, diluent, platform, and conditions that a table lacks) come from the PSI investigation record or a PSI document. Each one carries the verbatim sentence in `quote`. They are stored in `documents/<accession>.csv` after two separate passes:

1. an **extractor** agent reads the sources of one investigation and proposes records with their quotes;
2. a **verificador** agent, in a separate invocation and without the extractor's reasoning, opens the same sources and tries to break each record (keep / modify / reject).

Only records the second pass kept, or corrected with its own quote, are stored. This is a segregated internal check by language models, not expert or NASA review. Every document record is listed in `data/conditions/REVIEW.md` so that a person can confirm it by reading; a record becomes `verified` only after that.

## What the validator enforces

`validate.py` uses only the standard library. For every record it checks the schema (fields, variable names, controlled values, units), the value conventions (numbers or `lo..hi`, fractions within 0..1), and these rules:

- a table record's `quote` is its column header, and the cell at `row`/`column` holds `value_original`;
- a document record's `quote` occurs in the source file, and `value_original` occurs in the quote;
- `gravity_regime` comes only from a document sentence that states a gravity condition: the platform (ISS, Cygnus) is not a gravity value;
- no record claims `partial_gravity` (PSI holds no partial-gravity combustion test; E-FIELD Flames is an electric-field analog, and PSI folders named "Reduced Gravity" hold flight data);
- every PSI-10 record says `license not stated` (its PSI page gives no license).

Any failure stops the build with the full list.
