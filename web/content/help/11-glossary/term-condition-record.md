---
id: term-condition-record
title: Condition record
chapter: 11
order: 4
dataHelp: [result-receipt, chart-table-receipt]
sources: ["schema/condition_record.schema.json", "engine/src/records.ts"]
---

One measured value of one test of one investigation, with the unit as written, the exact quote it came from and where the quote is (file and location). The engine only knows what is written in these records.

## For engineers

Fields: `accession, test_id, variable, value, unit, value_original, unit_original, method, source_file, source_location, quote, status, note` (`RECORD_FIELDS`, `engine/src/types.ts`; validated by `parseConditionCsv`, `engine/src/records.ts`). `test_id` `*` applies to every test of the investigation unless the test has its own record for that variable.
