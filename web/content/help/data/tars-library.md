---
id: ds-tars-library
title: The TARS library: NASA text, page by page
chapter: data
order: 205
keywords: tars library, corpus, pages, chunks, bm25, search, text by code, no model, pymupdf
link: /data
page: data
dataHelp:
sources: tools/build_corpus.py, README.md
---
The TARS library is the only text the TARS chat answers from: the page-by-page text of the NASA documents PYRION downloaded.

In plain words: when TARS quotes NASA, the words come from a page of a NASA file, found by a search program, and code checks the quote against that page. No language model writes the library.

- **Where the text comes from:** PDF pages from PyMuPDF (the same call the validator uses), Word, PowerPoint and Excel files from their XML, web pages from a plain HTML parser, tables from the `csv` module. Nothing is OCR'd or summarised. A page with no text layer is skipped and listed.
- **What is in it:** 507 documents, 8874 pages (8648 with text), about 2.3 million words, split into 8691 chunks of about 320 words with a 50-word overlap.
- **Search:** a BM25 keyword index (no model, no network). Command line: `python -I tools/build_corpus.py --search "limiting oxygen concentration BASS-II"` prints the top five with document and page.
- **Not in it:** binary files (`.xls`, `.doc`, `.ppt`), archives, images, video, duplicates, and one PDF that cannot be opened. Tables enter as the header plus the first 25 rows; the numbers the engine uses live in `data/conditions/`.

## For engineers

- Output in `web/.data/corpus/` (git-ignored, regenerated from `data/raw/`): `pages.jsonl`, `chunks.jsonl`, `bm25.json`, `no_text_pages.json`, `skipped.json`, `corpus_manifest.json`.
- Rebuild takes about 70 seconds and is deterministic: the same files give the same hash of `pages.jsonl`.
