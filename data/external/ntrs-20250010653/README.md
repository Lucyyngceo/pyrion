# LUCI golden set (external source, NTRS 20250010653)

**External evidence. Not a PSI investigation. Not part of `data/conditions/`.**
This folder is the reference ("golden") extraction of one NASA presentation. It is used to test the in-app "Add a source" pipeline: the pipeline's output for the same PDF is compared with these records.

| Field | Value |
|---|---|
| Title | Lunar Combustion Investigation: Flammability Results from a Rotating Sounding Rocket |
| Authors | Paul V. Ferkul (Universities Space Research Association), Michael C. Johnston (NASA Johnson Space Center), Nathan Kralik and Ya-Ting Liao (Case Western Reserve University) |
| Venue and date | 2025 Annual Meeting (ASGSR), Phoenix, Arizona, December 3-6, 2025 |
| Record | https://ntrs.nasa.gov/citations/20250010653 |
| File | `data/raw/nasa/ntrs-20250010653/ASGSR 2025-LUCI-Ferkul-Presentation-v2-20250010653.pdf` (44 slides; not published in this repository, see `.gitignore`) |
| SHA-256 of the PDF | `bb0aadd2f9543483467b86796e6aa19f4e13c3f8169eec96134015f95ed61d79` |
| License | not stated in the document |
| Extraction date | 2026-11-14 |
| Accession used in records | `NTRS-20250010653` (registered in `data/manifest/external_sources.json`) |

## What is in `conditions.csv`

Same 13 columns as `data/conditions/`. 42 records in 4 tests. Test ids are descriptive, not rows of a table: `LUCI partial-g SIBAL`, `LUCI partial-g PMMA`, `LUCI 1-g SIBAL`, `LUCI 1-g PMMA`.

| Variable | Records |
|---|---|
| gravity_regime | 6 |
| platform | 2 |
| material | 6 |
| geometry | 2 |
| fuel_phase | 4 (derived from the material name; the deck never writes "solid") |
| diluent | 2 (derived from "in air") |
| pressure | 2 (`insufficient_evidence`: the deck says only "normal pressure", no number) |
| outcome:flame_spread_rate_base | 4 |
| outcome:flame_spread_rate_tip | 5 |
| outcome:flame_tip_growth_rate | 1 |
| outcome:flame_length | 1 |
| outcome:extinction | 3 |
| outcome:o2_during_burn | 4 (chamber O2 measured during the burn; an outcome, not a test condition) |

Every record carries the verbatim quote and the slide (`page=n`, where n is the PDF page). Numbers are written as in the source (for example `.9`, `1.5`) and units are kept as written (mm/s and cm/s are not converted for outcomes).

## Gravity statements

The deck states the regime in words and never gives a g value:

- Partial gravity: "Lunar-g" / "Lunar g" (slides 16, 17) and "Gravity (in g's) remains constant at lunar gravity." (slide 41). Slide 12 says the rotating vehicle "yields Lunar gravity by using centrifugal acceleration". This is simulated partial gravity from rotation, with a Coriolis effect (slide 17), not true lunar gravity.
- 1 g: "Gravity (in g's) remains constant at Earth's gravity." (slide 26) and "Gravity remains constant at Earth's gravity for duration of burn." (slide 30).
- No `gravity_level` record: the deck writes no number such as 0.16 g. It gives 11 RPM and a 1.22 m effective radius (slide 12); no g value was computed from them.

## What was not extracted, and why

- Values that exist only in plots (flame positions, g versus time, O2 versus time, fit curves): figures are never read off. Slides 14, 15, 32 and 35 have no text layer.
- Fit equations (slides 40 and 43): no equation text in the document.
- Ratios partial-g / 1-g (.6, .39, .38): comparisons, not conditions or outcomes of one test.
- Rotation rate and radius, burn-time lower bounds, spread direction, sample orientation, ignition sequence, chamber size, flight date: stated in words but no schema variable; not recorded.
- Initial or ambient O2, flow configuration and flow velocity, thickness, temperature value, 1-g facility and sample form: not stated.
- Partial-g PMMA gravity history is inconsistent in the text (slides 22 and 43: gravity dropped at 125 s; slide 44: "~constant for duration of the burn"). Extinction of the PMMA rod (slide 20) is therefore `insufficient_evidence` with respect to the gravity level.
- Slide 31 ("Results: PMMA") does not carry "1-G" in its text and states no gravity itself: its O2 range is `insufficient_evidence`.
- Both flight samples burned in one chamber with one O2 sensor, so the two partial-g O2 records are not independent observations. The slide-42 SIBAL value (~20% to ~18%) and the slide-22 PMMA value (20% to 14.3%) are not explained by the deck.
- Several values appear twice (slide text and table, e.g. flame base .92 mm/s and .9 mm/s); they are the same measurement, not two.

## Method and review level

Extractor agent (draft kept as `extraction/documents/review/external-ntrs-20250010653.extractor.draft1.json`), then a separate verificador agent, then changes after an independent audit (listed in `build_session_corrections` of the verificador file), then `python -I extraction/build_external.py ntrs-20250010653` and `python -I extraction/validate.py --conditions data/external/ntrs-20250010653`. Tables on slides 33 and 36 and slide 31 were checked against the slide image by the build session. This is a segregated internal check by language models, not expert or NASA review.
