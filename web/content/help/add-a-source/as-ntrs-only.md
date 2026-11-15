---
id: as-ntrs-only
title: Only an NTRS number, only NASA
chapter: add-a-source
order: 120
keywords: ntrs number, nasa only, ssrf, url, upload, sha-256, not verified, your file
link: /
page: global
dataHelp:
sources: pyrion-ops/FASE-3-ADD-SOURCE.md
---
“Add a source” accepts one kind of source: **an NTRS document number** (digits only, from ntrs.nasa.gov). If you paste an ntrs.nasa.gov link, only its digits are kept.

In plain words: you give a number, and the server builds the NASA address itself. Nothing you type is ever fetched as a web address, so the feature cannot be used to make the server visit an arbitrary site. Other kinds of links (doi.org, other pages) are not accepted.

## A file you upload

A CSV or Excel file you upload is read by code with columns you map by hand. A file you upload **is not NASA** unless its SHA-256 matches the one of the file downloaded from NTRS; otherwise it is labelled “your file, not verified”.

## How a document is read

- Maximum 20 MB and 60 pages.
- Read in a separate process with a time and memory limit.
- The text for checking comes from the original file’s text layer, by code. What exists only in a figure or an image is rejected.

## Status

**In the next build.** Today only the NTRS number field and the file chooser exist, and they check the input; nothing is fetched or read yet.

## For engineers

- The server builds `https://ntrs.nasa.gov/...` from the digits; the digits are validated (numbers only) and the host is fixed.
- The SHA-256 of a download is stored as provenance.
