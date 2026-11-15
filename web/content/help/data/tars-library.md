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
The TARS library supplies the NASA passages used in the NASA-quotation layer. TARS also uses engine and calculator results, the site's help topics, and an own-reasoning layer labelled as unverified. The library is not the sole source of every answer.

In plain words: when TARS quotes NASA, the words come from a page of a NASA file, found by a search program, and code checks the quote against that page. No language model writes the library.

- **Where the text comes from:** PDF pages from PyMuPDF (the same call the validator uses), Word, PowerPoint and Excel files from their XML, web pages from a plain HTML parser, tables from the `csv` module. Nothing is OCR'd or summarised. A page with no text layer is skipped and listed.
- **What is in it:** Text extracted from the NASA documents included in the deployed library. Its size changes when the library is rebuilt; consult the corpus manifest for document, page and text-chunk counts.
- **Search:** a BM25 keyword index (no model, no network). Command line: `python -I tools/build_corpus.py --search "limiting oxygen concentration BASS-II"` prints the top five with document and page.
- **Not in it:** binary files (`.xls`, `.doc`, `.ppt`), archives, images, video, duplicates, and one PDF that cannot be opened. Tables enter as the header plus the first 25 rows; the numbers the engine uses live in `data/conditions/`.

## For engineers

- Output in `web/.data/corpus/` (git-ignored, regenerated from `data/raw/`): `pages.jsonl`, `chunks.jsonl`, `bm25.json`, `no_text_pages.json`, `skipped.json`, `corpus_manifest.json`.
- A rebuild produces a new corpus manifest. Compare manifests and source-file checksums when reproducing a library build.
