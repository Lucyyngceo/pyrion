
## Grok v6 — 2026-11-15 (review required; no Git commands were run)

Spec: `C:\Users\emc2l\pyrion-ops\prompts\v6-GROK.txt` (the attachment Luis sent; same text, 4,724 bytes) and `v6-brief-grok-gpt.txt`. Relayed instructions from Claude (2026-11-15 01:13): do not recreate or overwrite GPT's `tools/build_materials.py` / `data/derived/materials.json`; item 2 reduced to the oxygen-ceiling visual (GPT's `/investigations/materials` shows the ceilings as text only, "No oxygen ceiling bar implemented yet"); Moon Base band and FM2 points taken from `engine/src/planner.ts`; spacesuit pO2 from `web/lib/expert/calculators.ts`.
Work was developed on a copy on the box and only the files below were copied into `C:\Users\emc2l\pyrion`.

### Item 1 — Safety and phenomenon lenses
- Files: `tools/build_lenses.py` (new), `data/derived/lenses.json` (generated).
- How it works: a hand-written TABLE of (accession, axis, tag, source, quote), 95 rows. The script fails (exit 1) if a quote is not word for word in its source field (only runs of whitespace are read as one space, because the PSI JSON breaks lines inside sentences), if a quote lacks a keyword of its tag (PYRION convention, listed in the file and in `lenses.json` → `rules.keywords`), if an accession is not in `data/manifest/investigations.csv`, or if an investigation has no strength row. `python tools/build_lenses.py --selftest` alters one quote and checks the script rejects it.
- Sources: `data/raw/psi-data/<PSI-n>/_investigation/<PSI-n>.json`, fields title / objective / approach / hypothesis / researchImpacts (every quote, field and accession is in `lenses.json`); challenge copy `C:\Users\emc2l\Pyrion NASA\.claude\skills\pyrion-flame\references\reto-oficial.md` (copied from https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/), lines 22, 24, 38, 40, 56, 57, 58, 66, 69, 70, 73.
- Audit rules checked against the sources:
  - BASS (PSI-26) suppression: CONFIRMED. Objective: "Assess the effectiveness of an inert, gaseous extinguishing agent (similar to that used on ISS) in putting out flames over different materials, geometries, preheating, and flow."; researchImpacts: "Using nitrogen as a flame suppressant in microgravity provides a direct link to current and planned extinguishment techniques."
  - FLEX (PSI-69) suppression: objective "measure the effectiveness of various gaseous fire suppressants such as CO2, He, and SF6"; challenge line 24 "Suppression was studied in the Flame Extinguishment Experiment (FLEX) through dilution of the chamber atmosphere with carbon dioxide and helium, both of which suppress fire."
  - SAME (PSI-102), SAME-R (PSI-101), DAFT (PSI-47) detection: researchImpacts quotes plus challenge lines 24 and 56.
  - SAFFIRE-I/-II/-III (PSI-98/99/100) prevention: objective "investigate the low-g flammability limits compared to those obtained in NASA’s normal gravity material flammability screening test."; detection is shown as CONTEXT, not a tag: researchImpacts "Instruments on an unmanned cargo vessel measure oxygen, carbon dioxide, heat, pressure and flame growth".
  - Extinction limits count as prevention, never as suppression by themselves. PSI-21, PSI-25 and PSI-60 were re-checked against Claude's rule (keep only if the quoted sentence is about suppressing or extinguishing fire). All three KEPT:
    - PSI-21 researchImpacts: "an understanding of those factors that affect flame extinction in diffusion flames is critical in the suppression of fires".
    - PSI-25 (BASS-II) title: "Burning and Suppression of Solids" (title field "Burning and Suppression of Solids - II"); objective: "BASS-II results contribute to the combustion computational models used in the design of fire detection and suppression systems in microgravity and on Earth."; researchImpacts: "BASS-II helps engineers select the safest materials and improve firefighting methods on future space missions."
    - PSI-60 researchImpacts: "For space applications, the results support safer fire detection, suppression, and cleaner combustion technologies critical for long-duration missions." (judgement: "suppression" here is fire-suppression technology; the study itself measured smoke points, not suppression.)
    - BASS (PSI-26) also gets its own name as a quote: title "Burning and Suppression of Solids".
