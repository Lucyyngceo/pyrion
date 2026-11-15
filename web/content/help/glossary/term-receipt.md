---
id: term-receipt
title: "Receipt"
chapter: 11
order: 22
dataHelp: [result-receipt, bridge-receipt, chart-table-receipt]
sources: ["engine/src/verdict.ts"]
---

The records, with their sources and DOI, that stand behind a statement. A verdict or an answer without a receipt cannot be checked, so every result carries one.

## For engineers

`Reason.citations` and `AnswerCitation.recordIds` (`engine/src/verdict.ts`, `engine/src/answer.ts`): `accession|test|variable|source file|location`.
