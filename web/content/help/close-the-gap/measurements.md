---
id: measurements
title: "What to measure, and NASA-STD-6001B"
chapter: 5
order: 5
dataHelp: [gap-section-measurements, gap-standard-link]
sources: ["data/raw/nasa/nasa-std-6001b/nasa-std-6001b.pdf", "NTRS 20250010653", "engine/src/experiments.ts"]
---

This section lists what flammability testing measures. Each item is a word-for-word quote from a document in the repository, with the page, so nothing here is from memory:

- **Maximum oxygen concentration** and **burn length**: from the NASA standard NASA-STD-6001B (approved 08-26-2011), whose Test 1 burns five vertical specimens of 30 cm by 6.5 cm and records how far each burns.
- **The limiting oxygen for extinction**, **upward and downward flame spread**, **flame spread rate**, **flame length and width**, and the **oxygen, pressure and gravity level over time**: from the LUCI presentation (NTRS 20250010653).

Separately, "what PSI records for the comparable investigations" lists the outcome variables that the extracted records of those investigations really carry. If the extracted records of those investigations do not carry flame spread rate or limiting oxygen, the section says so and does not pretend that they do.

NASA-STD-6001B has no DOI. It is linked on standards.nasa.gov and the repository holds a copy; the link points at a **historical copy**.

Anything LUCI-related is flagged "simulated partial gravity (rotating vehicle)" (see "FM2 and LUCI: what is stated, and what is not").

## For engineers

`TESTING_MEASURES` (`engine/src/experiments.ts`), each `{ measure, quote, file, page, qualifier? }`:

| Measure | Document | PDF page |
|---|---|---|
| Maximum oxygen concentration | NASA-STD-6001B | 30 |
| Burn length | NASA-STD-6001B | 29 |
| Limiting oxygen and extinction | LUCI, NTRS 20250010653 | 12 |
| Upward and downward flame spread | LUCI | 3 |
| Flame spread rate | LUCI | 13 |
| Flame length and width | LUCI | 24 |
| Oxygen, pressure and gravity level over time | LUCI | 5 |

`NASA_STD_6001B`: title "NASA-STD-6001B, Flammability, Offgassing, and Compatibility Requirements and Test Procedures", `approved: '08-26-2011'`, `file: 'nasa-std-6001b/nasa-std-6001b.pdf'`, `url: 'https://standards.nasa.gov/sites/default/files/standards/NASA/B-w/CHANGE-2/2/Historical/nasa-std-6001b.pdf'`, `doi: null`, note "A historical copy on standards.nasa.gov. No DOI." Test 1 specimen quote (PDF p. 28): "Five test specimens, each with dimensions of 30 cm by 6.5 cm (12 in by 2.5 in) and tested one at a time, shall be mounted vertically in a test stand."

`measurements.recorded` is derived from the `outcome:` variables of the comparable investigations' records (never invented): label, unit and investigations; `outcome:o2_mole_fraction_after_test`, `outcome:burn_time`, `outcome:burning_rate`, ... exist in `data/conditions`. Test: `engine/test/experiments.test.ts` checks every PDF quote against its stated page with `pdftotext` when `data/raw` is present.