- Counts (computed by the script): prevention 13, detection 6, suppression 5; ignition 4, spread 6, extinction 13, smoke 5; strength direct 9, fundamental 4, indirect 11. SLICE (PSI-106) has no leg or phenomenon tag: no quote in its four fields supports one.
- Not tagged for lack of a quote (judgement, not the keyword guard): PSI-20 ignition (its approach says "Ignition limit tests are not proposed for microgravity"); PSI-47 smoke (DAFT measured dust aerosols, not smoke); PSI-115 prevention ("prevent fires" refers to better detection devices); soot (PSI-10, 21, 106) is not tagged as smoke.

### Item 2 — Oxygen-ceiling bar + materials index: SKIPPED (already shown by GPT)
- Per Claude's relayed instruction, checked `web/app/investigations/materials/page.tsx` on the PC at 01:2x: it now draws ambient-ceiling bars per fuel phase, the burner oxygen separately ("Oxygen flowing from the burner, not the cabin") and the Moon (30 %) / suit (100 %) references. So no ceiling visual and no materials index were built by Grok; `/lenses` only links to `/investigations/materials`. `tools/build_materials.py` and `data/derived/materials.json` were NOT touched.
- Kept: `oxygenCeiling()` in `web/lib/lenses/model.ts`, computed with the engine's `buildCorpus` (`engine/src/evidence.ts`), used only on `/more` to compute the sentence "no PSI test at these conditions" for the suit (highest ambient O2 of any PSI test: 40 %, below 100 %). Over 1651 engine tests it gives gas 40 % (PSI-10, PSI-20), liquid 34 % (PSI-69), solid 22.7 % (PSI-26 test 54), burner 85 % (PSI-159); these now agree with GPT's current `materials.json` (gas 0.4, liquid 0.34, solid 0.22721982701616103).
- Note for Claude: GPT's page draws the Moon reference bar with a typed width ("30%") in JSX, not read from the challenge text; the brief asks for numbers computed from files. `lenses.json` → `challenge.moon_base.o2_percent_min` and `challenge.suit.o2_percent` hold both values read by regex from the verified challenge quotes, if GPT wants to use them.

### Item 3 — Evidence timeline
- Files: `tools/build_timeline.py` (new, standalone, stdlib), `data/derived/timeline.json` (generated), `web/components/lenses/Timeline.tsx`.
- How it works: per investigation, investigationStartDate / investigationEndDate / missionStart copied as written; (O2, pressure) points of its tests (engine rule, ranges give both ends, identical points merged with a test count and their gravity regimes). Axis label: "year as listed by PSI (end date)" (from `timeline.json` → `rules.label`). Placement (PYRION convention): year of investigationEndDate, else missionStart (empty in all 24), else "date not stated in PSI" (PSI-100, 106, 107, 159), drawn in the last frame. 9 investigations have points; 676 distinct points; years 2008–2025.
- Moon Base band: `MOON_BASE_BAND` imported from `engine/src/planner.ts` (identical to /planner); drawn as a dashed empty outline. Computed on the page: 6 PSI points (ACME BRE) lie inside it in oxygen and pressure, all in microgravity; 0 in lunar gravity, so it is labelled "no PSI test in lunar gravity". Challenge line 73: "there is currently no partial-gravity combustion data available in PSI".
- FM2: `fm2Hypothetical()` imported from `engine/src/planner.ts`, drawn dotted, "planned, not in PSI". FM2 values CONFIRMED in `data/raw/nasa/ntrs-20260001966/Ferkul-Lunar and Planetary Science Conf 2026 v2.pdf`, PDF p. 10 (slide 9): "Test 1: 8.2 psia (+/- 0.3 psi), 37% O2 , balance nitrogen) … Test 4: 8.2 psia (+/- 0.3 psi), 25% O2 , balance nitrogen)" (checked with pdftotext).
- prefers-reduced-motion: no autoplay and no CSS transitions (matchMedia + CSS media query); the slider still works.

