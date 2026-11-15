---
id: term-status
title: "Record status"
chapter: 11
order: 26
dataHelp: [data-evidence-status]
sources: ["engine/src/types.ts"]
---

How far a record has been checked: *extracted* (read from the source with its quote), *verified* (a person checked it against the source) or *insufficient evidence* (the source does not state it clearly enough; never counted).

## For engineers

`RecordStatus = 'extracted' | 'verified' | 'insufficient_evidence'`; `EngineOptions.minimumStatus` selects `'extracted'` (default) or `'verified'` (`engine/src/types.ts`, `counts` in `engine/src/evidence.ts`).
