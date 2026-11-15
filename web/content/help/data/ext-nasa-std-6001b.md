---
id: ds-ext-nasa-std-6001b
title: NASA-STD-6001B: the 1 g flammability test standard
chapter: data
order: 149
keywords: nasa-std-6001b, test 1, upward flame propagation, standard, moc, flammability
link: /data
page: data
dataHelp:
sources: https://standards.nasa.gov/sites/default/files/standards/NASA/B-w/CHANGE-2/2/Historical/nasa-std-6001b.pdf, nasa/nasa-std-6001b/nasa-std-6001b.pdf page=1
---
NASA-STD-6001B is the NASA technical standard for flammability, offgassing and compatibility of materials used in spacecraft. Its Test 1 is the 1 g upward flame propagation test: a sample is ignited near the bottom and the flame spreads upward. Materials that pass are cleared for flight use; materials that fail are restricted.

In plain words: this is the ground test every spacecraft material must pass today. The whole question behind PYRION is how well that 1 g test predicts what happens at lunar gravity or in microgravity, so the standard is the baseline the other evidence is compared with.

The cover page reads: “NASA TECHNICAL STANDARD NASA-STD-6001B [...] Approved: 08-26-2011”, and it is “APPROVED FOR PUBLIC RELEASE”.

What PYRION uses it for (from the manifest): **the 1-g upward flammability test (Test 1)**. A companion document, NTRS 20170004702, shows how the maximum oxygen concentration (MOC) is determined in practice.

## For engineers
- Manifest entry: `data/manifest/external_sources.json`, id `nasa-std-6001b`, priority P1. Everything in that file is a NASA-published document or page.
- File `data/raw/nasa/nasa-std-6001b/nasa-std-6001b.pdf` (1514218 bytes), SHA-256 `3565820b2267be5252ed48653d23491cf81dc151155ea176fe5480dc162ee03a`, downloaded from https://standards.nasa.gov/sites/default/files/standards/NASA/B-w/CHANGE-2/2/Historical/nasa-std-6001b.pdf.
- TARS library: 108 pages with a text layer.
- Referenced in the repository by: `engine/src/experiments.ts`.
- Not a PSI investigation: any record from it would use an accession `NTRS-<id>` and is labelled external; none is mixed into `data/conditions/`.
