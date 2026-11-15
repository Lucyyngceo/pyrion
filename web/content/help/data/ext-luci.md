---
id: ds-ext-luci
title: LUCI: lunar gravity simulated on a rotating rocket (NTRS 20250010653)
chapter: data
order: 124
keywords: luci, ntrs 20250010653, lunar gravity, simulated, rotating, sounding rocket, partial gravity, sibal, pmma, golden set, external
link: /data
page: data
dataHelp:
sources: https://ntrs.nasa.gov/citations/20250010653, nasa/ntrs-20250010653/ASGSR 2025-LUCI-Ferkul-Presentation-v2-20250010653.pdf
---
LUCI (Lunar Combustion Investigation) is a flight experiment whose results are in the presentation “Lunar Combustion Investigation: Flammability Results from a Rotating Sounding Rocket” by Paul V. Ferkul (Universities Space Research Association), Michael C. Johnston (NASA Johnson Space Center), Nathan Kralik and Ya-Ting Liao (Case Western Reserve University), 2025 Annual Meeting, Phoenix, Arizona, December 3-6, 2025. NTRS citation: https://ntrs.nasa.gov/citations/20250010653.

In plain words: LUCI burned two samples, a cotton-fiberglass fabric (SIBAL) and a 4 mm acrylic (PMMA) rod, in air at normal pressure on a Blue Origin New Shepard sounding rocket. The vehicle rotated, so the centrifugal acceleration acted as a simulated lunar gravity. **This is simulated partial gravity, made by a rotating vehicle. It is not gravity on the Moon.** The deck itself says a Coriolis force acts on the flame (slide 17).

What the deck states about gravity (quoted, no g number is written anywhere in it):

> Gravity (in g’s) remains constant at lunar gravity. (slide 41)

> Blue Origin New Shepard sounding rocket yields Lunar gravity by using centrifugal acceleration. (slide 12)

The ground (1 g) comparison runs say: “Gravity (in g’s) remains constant at Earth’s gravity.” (slide 26) and “Gravity remains constant at Earth’s gravity for duration of burn.” (slide 30).

## What PYRION takes from it

PYRION holds a hand-checked extraction of this deck, the **golden set**, in `data/external/ntrs-20250010653/`. It covers the named flight and ground comparison tests, with usable and flagged records kept separate. It is **external evidence**, labelled as such, and it is not part of the PSI records. It is also the answer key for the planned “Add a source” feature, which is not on the site (see the article on the precision exam).

What was recorded: the gravity statements above, material (SIBAL, PMMA), geometry (fabric 5 cm wide x 30 cm long; 4 mm diameter rod), the platform, flame spread rates read from tables (flame base and flame tip are kept apart), flame length, extinction, and the chamber O2 measured during the burn (an outcome, not a test condition).

What was **not** recorded, and why:
- Any value that only exists in a plot. Figures are never read off.
- A pressure number: the deck says only “normal pressure”, so the record is `insufficient_evidence`.
- A g value: none is written; the 11 RPM and 1.22 m radius on slide 12 were not turned into one.
- The ratios partial-g / 1-g (.6, .39, .38): they compare tests, they are not a condition.
- The O2 during the burn as a condition: it falls inside the closed chamber, so it is stored only as an outcome.
- The extinction of the PMMA rod at lunar gravity: the deck says gravity dropped at 125 s on slides 22 and 43 and “~constant” on slide 44, so it stays `insufficient_evidence`.

## For engineers

- File `data/raw/nasa/ntrs-20250010653/ASGSR 2025-LUCI-Ferkul-Presentation-v2-20250010653.pdf`, 44 slides, SHA-256 `bb0aadd2f9543483467b86796e6aa19f4e13c3f8169eec96134015f95ed61d79`. License: not stated in the document.
- Records use accession `NTRS-20250010653` and descriptive test ids; built by `python -I extraction/build_external.py ntrs-20250010653` from an extractor and a separate verifier (`extraction/documents/review/external-ntrs-20250010653.*.json`).
- Validation: `python -I extraction/validate.py --conditions data/external/ntrs-20250010653` and `python -I validation/run_all.py --conditions data/external/ntrs-20250010653` ; consult the current report for the result.
- Slides 9, 11, 14, 15, 32 and 35 have no text layer. The flight samples shared a chamber and oxygen sensor, so the corresponding oxygen records are not independent observations.
