---
id: hypotheses-and-proposals
title: "Hypotheses and proposals are not evidence"
keywords: hypothesis, bridge, stretch rate, analog, transfer, fm2 balance, proposal, not evidence, microgravity to moon, flat sheets
chapter: 12
order: 6
dataHelp: [bridge-hypothesis-tag, bridge-limits, bridge-intro]
sources: ["engine/src/transfer.ts", "engine/src/fm2.ts", "NTRS 20000004509", "NTRS 20150008961"]
---

Two parts of PYRION go beyond comparing recorded conditions, and both are labelled so they cannot be taken for evidence.

**The bridge from microgravity to the Moon (a hypothesis).** In some flames, the flow of gas past the sample matters in much the same way as gravity does: a "stretch rate" is a number that combines them. NASA papers give formulas for it. PYRION uses them to ask: *could a microgravity test with this flow be in the same stretch range as a flame at lunar gravity?* A test whose range falls inside is a **candidate analog hypothesis**. It is never counted as evidence and never makes an investigation Applicable. The limits are stated with every result: the formulas are for round samples (cylinders, rod tips), not flat sheets; the effect of gravity depends on the material; the sample size and test duration differ between an ISS glovebox, a centrifuge drop (about 5 s) and the lunar surface; pressure is a separate axis that the stretch equivalence does not cover; and it is a hypothesis that an experiment like FM2 is designed to test.

**The FM2 chamber arithmetic.** A closed-chamber oxygen balance computed from FM2's published chamber volume, pressure and starting oxygen. It is arithmetic about an instrument, with every assumption stated (ideal gas, fixed temperature, products ignored); it is not a flame model.

**"What would close this gap"** is a proposal, labelled as one.

## For engineers

`engine/src/transfer.ts`: `TRANSFER_HYPOTHESIS` results have `kind: 'TRANSFER_HYPOTHESIS'`, `evidenceClass: 'hypothesis'`, `countsAsApplicable: false`; they are reported in addition to REGIME_BARRIER and never change `evaluate()`. Limits (`TRANSFER_LIMITS`, `engine/src/transfer.ts:107`): geometry (stagnation-point flow on curved bodies; flat fabric sheets have no radius R, so no stretch rate); material dependence (NTRS 20250006779, pp. 18-19); scale and time; pressure stays a separate axis; "It is a hypothesis."

Formulas (`engine/src/stretch.ts`): forced stretch of a cylinder `a_f = 2 U / R` (NTRS 20000004509 p. 3), rod tip `a_f = 3/2 U / R` (NTRS 20150008961 p. 7), buoyant `a_b = [((T* - Te)/T*) g/R]^1/2` (NTRS 20000004509 p. 11, Eqn. 1; a differently printed form on p. 3 is documented as a discrepancy and not used), mixed `a = sqrt(a_f² + a_b²)`; all inputs are bands and results are bands.

`engine/src/fm2.ts`: `fm2Balance`, `fm2FinalO2`, `fm2Chamber` (volume 14.4 L, 8.2 psia ± 0.3 psi, starting oxygen 37, 33, 29, 25 %, NTRS 20260001966); temperature is a required input and is never defaulted; the check case (PMMA at 34 %, 8.2 psi, 1.2 g burned, NASA estimate of final oxygen 13 to 21 %) is on PDF p. 26.
