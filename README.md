# PYRION Ω — The Evidence Envelope

**NASA Space Apps Challenge 2026** · Challenge: *Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data* · Team **NDMLM** · Local event: San José, Costa Rica

> **Status:** under construction during the hackathon (November 14–15, 2026).

## What it is

PYRION is being built to rank NASA combustion experiments by how physically applicable they are to a target condition (gravity level, oxygen concentration, pressure, fuel type) and to show where the measured evidence ends.

Inside the measured range of a variable it can interpolate. Across a change of physical regime, such as microgravity versus partial gravity, it does not interpolate. It reports the gap instead.

The applicability verdict is computed by a deterministic engine. A language model is used only to parse inputs and to narrate results. It never decides the verdict.

## Data

Primary source: NASA Physical Sciences Informatics (PSI), <https://psi.nasa.gov>: the 24 investigations in the Combustion Science research area.
Each investigation is cited with its DOI and its license in [`data/manifest/investigations.csv`](data/manifest/investigations.csv).
How the data are selected, downloaded and checked: [`data/README.md`](data/README.md).

## Provenance

Development started on November 14, 2026, after the hackathon opened at 09:00 CST (UTC−6). Pre-event work was conceptual only: challenge study and scope decisions. Server-side push timestamps and CI run logs are available in the repository history.

## How it was built

One person (team NDMLM) working from two computers. Data, extraction, engine and validation were built on one; the interface redesign was built on the other in branch `laptop/ui` and merged through pull request #1. Every push carries a server-side provenance stamp (GitHub Actions, workflow `provenance`).

## Use of SI tools

This project uses Super Intelligence (SI) tools during development (Claude Code). A full disclosure will be added before submission: which tools, for what, and which parts of the code and text they produced.

## TARS library

The library TARS reads: the page-by-page text of the NASA documents downloaded under `data/raw/` (PSI reports, presentations, readmes and investigation records; NTRS papers and presentations; NASA-STD-6001B; JSC 29353D; NASA web pages). It is the only text TARS answers from, so every claim can be checked by code against the page it came from.

- **The text comes from code, not from a model.** PDF pages come from PyMuPDF `page.get_text()` (the call the validator uses), DOCX/PPTX/XLSX from their XML, web pages from the standard-library HTML parser, tables from the `csv` module. Nothing is OCR'd, summarised or rewritten; pages with no text layer are skipped and listed.
- **Rebuild** (about 70 s, deterministic: the same files give the same `pages.jsonl` hash):

  ```bash
  python -I tools/build_corpus.py
  python -I tools/build_corpus.py --search "limiting oxygen concentration BASS-II"
  ```

- **Output** in `web/.data/corpus/` (git-ignored, regenerable from `data/raw/`): `pages.jsonl` (one line per page with document, accession or NTRS id, 1-based PDF page, printed page when detectable, citation URL, DOI, SHA-256 of the file), `chunks.jsonl` (~320-word chunks with 50-word overlap, each pointing to its pages), `bm25.json` (a BM25 index, no model needed), `no_text_pages.json`, `skipped.json`, `corpus_manifest.json`.
- **Not read:** binary formats (`.xls`, `.doc`, `.ppt`), `.zip`, `.dat`, images and video, files identical to another by SHA-256, and one PDF that PyMuPDF cannot open (listed in `skipped.json`). Tables are included as header plus the first rows only; the numbers used by the engine live in `data/conditions/`. DOCX has no pages, so its pseudo-pages are blocks of paragraphs (`paragraph=a-b`).

## License

Code: Apache License 2.0, see [LICENSE](LICENSE).
Data from NASA PSI keeps its own terms, listed per investigation.
