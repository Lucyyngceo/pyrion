---
id: ds-record-schema
title: The condition record, field by field
chapter: data
order: 204
keywords: schema, record, fields, accession, test_id, variable, value, unit, value_original, quote, status, insufficient_evidence, method
link: /data
page: data
dataHelp:
sources: schema/README.md, schema/condition_record.schema.json
---
Every physical condition in PYRION is one record: one value of one variable for one test, with the exact place it came from. The engine reads only these records.

In plain words: a record is a labelled fact with a receipt. The label says what was measured and for which test; the receipt says which NASA file, where in it, and the words or cell it was read from.

## The fields

| Field | Meaning |
|---|---|
| `accession` | The PSI investigation (`PSI-69`) or, for an external source, `NTRS-<id>`. |
| `test_id` | The test as NASA wrote it, or `*` when the value applies to every test of the investigation. |
| `variable` | A controlled name (see below). |
| `value` | The value as normalised by PYRION: a number, `lo..hi` for a range, or a controlled term. |
| `unit` | The schema unit of `value` (empty for terms). |
| `value_original` | The value exactly as written in the source. |
| `unit_original` | The unit exactly as written in the source. |
| `method` | `table` (read from a PSI table by code) or `document` (a sentence, with its quote). |
| `source_file` | Path under `data/raw/`. |
| `source_location` | `row=<n>;column=<header>` for tables; `page=<n>`, `paragraph=<n>` or `section=<name>` for documents. |
| `quote` | For documents, the verbatim sentence. For tables, the column header. |
| `status` | `extracted`, `verified` (a person compared it with the source) or `insufficient_evidence`. |
| `note` | Free text: a unit conversion, the confidence, a reason. |

## The variables

- **Regime axes (barriers, never interpolated across):** `gravity_regime` (`microgravity`, `partial_gravity`, `normal_gravity`), `fuel_phase` (`solid`, `liquid`, `gas`), `diluent` (`N2`, `He`, `CO2`, `Ar`, `mixed`), `flame_type` (`normal`, `inverse`).
- **Continuous axes (interpolated only inside the measured range):** `o2_mole_fraction` (ambient oxygen, 0 to 1), `burner_o2_mole_fraction`, `pressure` (kPa), `flow_velocity` (cm/s), `sample_thickness` (mm), `droplet_diameter_initial` (mm), `ambient_temperature` (K), `gravity_level` (g, only when stated).
- **Descriptive:** `fuel`, `material`, `geometry`, `flow_configuration`, `platform`.
- **Outcomes:** `outcome:<name>` with its unit, for results such as a spread rate or an extinction. An outcome is a measured result, never a condition.

## The four rules

1. No value without a source.
2. Never guess: if a value is not stated there is no record; if it is ambiguous the record is `insufficient_evidence`.
3. Unit conversions are explicit, with the original kept.
4. Gravity comes from the source, not from the platform: “flown on the ISS” is not a gravity value.

## For engineers

- Conventions: a range in one cell is one record `lo..hi`; a list in one cell is one record per value; a value derived from several columns lists them as `column=<h1>;column=<h2>`; an approximate value (“~21.5”) is stored as a plain number with a note; a unit label that contradicts the cells is kept as written with a `unit-label-mismatch` note.
- Contract: `schema/condition_record.schema.json`; files in `data/conditions/<accession>.csv`, UTF-8, header row = field names.
