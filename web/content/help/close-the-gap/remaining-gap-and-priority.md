---
id: remaining-gap-and-priority
title: "The remaining gap and the order of priority"
keywords: remaining gap, priority, solids first, order of priority, untested regime, what is not covered, cabin fires, which first
chapter: 5
order: 7
dataHelp: [gap-section-remaining, gap-section-priority, gap-section-solids, gap-section-gap]
sources: ["engine/src/experiments.ts", "NASA-STD-6001B PDF p. 28", "NTRS 20260001966 PDF p. 10", "NTRS 20250010653 PDF p. 12"]
---

**The remaining gap** is the part of PYRION's proposed matrix that the cited plans are not stated to cover. FM2's plan concerns one fabric at lunar gravity, not every partial-gravity level or solid material. LUCI coverage cannot be placed without stated numerical conditions. For other gravity regimes, the cited plans do not establish coverage.

**The order of priority** is a fixed rule, not a judgement:

1. **An untested regime first.** If PSI has no test in your gravity regime: "Run at least one test in partial gravity: PSI has none."
2. **Then solid fuel.** Solids are the gap that matters for cabin fires.
3. **Then the other fuel phases that are far outside** (or have no comparable test), **then outside, just outside, and combination.**

Why solids first: NASA-STD-6001B Test 1, FM2 and LUCI all burn solid specimens (each quoted in the plan), and PSI records a solid fuel for a number of investigations; solids are the gap that matters for cabin fires. This is a statement about what these documents test; it does not say liquids or gases are unimportant.

## For engineers

`remainingGap { points, sentence }` (`engine/src/experiments.ts`): `points` = matrix points not in `fm2Covered`. Sentences: partial gravity: "N of M test points are not stated to be covered by FM2; for LUCI, coverage is not stated by the source."; otherwise "All M test points remain: no planned experiment in the downloaded sources is stated to cover this gravity regime."

`priority: PriorityItem[]` with `kind` ordering key `_o`: `regime_untested` 0, `solid_fuel` 1 (when solid coverage is not APPLICABLE), `far_outside` or `no_comparable_test` 2, `outside` 3, `just_outside` 4, `combination` 5; ties by fuel phase name; `rank` = position + 1. `no_comparable_test` for liquid and gas is skipped when the whole regime is untested. Solid sentence: "Solid fuel: no comparable test exists at this condition, and solids are the case that matters for cabin fires." or "Solid fuel: just outside the tested data; solids are the case that matters for cabin fires." (level sentence lower-cased).

`solidsRationale { sentence, sources }`: "Solids first: NASA-STD-6001B Test 1, FM2 and LUCI all burn solid specimens (quoted below), and PSI records a solid fuel for N investigation(s); solids are the gap that matters for cabin fires." `sources` = `SOLIDS_RATIONALE_SOURCES`: NASA-STD-6001B PDF p. 28 (five 30 cm × 6.5 cm specimens), NTRS 20260001966 PDF p. 10 (fabric), NTRS 20250010653 PDF p. 12 (fabric and 4-mm rod). N counts investigations with a `fuel_phase` = solid record in the corpus.

Saffire and BASS are not named in the rationale: no repository source states that, so the sentence rests only on the three quoted documents.
