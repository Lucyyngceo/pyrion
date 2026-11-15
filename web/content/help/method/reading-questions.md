---
id: reading-questions
title: "Reading a question: code first"
keywords: reading a question, extractor, extract quantities, how the app reads my question, code first, leftover, ask box, parse, typed question
chapter: 10
order: 4
dataHelp: [tars-bubble]
sources: ["engine/src/extract.ts"]
---
When you type a question, code first looks for recognised quantities: oxygen next to a percent or fraction, pressure with a unit, a gravity level, or a gravity name such as Moon, Mars, microgravity or normal gravity. It preserves the matched input text; code performs the unit conversions.

If it cannot assign a number, it reports the unresolved input rather than silently treating it as a condition. For example:

- A “2 mm sheet” does not establish thickness; “2 mm thick” states it explicitly.
- An oxygen partial pressure is not the total pressure needed for the condition.
- Conflicting pressures or a gravity level that disagrees with a gravity name require clarification.
- An unrecognised spelling may not be parsed.

TARS can help interpret a question, but a language model does not decide a verdict or replace the unit-conversion code. Check the interpreted condition and correct it if necessary. The live chat does not guarantee a separate confirmation step before computing an answer.

## For engineers

`extractQuantities(question)` in `engine/src/extract.ts` returns matched quantity text, unresolved input and issues. `targetFromQuantities` in `engine/src/quantity.ts` parses and converts the quantities. The extractor uses context around numbers to distinguish oxygen, total pressure, flow, thickness and ambient temperature. The parser supports additional language aliases; the implementation is the reference for that vocabulary. Tests cover ambiguous values and conflicting gravity descriptions.
