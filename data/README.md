# Data

## Source and selection

All experimental data come from NASA **Physical Sciences Informatics (PSI)**, <https://psi.nasa.gov>, the repository linked from the challenge resources ("PSI Data Repository: Combustion Science").

`pipeline/build_manifest.py` reads the live PSI catalog and selects every investigation whose PSI *Research Area* is **Combustion Science**: 24 of the 133 investigations in PSI. For each one it lists the files of the current version and assigns a priority:

| Priority | What | Why |
|---|---|---|
| **P1** | experimental tables, metadata, read-me and data descriptions, requirement documents, test matrices, calibration and reference data, reports, summary results, analyzed-data CSV files | needed by the evidence engine |
| P2 | other analyzed data, science documents, simulation, representative still images | supporting analysis |
| P3 | presentations, engineering documents | context |
| P4 | everything else outside Raw Data: archives (mostly calibration images), video, other file types | completeness |
| excluded | Raw Data | flight video, image sequences and archived raw files; about 13.5 TB |

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

## P2 and P3 downloads, November 14, 2026

- **P2:** 283 files, all `ok` (1,061.0 MB).
- **P3:** 203 `ok`, 6 not `ok` (590.2 MB downloaded). Every problem is recorded in `checksums_P3.csv`, none is hidden:
  - 5 SAFFIRE files (PSI-98, PSI-100) are listed by PSI and the download link is issued, but PSI's storage answers **404 Not Found**.
  - 1 ACME file (PSI-20, `ACME_engineering_20210328.pdf`) downloads at 6,843,254 bytes while the PSI catalog says 5,794,678. It is kept and flagged as a size mismatch.

All three are context documents (P3). None of them is used as evidence.

## Official challenge resources

The challenge page (Resources tab) lists 10 resources. All are in `manifest/external_sources.json` (ids starting with `challenge-`):

| Resource | What is stored |
|---|---|
| PSI Data Repository: Combustion Science | the 24 investigations, P1–P4 (this folder) |
| A Researcher's Guide to ISS Combustion Science | the PDF and the web page |
| NASA Glenn: Combustion Science | the web page |
| Apollo 1, Apollo 13 (NASA Office of Safety and Mission Assurance) | the web pages and the 14 PDFs they link: 12 downloaded; 2 links on the NASA page return 404 (Apollo 13 Mission Report; Apollo 13 Review Board appendices B–E) |
| 25 Years Ago: Fire Aboard Space Station Mir | the web page |
| NASA Spinoff: Fireman's Air Tanks, Fire Detector, New Technology for the Fire Attire | the web pages |
| NASA ScienceCasts video (YouTube) | cited by link, not downloaded |

Web pages are saved as `page.html` with their SHA-256, as they were served on November 14, 2026.

**Links of the resources, two levels deep** (`pipeline/crawl_resources.py`, ids `crawl-…`, each with `found_on`). Level 1 follows the links in the main content of each resource page; level 2 follows documents and NTRS records only. Only NASA, govinfo.gov and doi.org hosts are followed; links to other agencies' and third-party sites are not. 18 items were found: the NASA Glenn pages for FM2, SoFIE and FLARE, the Fluids and Combustion Facility, the NASA Science combustion focus area, two news releases, the ISS researcher pages, the EPUB edition of the Researcher's Guide, a crew biography from the Mir page, and from level 2 the ISS Annual Highlights of Results 2025 with its publication list and an ISS science infographic. 17 were downloaded; the MDCA page linked from the Glenn page returns 404.

## Cross-check against the PSI website

The PSI investigation pages are built from the same public API this pipeline reads: the investigation record, the file tree and the experimental-table download. On November 14, 2026 each of the 24 pages was opened. Version, license, DOI, number of publications and number of publications with a DOI were compared with the downloaded records (`web_check_2026-11-14.csv`). **0 differences in 120 comparisons.**

## What is not downloaded

`coverage.csv` lists everything PSI holds for these 24 investigations: 66,567 files, about 13.5 TB. Everything outside Raw Data is selected (P1 to P4: 938 files, about 14.6 GB) and downloaded, except the 5 SAFFIRE files that PSI's storage cannot serve (see above).

**Raw Data is not downloaded**: 65,629 files, about 13.5 TB of flight video, image sequences and archived raw files. The evidence engine works from the experimental tables, analyzed data and documents. It does not reprocess raw imagery.

P4 download, November 14, 2026: 204 files, all `ok`, 12,658.9 MB.

Building the citation and coverage tables:

```bash
python -I pipeline/build_catalog_tables.py
```

## Notes for analysts

- **Licenses.** 23 of the 24 investigations are released under **CC0-1.0**. **PSI-10 (ACME/Flame Design) shows no license** on its PSI page or in its PSI record (checked November 14, 2026). It is cited by its DOI (10.60555/w4zy-bt45). Any value derived from it is flagged `license not stated`.
- **Identical files across investigations.** 15 files are byte-identical copies under different investigations. They are shared program documents: ACME (PSI-20, PSI-22, PSI-23), SAME (PSI-101, PSI-102) and SAFFIRE (PSI-98, PSI-100). They are counted once and **never treated as independent corroboration**.
- **"Reduced Gravity" folder names.** In PSI, a folder named `Reduced Gravity` holds **flight data** (microgravity on the ISS or a free-flying vehicle). It does not mean partial gravity.
