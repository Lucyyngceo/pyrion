---
id: term-blocker
title: "Blocker"
chapter: 11
order: 2
dataHelp: [result-blocker-action]
sources: ["engine/src/verdict.ts"]
---

A **blocker** is the fixed reason why an investigation is not comparable with your condition: something was not recorded, cannot be used, was tested only in another regime, and so on. A blocker has a code, a plain sentence and sometimes an action.

## For engineers

`Blocker { code, axis, testedValues?, sentence, action? }`; codes `AXIS_NOT_RECORDED`, `NO_USABLE_VALUE`, `REGIME_NOT_TESTED`, `RECORDS_DISAGREE`, `AXES_NOT_RECORDED_TOGETHER`, `VALUES_NOT_PAIRED` (`engine/src/types.ts`; produced by `blockersOf`, `engine/src/verdict.ts:100`). See "Why an investigation is not comparable: the blocker codes".
