# Data

## Source and selection

All experimental data come from NASA **Physical Sciences Informatics (PSI)**, <https://psi.nasa.gov>, the repository linked from the challenge resources ("PSI Data Repository: Combustion Science").

`pipeline/build_manifest.py` reads the live PSI catalog and selects every investigation whose PSI *Research Area* is **Combustion Science**: 24 of the 133 investigations in PSI. For each one it lists the files of the current version and assigns a priority:

| Priority | What | Why |
|---|---|---|
| **P1** | experimental tables, metadata, read-me and data descriptions, requirement documents, test matrices, calibration and reference data, reports, summary results, analyzed-data CSV files | needed by the evidence engine |
| P2 | other analyzed data, science documents, simulation, representative still images | supporting analysis |
| P3 | presentations, engineering documents | context |
| excluded | raw data, video, image sequences, archives (except metadata) | not needed to rank evidence; terabytes |

NASA documents outside PSI (fact sheets, NASA Technical Reports Server papers, standards) are listed in `manifest/external_sources.json`.

## Files in `manifest/`

| File | Content |
|---|---|
| `psi_manifest.json` | the selected PSI files with investigation, file version, size and priority, plus the time the catalog was read (`generated_at_utc`) |
| `investigations.csv` | one row per investigation: accession, acronym, title, **DOI**, **license**, PSI version |
| `external_sources.json` | NASA documents outside PSI, with their role in the project |
| `checksums_P1.csv` | every downloaded P1 file: path, size, SHA-256, source, status |

## Rebuild

```bash
python -I pipeline/build_manifest.py
python -I pipeline/fetch.py --priority P1
```

Standard library only (Python 3.10+). Files go to `data/raw/`, which is not committed. Compare the result against `manifest/checksums_P1.csv`.

The PSI catalog is live. `psi_manifest.json` is a snapshot taken at `generated_at_utc`, so re-running `build_manifest.py` later may produce a different list.

## P1 download, November 14, 2026

- 246 PSI files, 24 full PSI investigation records and 24 NASA documents: **294 files, all with status `ok`**.
- Every PSI file matches the size in the PSI catalog.
- Total: 377.9 MB.

## Notes for analysts

- **Licenses.** 23 of the 24 investigations are released under **CC0-1.0**. **PSI-10 (ACME/Flame Design) shows no license** on its PSI page or in its PSI record (checked November 14, 2026). It is cited by its DOI (10.60555/w4zy-bt45). Any value derived from it is flagged `license not stated`.
- **Identical files across investigations.** 15 files are byte-identical copies under different investigations. They are shared program documents: ACME (PSI-20, PSI-22, PSI-23), SAME (PSI-101, PSI-102) and SAFFIRE (PSI-98, PSI-100). They are counted once and **never treated as independent corroboration**.
- **"Reduced Gravity" folder names.** In PSI, a folder named `Reduced Gravity` holds **flight data** (microgravity on the ISS or a free-flying vehicle). It does not mean partial gravity.
