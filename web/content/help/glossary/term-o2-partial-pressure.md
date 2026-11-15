---
id: term-o2-partial-pressure
title: "Oxygen partial pressure"
keywords: oxygen partial pressure, po2, o2 partial pressure, psia, oxygen fraction times pressure, 2.788 psia
chapter: 11
order: 19
dataHelp: [ctl-oxygen-number, ctl-pressure-number]
sources: ["web/lib/expert/calculators.ts"]
---

The share of the total pressure that is oxygen: oxygen fraction times total pressure. 34 % oxygen at 8.2 psia is 2.788 psia of oxygen; 21 % at 14.7 psia is 3.087 psia. It is computed by code, never by a language model.

## For engineers

`o2PartialPressure(o2, pressure)` (`web/lib/expert/calculators.ts`) parses with `parseQuantity` and uses the table `TO_KPA` (psia 6.894757). Margin points of the test matrix are defined on it.
