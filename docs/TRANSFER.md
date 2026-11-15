# Transfer hypotheses: reading PSI microgravity tests as analogs of other gravity levels

**Status: specification. A transfer hypothesis is never evidence.** It is a labelled, cited, testable statement about which existing PSI tests are the closest physical analogs of a condition PSI did not measure.

## Why this exists

PYRION's engine treats gravity as a regime barrier: a microgravity test is not directly comparable with a lunar-gravity target, and the verdict says so. That stays.

NASA's own combustion literature offers a published way to relate the two: the **flame stretch rate**. This document specifies how PYRION uses it, and where it stops.

## The NASA sources

1. Olson & T'ien, *Buoyant Low Stretch Diffusion Flames Beneath Cylindrical PMMA Samples* (NTRS 20000004509; Combustion and Flame 121(3), 2000), p. 3 — `data/raw/nasa/ntrs-20000004509/`:
   > "Equivalent stretch rates can be determined as a function of gravity, imposed flow, and geometry."
   > "The buoyant stretch rate could also be obtained through varying g, the gravity level. In this way the effect of partial gravity, such as those found on the Moon (1/6 g) or Mars (1/3 g) on material flammability can be examined at Earth's gravity through equivalence of flame stretch rates."
   It also reports, from Foutch & T'ien, that the extinction boundary was "almost identical for the buoyant, forced, and mixed convective environments they modelled."
2. Ferkul et al., *Material Flammability at Lunar and Martian Gravity*, LPSC 2026 (NTRS 20260001966), PDF p. 17 (slide 16): flammability boundary plotted against "Gravity Level (g/gEarth) or Characteristic Flow Speed (cm/s)"; PDF p. 18 (slide 17): "Numerical and experimental evidence suggests that Lunar gravity is nearly the most flammable condition."
3. Olson & Ferkul, *Microgravity Flammability of PMMA Rods in Concurrent Flow* (NTRS 20150008961), p. 7: "The flow-induced stretch around the approximately spherical rod tip is af = 3/2 U/R."
4. Urban et al., ICES 2025 (NTRS 20250006779), pp. 18–19: "35 cm/s was identified as a surrogate for 1-g buoyant flow"; "Higher temperature materials (Nomex and polycarbonate) may show decreased flammability at lunar gravity conditions."

## Definitions (as printed in source 1, p. 3)

| Quantity | Expression | Applies to |
|---|---|---|
| forced stretch | `a_f = 2·U∞/R` | cylinder of radius R in a flow U∞ |
| forced stretch, rod tip | `a_f = 3/2 · U/R` | approximately spherical rod tip (source 3) |
| buoyant stretch | `a_b = [ ((T* − Te)/T*) · g/R ]^(1/2)` (source 1, p. 11, Eqn. 1) | body of radius R at gravity g |
| mixed stretch | `a = a_f · (1 + a_b²/a_f²)^(1/2)` | both together; for `a_f = 0`, `a = a_b` |

Units: s⁻¹.

**The source prints the buoyant stretch two ways.** Page 3 writes `a_b = [(ρe − ρ*)/ρe] [g/R]^(1/2)`, with the exponent on `[g/R]` only. Page 11, Eqn. 1 puts the factor inside the root. PYRION uses the page 11 form: it is the one that reproduces the paper's own numbers (R = 2.5 to 200 cm gives 2 to 16 s⁻¹, p. 6; a = 1.8 to 11.9 s⁻¹ for T* = 865 to 990 K, p. 11). The page 3 form gives 1.6 to 13.9 s⁻¹ for the same radii.

The source gives no single factor. It gives T* = 865 to 990 K (p. 11) and a laboratory temperature of 22 °C (p. 6), so `(T* − Te)/T*` is a band, 0.659 to 0.702, and every buoyant stretch PYRION reports is a band, not a point.

## What PYRION computes

For a PSI microgravity test with a **curved sample of known radius** and a known forced flow: its stretch rate `a` (with `g = 0`, `a = a_f`).

For a target gravity level (Moon 0.165 g, Mars 0.38 g, Earth 1 g; the Mars value is cited to NTRS 20010074003, PDF p. 2, which lists "0.1, 0.16, and 0.38 g/gearth" without naming Mars, so it is a PYRION choice. Source 1 below prints "Mars (1/3 g)", a rounded value that the engine no longer uses. No sealed prediction uses a Mars level) and the same sample radius: the buoyant stretch `a_b(g)`, as a band if the density factor is a range.

A PSI test is a **transfer analog** of the target when its stretch rate falls inside the target's stretch band, **and** every other regime axis and continuous axis would otherwise be comparable (same material class, fuel phase, diluent; O2 and pressure handled as today).

## New engine result

`TRANSFER_HYPOTHESIS` — reported **in addition to**, never instead of, `REGIME_BARRIER`.

Each one carries: the formula used, the sources above with page, the inputs with their condition records, the stretch band, and the limits below. The UI must show it in a different visual language from measured evidence and must never count it as `APPLICABLE`.

## Limits (always shown with the result)

- **Geometry.** The expressions are for stagnation-point flow on curved bodies. Flat fabric sheets (SIBAL, Nomex in BASS, BASS-II, Saffire) have no radius R: for them PYRION does **not** compute a stretch rate. They can only be related through NASA's coarser flow-speed surrogate (source 2 and 4), reported as a separate, weaker class.
- **Material dependence.** The direction of the gravity effect depends on the material (source 4). An analog found for PMMA says nothing about Nomex.
- **Scale and time.** Sample size and test duration differ between an ISS glovebox, a centrifuge drop (about 5 s) and the lunar surface.
- **Pressure.** Stretch equivalence does not account for a pressure difference; pressure stays a separate axis.
- **It is a hypothesis.** FM2 (lunar surface) is designed to test this kind of bridge. Until then, nothing here is a prediction of flame behavior on the Moon.

## FM2 instrument balance (separate, simpler model)

A closed-chamber mass balance, not a flame model: from FM2's published chamber volume (14.4 L), pressure (8.2 psia) and starting oxygen fractions (37, 33, 29, 25 %; NTRS 20260001966, PDF pp. 5–10), and a hypothesised limiting oxygen fraction L, compute the oxygen that can be consumed before the atmosphere reaches L, and the fuel mass that consumes it for a stated stoichiometry. Assumptions (ideal gas, fixed temperature, mole change from products ignored) are stated with the output. Check case: source 2, PDF p. 26 (slide 25) reports PMMA at 34 % O2 / 8.2 psi, up to 1.2 g burned, final O2 13 to 21 %.
