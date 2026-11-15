---
id: what-the-engine-does-not-do
title: "What the engine does not do"
chapter: 12
order: 1
dataHelp: [bridge-limits, ai-limits]
sources: ["engine/src/verdict.ts", "engine/README.md"]
---

PYRION's engine is a **filing and comparison system with strict rules**. It is not a fire simulator. Specifically, it does not:

- **Simulate or predict flames.** There is no solver and no CFD. It never says how a flame would behave on the Moon.
- **Interpolate behaviour.** "Inside the tested region" means the numbers are within what was measured. It does not claim the flame behaves smoothly between measurements: combustion can change abruptly near limits such as extinction.
- **Say that something is safe or unsafe.** A verdict is about comparability with recorded tests, nothing more.
- **Cross regimes.** A different gravity, fuel phase, diluent or flame type is a different situation, never a "long distance".
- **Fill in what a record does not state.** If the extracted records of an investigation do not state something, the engine says so ("insufficient evidence") and does not assume it.
- **Know anything outside PSI.** It speaks only about the PSI records it has. It says "in PSI" and never "no data exists".
- **Read documents or the web on its own.** It reads condition records; they are extracted, with quotes, by a separate process that checks every number against its source.
- **Use a language model to decide.** See "The model never decides".

What it does do is small and checkable: it compares your condition with each investigation's recorded conditions, by fixed rules, and shows its work.

## For engineers

Structural reasons in the code:

- No physics model: `engine/src` contains geometry (`engine/src/geometry.ts`), unit conversion (`engine/src/quantity.ts`), comparison rules (`engine/src/verdict.ts`) and text builders; the stretch-rate and chamber-balance modules (`engine/src/stretch.ts`, `engine/src/fm2.ts`) are labelled hypotheses and instrument arithmetic respectively (see "Hypotheses and proposals").
- Regimes are barriers: `distance = null` across a barrier (`engine/src/verdict.ts`).
- Unknown is a result: `INSUFFICIENT_EVIDENCE`; records with status `insufficient_evidence` never count (`counts`, `engine/src/evidence.ts`).
- Wording rules enforced by tests: no "no data exists", no "undefined", no snake_case or enum names in sentences, at most 4 significant figures (`engine/test/wording.test.ts`, `answer.test.ts`).
- Dependencies: zero; the engine imports no Node module except `engine/src/load.ts` (file reading for tests and the CLI).
