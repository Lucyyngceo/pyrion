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
| `checksums_P1.csv`, `checksums_P2.csv`, `checksums_P3.csv` | every downloaded file: path, size, SHA-256, source, status |
| `publications.csv` | every publication PSI lists for each investigation: title, authors, DOI, DOI link, status (352, of which 284 have a DOI) |
| `hardware.csv` | experiment hardware and its NASA link, project type, flight program and mission per investigation |
| `experimental_tables.csv` | the 22 experimental-table files PSI attaches to the investigations (all downloaded, sizes match) |
| `coverage.csv` | per investigation and folder: files and bytes PSI holds, how many PYRION selected (P1/P2/P3) and how many it excluded |
| `web_check_2026-11-14.csv` | version, license, DOI and publication counts read on the psi.nasa.gov page of each investigation |

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

## Cross-check against the PSI website

The PSI investigation pages are built from the same public API this pipeline reads: the investigation record, the file tree and the experimental-table download. On November 14, 2026 each of the 24 pages was opened. Version, license, DOI, number of publications and number of publications with a DOI were compared with the downloaded records (`web_check_2026-11-14.csv`). **0 differences in 120 comparisons.**

## What is not downloaded

`coverage.csv` lists everything PSI holds for these 24 investigations: 66,567 files, about 13.5 TB. PYRION selects about 2 GB. The rest is:

- **Raw Data**: 65,629 files, about 13.5 TB: flight video, image sequences and archived raw files. The evidence engine works from the experimental tables, analyzed data and documents. It does not reprocess raw imagery.
- **Archives and video inside document folders**: about 12.6 GB of `.zip` and `.mp4` files, mostly calibration image archives (9.9 GB). They can be added with the same pipeline if needed.

Building the citation and coverage tables:

```bash
python -I pipeline/build_catalog_tables.py
```

## Notes for analysts

- **Licenses.** 23 of the 24 investigations are released under **CC0-1.0**. **PSI-10 (ACME/Flame Design) shows no license** on its PSI page or in its PSI record (checked November 14, 2026). It is cited by its DOI (10.60555/w4zy-bt45). Any value derived from it is flagged `license not stated`.
- **Identical files across investigations.** 15 files are byte-identical copies under different investigations. They are shared program documents: ACME (PSI-20, PSI-22, PSI-23), SAME (PSI-101, PSI-102) and SAFFIRE (PSI-98, PSI-100). They are counted once and **never treated as independent corroboration**.
- **"Reduced Gravity" folder names.** In PSI, a folder named `Reduced Gravity` holds **flight data** (microgravity on the ISS or a free-flying vehicle). It does not mean partial gravity.