### Item 4 — /more page
- Files: `web/app/more/page.tsx`, `web/lib/lenses/profiles.ts` (reads GPT's `data/derived/investigation_profiles.json`, never writes it).
- Earth: only researchImpacts sentences (split by code, otherwise verbatim) that say "on/for/to Earth", "terrestrial", "Earth benefits/environments" (PYRION convention, stated on the page); 21 sentences from 16 investigations at last build, each labelled "As stated in the PSI record" with the file and field, a link to `/investigations/<PSI-n>` and the PSI DOI.
- Spacesuit: 100 % O2 at 4.3 psi from challenge line 66; pO2 = 29.65 kPa (4.3 psia) from `o2PartialPressure` in `web/lib/expert/calculators.ts` (import only); "Outside PSI: no PSI test at these conditions" is shown because the computed highest ambient O2 (40 %) is below 100 %; NASA-STD-6001B title, approval date and file folder from `NASA_STD_6001B` in `engine/src/experiments.ts`.
- Rockets: challenge line 40 footnote quoted in full.

### Tests
- `web/test/lenses-data.test.ts` (13 tests): quotes word for word in PSI JSON and challenge (skipped if data/raw or the challenge copy is absent); keyword rule; audit rules; challenge numbers read from quotes; ceiling vs engine; burner = challenge 85 %; timeline points equal the engine's test points; dates copied from PSI; band and FM2 identical to the engine; suit pO2 equals the calculator; Earth sentences verbatim; no forbidden words in my pages.
- On the box: `npm --prefix web run build` passed. `npm --prefix web test`: all 13 lenses tests pass; the only failure from my files is help coverage (3 ids, see below). With the three staged topics placed in `web/content/help/lenses/`, the full suite passed 192/192 on the box before GPT's latest files were pulled.

### Needs Claude
- Help topics: Claude moves `web/lib/lenses/help-topics/*.md` to `web/content/help/lenses/` (agreed); until then help coverage fails on 3 ids.
- Nav: Claude adds Lenses and More under "More ▾" (agreed); SiteNav not touched.
- GPT can read `data/derived/lenses.json` for its safety-leg filter: `investigations[].legs.{prevention,detection,suppression}` (non-empty list = tagged).

### Uncertain
- Strength categories are a PYRION convention (rule in `lenses.json` → `rules.strength`); "fundamental" is assigned when the record itself uses the word, which is a weak signal.
- PSI dates for SAFFIRE-I (03-02-2001 to 02-28-2008) are identical to SAME's in the PSI JSON; shown as written with the note "identical to SAME's in PSI; may be a PSI record error" (SAME gets the mirror note).
- Some PSI JSON text has typographic characters (’ –); quotes keep them exactly.

### Round 3 — Claude's answers applied (2026-11-15)
- DAFT (PSI-47) strength: direct → indirect (Claude). Quote, verified by the script on challenge line 56: "One of the instruments used for smoke detection in the SAME and SAME-R studies was instead used to detect dust in the Dust and Aerosol Measurement Feasibility Test (DAFT and DAFT-2) studies." Keyword list for "indirect" gains "was instead used to detect dust"; `rules.strength` states the exception.
- Suppression re-check: PSI-21, PSI-25, PSI-60 all kept (quotes above); BASS-II and BASS name quotes added from the PSI `title` field (the script now accepts `title` as a source field and verifies it word for word).
- Timeline: axis label "year as listed by PSI (end date)"; `build_timeline.py` adds `date_note` when two PSI records list the same start and end dates (only SAFFIRE-I PSI-98 and SAME PSI-102); `/lenses` lists every investigation's start/end dates as written with that note.
- Tests: `lenses-data.test.ts` checks DAFT = indirect with the dust sentence, the two title quotes, the SAFFIRE-I note and the axis label.
- Not touched: help topics location, SiteNav, GPT's files.
