---
id: as-ntrs-only
title: Only an NTRS number, only NASA
chapter: add-a-source
order: 120
keywords: ntrs number, nasa only, ssrf, url, upload, sha-256, not verified, your file
link: /envelope
page: global
dataHelp:
sources: pyrion-ops/FASE-3-ADD-SOURCE.md
---
This topic describes the proposed Add a source feature. Its button and dialog were removed from the live site, and visitors cannot add evidence. The design below is an archived proposal; no release date is confirmed.

In plain words: you give a number, and the server builds the NASA address itself. Nothing you type is ever fetched as a web address, so the feature cannot be used to make the server visit an arbitrary site. Other kinds of links (doi.org, other pages) are not accepted.

## A file you upload

A CSV or Excel file you upload is read by code with columns you map by hand. A file you upload **is not NASA** unless its SHA-256 matches the one of the file downloaded from NTRS; otherwise it is labelled “your file, not verified”.

## How a document is read

- Maximum 20 MB and 60 pages.
- Read in a separate process with a time and memory limit.
- The text for checking comes from the original file’s text layer, by code. What exists only in a figure or an image is rejected.

## Status

**Planned, not available** The NTRS number field and the file chooser exist in the code but are not shown on the site; nothing is fetched or read.

## For engineers

- The server builds `https://ntrs.nasa.gov/...` from the digits; the digits are validated (numbers only) and the host is fixed.
- The SHA-256 of a download is stored as provenance.
