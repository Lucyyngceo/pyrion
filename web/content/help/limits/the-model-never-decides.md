---
id: the-model-never-decides
title: "The model never decides"
keywords: model never decides, language model, llm, ai, who decides, numbers from code, quotes checked, expert knowledge, trust, hallucination
chapter: 12
order: 2
dataHelp: [ask-box, tars-honesty]
sources: ["engine/src/answer.ts", "web/lib/expert/claims.ts", "web/lib/expert/calculators.ts"]
---

A language model is used for two jobs only: understanding what you typed and wording an answer. It is never allowed to decide a verdict, convert a unit or do arithmetic.

- **Verdicts** come from the engine's rules. Swap the model and the verdict, and the fingerprint, do not change.
- **Units and numbers** come from code. When a model must quote a number (an oxygen partial pressure, a conversion), it has to call a calculator, and the number it writes must be the one the calculator returned. In a benchmark of three models on expert questions, all three put at least one wrong number in; that is why this rule exists.
- **Quotes from NASA** are checked by code: the quote must be on the page of the document the model cites, with the numbers exactly as written (1.5 is never accepted for 15). If the quote is not there, the whole statement is dropped and not shown.
- **General background knowledge** is allowed, but it is always labelled "TARS own reasoning — not verified against a source", and any number in it that does not come from a calculator or a verified quote is replaced by "[number removed: not from a source]".

A model can still misunderstand a question. That is why the extractor reads the question first by code, shows you what it understood, and lets you correct it before anything is computed.

## For engineers

- `threePartAnswer` (`engine/src/answer.ts:87`) builds the content from engine results; the model only words it.
- `checkAnswer(answer, { corpus, engine, tools })` (`web/lib/expert/claims.ts`): layers `nasa`, `engine`, `expert`. `nasa`: every citation must pass `citationProblem` (document and page exist, at least 15 letters, `quoteFound` letters-only match with elisions, `numbersFound` numbers as written: same rules as `validation/run_all.py`); one failure drops the block, its text is not in the output. `engine`: needs a reference to an engine output; numbers (also ×100 for fractions) and ids (PSI-nn, DOI) must be in it, else dropped. `expert`: label `EXPERT_LABEL`; untraced numbers replaced by `NUMBER_REMOVED` and logged in `report.flaggedNumbers`.
- Calculators (`web/lib/expert/calculators.ts`): `o2PartialPressure`, `convertPressure`, `convertTemperature`, `compareAtmospheres`, `gravityValue`; each returns `provenance: "computed by code (...)"`.
- Extraction first: `extractQuantities` (`engine/src/extract.ts:83`).
