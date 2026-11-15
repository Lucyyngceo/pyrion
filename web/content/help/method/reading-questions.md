---
id: reading-questions
title: "Reading a question: code first"
keywords: reading a question, extractor, extract quantities, how the app reads my question, code first, leftover, ask box, parse, typed question
chapter: 10
order: 4
dataHelp: [tars-bubble]
sources: ["engine/src/extract.ts"]
---

When you type a question, **code reads it first**. A deterministic extractor looks for what it can recognise with certainty: an oxygen figure next to the word oxygen, a pressure with its unit, a gravity as "0.165 g" or a word like "Moon", "Luna", "microgravity", "freefall" or "on the ground". It hands back the words **exactly as you wrote them**; the unit conversion is done afterwards by the conversion table, never by a model.

The extractor never guesses. If a number cannot be assigned, it is set aside as "left over" and reported. Some examples of what it will not assume:

- "a 2 mm sheet" is not a thickness (a length may be a width); only "2 mm thick" is.
- "ppO2 of 21 kPa" is a partial pressure, not the total pressure the engine needs: it is not used, and it says why.
- Two different pressures in one question are not resolved by picking one; both are reported.
- A gravity number that disagrees with a gravity word ("lunar base at 1 g") is reported, not resolved.
- Typos ("oxigen") are not corrected.

What the extractor cannot read is left for the next step, where TARS SI (a language model) may help to *understand* the question, but never to convert or compute: its numbers must come from code.

## For engineers

`extractQuantities(question)` (`engine/src/extract.ts:83`) returns `{ gravity?, o2?, pressure?, flow_velocity?, sample_thickness?, ambient_temperature?, leftover[], issues[] }` (raw substrings of the question), ready for `targetFromQuantities` (`engine/src/quantity.ts:682`). Text is folded (lower case, accents removed, same length) for matching only; the raw string is sliced from the original.

Rules:

- **Numbers:** `NUMBER_RE` excludes numbers inside words and codes ("PSI-12", "ppO2", "H2O").
- **Oxygen:** a number followed by `%`, `percent`, `per cent`, `por ciento`, `vol%`, `mol%` **with an oxygen word (`o2`, `oxygen`, `oxigeno`) within 30 characters**; or "oxygen fraction of 0.34" / "fracción molar de oxígeno de 0,34" (the number alone).
- **Pressure:** number + `kpa|pa|atm|atmosphere(s)|bar|mbar|psia|psig|psid|psi|mmhg|torr|barg|kpag` (+ "abs" / "(g)" qualifiers; a gauge unit is kept so the parser refuses it); phrases "sea level pressure", "normal/standard air pressure", "nivel del mar", "presión normal". A number within 25 characters after `pp O2`, "partial pressure" or "presión parcial" is an issue `partial_pressure` and goes to `leftover`.
- **Gravity:** number + `g`/`gE`/`g0` or `1/6 g`; keywords as whole words (`GRAVITY_KEYWORDS`, `engine/src/quantity.ts`): moon, lunar, luna; mars, martian, marte, marciano; earth, ground, terrestrial, tierra, terrestre, normal gravity; microgravity, microgravedad, freefall, free fall, weightless, orbit, orbital, ISS, ingravidez, caída libre, gravedad cero, zero-g, micro-g, µg. Two classes: issue `ambiguous_gravity`; number and keyword disagreeing: issue `gravity_conflict`.
- **Flow, thickness, ambient temperature:** number + unit and a context word within 40, 30 and 40 characters (`flow|wind|velocity|flujo`, `thick|espesor|grosor`, `ambient|room temperature|cabin temperature|ambiente`).
- **Several values** for one quantity: kept only if all parse and agree within 0.5 %; otherwise issue `multiple_values` and all go to `leftover`.

`parseQuantity` also finds gravity keywords anywhere in a text that does not start with a number (`gravityFromKeywords`); two classes give `ambiguous_gravity`. Tests: `engine/test/extract.test.ts` over the 31 questions and 11 traps of `validation/judge_battery/questions.json` (English and Spanish).
