# PYRION applicability engine

Given a target condition (gravity regime, fuel phase, diluent, flame type, O2 mole fraction, pressure, …) and the condition records extracted from NASA PSI, the engine says, for every investigation and every group of tests inside it, whether that evidence applies to the target. It also returns the geometry of the measured envelope for the chart, and the exact records behind every statement.

The verdict is computed by code. No language model takes part in it, and nothing in it is random, time-dependent or locale-dependent: the same records and the same target give byte-identical output. A language model can parse a question into a target and narrate a result. It cannot change the verdict.

What a verdict means, and what it does not mean:

- `APPLICABLE` means the target lies **inside the conditions that were measured**, by the rules below. It does not mean the measured outcome transfers to the target, and it is not a safety statement.
- The engine does not model combustion. It compares conditions.

## Input

The engine reads only **condition records** as defined in [`schema/README.md`](../schema/README.md): `data/conditions/<accession>.csv`, one value of one variable for one test, with its source file and location.

Every row is checked before use. A row is **rejected** (listed, never used) if it breaks a schema rule: missing field or quote, unknown variable, regime value outside its list, O2 not given as a fraction, pressure not in kPa. For rows that count as evidence the engine also requires a plain number or an ascending range `lo..hi`, in the schema unit of its axis, within physical limits (O2 between 0 and 1, pressure above 0).

Record status:

| `status` | Counted as evidence? |
|---|---|
| `verified` | yes |
| `extracted` | yes by default; no with `minimumStatus: 'verified'` (CLI `--verified-only`) |
| `insufficient_evidence` | **never**. It is listed in the receipt as "present but not counted". |

Every verdict says `evidenceStatus: 'verified'` only if every record it used was verified by a person; otherwise `includes_unverified`.

## Tests and clusters

- A **test** is one `test_id` of an investigation. A record with `test_id = *` applies to every test of that investigation, unless the test has its own record(s) for the same variable. Then only the test's own records count, even if all of them are flagged `insufficient_evidence`: a flag on a test is never overridden by a general value.
- A **cluster** is the set of tests of one investigation that share the same regime values. Each cluster gets exactly one verdict. An investigation gets the best verdict among its clusters, in the order `APPLICABLE` > `EXTRAPOLATION` > `INSUFFICIENT_EVIDENCE` > `REGIME_BARRIER`, and the output names the cluster that gave it.

## The verdict

Checked in this order.

**1. Regime axes: `gravity_regime`, `fuel_phase`, `diluent`, `flame_type`.** These are barriers, not distances.

- Target and evidence state different values → `REGIME_BARRIER`. The distance is **undefined** (`null` in the output). It is never a large number and a barrier is never ranked against other evidence. Across a change of regime the measured numbers are not interpolated.
- The target states a value and the evidence does not (no record, or only flagged records), or the evidence records disagree → `INSUFFICIENT_EVIDENCE`.
- An axis the target **leaves open** is not compared. Every verdict lists it as "left open by the target, so not compared", and `openRegimeAxes` in the output names those axes. A barrier on one axis decides alone; a missing value on another axis is then reported as context.

**2. Continuous axes** (`o2_mole_fraction`, `burner_o2_mole_fraction`, `pressure`, `flow_velocity`, `sample_thickness`, `droplet_diameter_initial`, `ambient_temperature`, `gravity_level`). Only the axes the target states are used.

- Only tests that have a usable value on **every** axis the target uses form the envelope ("complete tests"). The others are listed and left out.
- No complete test → `INSUFFICIENT_EVIDENCE`, naming the missing axis.
- For each axis, the measured range is the minimum and maximum over the complete tests. A range record `lo..hi` contributes both ends. The target is `inside`, `below` or `above` it; outside, the output gives the gap in the axis unit and as a fraction of the axis scale (below), and cites the record that sets the bound.

**3. The 2-D envelope in the (O2 mole fraction, pressure) plane.** When the target states both, the target must also lie inside the **convex hull** of the measured (O2, pressure) points of the cluster. This is the polygon the chart draws.

- A point on the boundary counts as inside (tolerance 1e-9 in normalized units).
- A test with one O2 value and several pressures, or the reverse, gives one point per value. A test with several O2 values **and** several pressures, without saying which go together, is not plotted: it still bounds the per-axis ranges, but it does not widen the hull. If no test of a cluster can be plotted, the result is `INSUFFICIENT_EVIDENCE`.

**4. Result.** Inside every range and inside the hull → `APPLICABLE`. Outside any range or outside the hull → `EXTRAPOLATION`, with the axes and gaps.

Behind a barrier, the continuous checks are still computed and returned, marked `informational: true`. They are context for the chart. They never change the verdict and never produce a distance.

## Distance and ranking

`APPLICABLE` clusters are ranked first, then `EXTRAPOLATION`, each nearest first. `INSUFFICIENT_EVIDENCE` and `REGIME_BARRIER` are listed after them and have no rank.

- **Normalization.** Each continuous axis is divided by its scale: the range (max − min) of all values that count as evidence on that axis, in all investigations and all regimes. If an axis has a single value, the scale is that value's magnitude; with no value, 1. The scales used are part of every output (`normalization`). Axes are linear: no logarithm, on pressure or anything else.
- **Distance.** Euclidean distance, in normalized units, from the target to the **nearest measured point** of the cluster, over the axes the target states. The nearest point and its records are cited.
- Ties are broken by accession number, then by cluster key. If no test pairs its values unambiguously, the distance is `null` and the cluster ranks after the others of its verdict.

Because the scales come from the data, adding records can change distances (never the verdicts, which do not depend on the scales).

## The receipt

Every reason carries `citations`: the records that justify it, with `accession`, `test_id`, `variable`, `value`, `unit`, `value_original`, `unit_original`, `note`, `status`, `method`, `source_file`, `source_location` and `quote`. Bounds cite the records that set the minimum and maximum; the hull cites its vertices; a barrier cites the regime records; a missing value cites the flagged records, if any. DOIs are not part of condition records: join on `accession` with [`data/manifest/investigations.csv`](../data/manifest/investigations.csv).

## Target presets

Presets are data in [`src/presets.ts`](src/presets.ts). Each value keeps its original wording, its conversion and the sentence it comes from.

| Preset | O2 | Pressure | Gravity | Source of the atmosphere |
|---|---|---|---|---|
| `challenge-lunar-base` | 0.30 | 10.2 psi = 70.33 kPa | partial, 0.16 g | Challenge statement: "The intermediate oxygen concentration used on the Moon will likely be 30% or greater, with a corresponding pressure of 10.2 psi or less." |
| `nesc-10.2psia-26.5o2-lunar` | 0.265 | 10.2 psia = 70.33 kPa | partial, 0.16 g | NASA/TM-20260003925 (NESC), p. 13: "nominal cabin atmospheres of 10.2 pounds per square inch absolute (psia) with 26.5% O2, and 8.2 psia with 34% O2" |
| `nesc-8.2psia-34o2-lunar` | 0.34 | 8.2 psia = 56.54 kPa | partial, 0.16 g | same |

Lunar gravity, 0.16 g, is from NTRS 20210020446 (Ruff, *Impact of Lunar Gravity on Material Flammability*, 2021), p. 3: "glunar = 0.16 gearth". 1 psi = 6.894757293168361 kPa.

Limits of the presets, also stored with each preset:

- The challenge gives a band (30 % or more, 10.2 psi or less). The preset is the corner of that band. The engine checks points, not bands.
- The NESC report considers these atmospheres for surface habitats but does not state a gravity level. PYRION pairs them with lunar gravity because the challenge is about the Moon Base. NESC also considers up to 40 % O2 at 8.2 psia for flammability.
- No source states a fuel phase, diluent or flame type for these targets, so the presets leave them open. A user can fill them in (`presetTarget(id, { fuel_phase: 'solid' })`).

## Use from code

```ts
import { parseConditionCsv, evaluate, buildEnvelopes, locateTarget, presetTarget, canonicalJson } from '../engine/src/index.ts';

const { records, rejected } = parseConditionCsv(csvText, 'PSI-69.csv', 'PSI-69');
const result = evaluate(records, presetTarget('challenge-lunar-base'));        // verdicts, ranking, receipts
const envelopes = buildEnvelopes(records);                                     // points + hull per regime combination
const marker = locateTarget(presetTarget('challenge-lunar-base'), envelopes);  // where the target sits, geometry only
```

- `src/index.ts` is pure TypeScript with no Node built-ins: it runs in a browser. File loading is in `src/load.ts` (`loadConditionDir`), which uses `node:fs`.
- Imports use `.ts` extensions (Node runs TypeScript by stripping types). A TypeScript project that imports the engine needs `"allowImportingTsExtensions": true` (allowed with `noEmit`). Next.js also needs to compile files outside its folder (`experimental.externalDir: true`) or a copy of `engine/src`.
- `buildEnvelopes(records, { groupBy: ['gravity_regime'] })` merges envelopes that differ only on the other regime axes. The default groups by all four, like the verdict. The hull of one investigation in the default grouping (`regimes[].investigations[].hull`) is the hull its verdict uses.
- The hull is computed in normalized coordinates, which is a linear rescaling of each axis. A convex hull does not change under linear rescaling, so the hull returned in raw units (O2 fraction, kPa) is exactly the decision hull. Draw it on linear axes.

## Command line

```bash
node engine/cli.ts                       # all presets against data/conditions/*.csv
node engine/cli.ts --preset challenge-lunar-base
node engine/cli.ts --verified-only       # count only human-verified records
node engine/cli.ts --json > verdicts.json
node engine/cli.ts --fixtures            # SYNTHETIC test data, clearly labelled
```

Node 24 or later. No dependencies.

## Transfer hypotheses and the FM2 balance (docs/TRANSFER.md)

These are separate from the verdict. They never change `evaluate()` and never produce `APPLICABLE`.

**`src/stretch.ts`: flame stretch rate** (Olson & T'ien, NTRS 20000004509; Olson & Ferkul, NTRS 20150008961). Forced stretch of a cylinder `2U/R` and of a rod tip `3/2 U/R`, buoyant stretch, and mixed stretch `a = a_f (1 + a_b²/a_f²)^½`. Units: U in cm/s, R in cm, result in s⁻¹. Every result carries the formula id, the formula, its inputs and the source (file under `data/raw/nasa/`, page, quote). Any input may be a band `{lo, hi}`; the result is then a band.

- **The density factor is not one number in the source.** The paper gives T\* = 865 to 990 K and a lab temperature of 22 °C (pp. 11 and 6), so `DENSITY_FACTOR_PMMA_AIR` is the band 0.659 to 0.702, computed as `(T* − Te)/T*` (ideal gas, ρ ∝ 1/T). It holds for PMMA flames in air only. For any other material the factor is a required input and the engine refuses to guess.
- **One buoyant formula.** `a_b = [((T*−Te)/T*)·g/R]^½`, Eqn. 1 on p. 11 (id `OT2000-ab-eq1`). The density factor is a band from T\* = 865 to 990 K and Te = 22 °C, with the ρ ∝ 1/T assumption stated in each result; every `a_b` is a band.
- **Documented discrepancy.** The same paper prints the factor outside the root on p. 3 (`[(ρe−ρ*)/ρe]·[g/R]^½`). That form does not reproduce the paper's own numbers (R = 2.5 to 200 cm gives 2 to 16 s⁻¹, p. 6): it gives about 14 s⁻¹ at 2.5 cm, against 16 for Eqn. 1. The engine uses only Eqn. 1; `test/stretch.test.ts` shows both forms against the paper's numbers.

**`src/transfer.ts`: `TRANSFER_HYPOTHESIS`.** For a target with a gravity level other than microgravity (`GRAVITY_TARGETS`: Moon 0.165 g, Mars 0.38 g, Earth 1 g; `withGravity(target, 'moon')`), `transferHypotheses(target, tests)` lists the microgravity tests of a rod or cylinder with a known radius and flow, the test's stretch band, the buoyant-stretch band of a body of the same radius at the target gravity, and the relation `within`, `overlap` or `outside`. `isAnalog` is true only for `within` with no regime axis (fuel phase, diluent, flame type) that the target states being different or unknown for the test. O2 and pressure differences are reported, not gated: pressure stays a separate axis. Each result has `countsAsApplicable: false`, the formula ids, the sources, the input records and the five limits of the spec (`TRANSFER_LIMITS`), including that flat sheets have no radius and get no stretch rate.

- A test is used only if a source states its gravity regime as microgravity. `data/derived/bass2_flow_steps.csv` has no such column and the condition records of PSI-25 state none yet, so the tests from `transferTestsFromFlowSteps(csv, { gravityRegime })` are excluded until the caller passes a regime it can cite.
- The table does not say how a rod sits in the flow. `rodFormula` (`rod_tip` by default, or `cylinder`) is an explicit choice and is repeated in each result.
- The flow of a BASS-II test is a series of display readings (response time about one minute). The test's stretch is the band from its lowest to its highest reading.
- The Mars level is 0.38 g, cited to NASA GSFC NSSDC, "Mars Fact Sheet" (https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html, last updated 19 May 2025), row "Surface gravity (mean) (m/s2)": Mars 3.73, Earth 9.82, ratio 0.380 (`SOURCES.marsGravity`). NTRS 20010074003 (PDF p. 2, "partial-gravity environments of 0.1, 0.16, and 0.38 g/gearth") is cited only as "0.38 g is one of the partial-gravity levels used in NASA combustion studies", never as the source of the Mars value. NTRS 20000004509 (PDF p. 3) prints "Mars (1/3 g)", a rounded value; it is no longer used.
- NTRS 20260001966 is cited by PDF page, with the printed slide number beside it ("PDF p. 17 (slide 16)"): the slide number is the PDF page minus one.

**`src/fm2.ts`: FM2 chamber balance.** `fm2Balance(inputs)` and `fm2FinalO2(inputs, fuelMassG)`: ideal gas, fixed temperature, total moles constant (the mole change from products is ignored), O2 demand per gram of fuel as an input. Inputs are `Sourced` values (value, unit, source); `fm2Chamber` fixes the published volume (14.4 L, p. 6) and pressure (8.2 psia, p. 10). The chamber temperature is **not** in the source and is a required input. The limit L is a hypothesis supplied by the caller. Assumptions and formulas are returned as data. Check case (NTRS 20260001966, p. 26): PMMA, 34 % O2, 8.2 psia, up to 1.2 g burned, with 1.9176 g O2 per g of PMMA (C5H8O2, derived, not from NASA) gives a final O2 of 12.7 % at 290 K, 12.3 % at 295 K and 12.0 % at 300 K, against NASA's 13 % to 21 %. 1.2 g is the most the source says was burned, so these are the lowest values the model gives, about one percentage point under NASA's lower bound.

```bash
node engine/cli.ts --transfer              # transfer candidates from data/derived/bass2_flow_steps.csv
node engine/cli.ts --transfer --assume-microgravity PSI-25
```

`--assume-microgravity` is an operator's assumption, printed as such in the output; it is not a record.

## Tests

```bash
cd engine
node --test "test/**/*.test.ts"
```

They cover: byte-identical output for the same input, in any record order; a partial-gravity lunar target against microgravity evidence (`REGIME_BARRIER`, no distance, no rank); an in-range target (`APPLICABLE`); O2 out of range (`EXTRAPOLATION` naming the axis and the gap); inside every range but outside the hull (`EXTRAPOLATION`); missing O2 and missing regime (`INSUFFICIENT_EVIDENCE`); a record flagged `insufficient_evidence` never widening the envelope; the CSV reader and the schema checks; presets and unit conversions; the envelope export; stretch formulas (algebra and the paper's own range); transfer hypotheses; the FM2 balance and its check case.

The fixtures in [`test/fixtures/synthetic/`](test/fixtures/synthetic/) are **invented test data, not NASA data**. Their accessions (`PSI-9001` to `PSI-9007`) do not exist in PSI, and every row says so.

Type check (optional, uses the TypeScript already installed for the web app): `node ../web/node_modules/typescript/bin/tsc -p tsconfig.json`.

## Limits

- **The convex hull assumes the measured region is filled in.** A target inside the hull may still be far from every test, if the tests sit on the edges. The nearest-point distance is reported for that reason.
- **Only O2 and pressure have a joint (2-D) check.** The other axes are checked one at a time, so a combination of values that each lie inside their own range can still be untested.
- **All tests of a cluster are pooled.** Tests that differ in something the schema does not encode (geometry, material, flow configuration) share one envelope. The descriptive values of each cluster are returned (`descriptors`) so the difference is visible.
- **Measurement uncertainty is not modelled.** Values are used as written in the source. A target near a bound is "inside" or "outside" by the stated value only.
- **Targets are points.** A band such as "30 % O2 or more" is checked at one point of it.
- **The verdict is only as good as the records.** A value that is wrong in the records gives a wrong verdict. That is why every reason cites the records it rests on, and why `evidenceStatus` says whether a person has checked them.

## Units: `parseQuantity` and `targetFromQuantities`

Models never convert units; the engine does. `parseQuantity(text, variable)` turns text such as `"8.2 psia"`
into a value in the schema unit, with the factor and its source, or returns a typed error (`ok: false`, `code`,
`message`). Nothing is guessed: a missing unit, a range, a decimal comma, a gauge pressure (`psig`, `barg`:
gauge is not absolute) or a value outside the plausible range is an error.

The factors are the table of `validation/run_all.py` (`TO_KPA`, `CONVERSIONS`, `BOUNDS`); a test compares
this file with that one. (`psi` there is 6.894757; the engine's `KPA_PER_PSI` has more digits, they agree to 1e-7.)

- pressure: kPa, Pa, atm, bar, mbar, psi, psia, mmHg, torr → kPa (`psi` is read as absolute and says so)
- oxygen: `34 %`, `34%`, `34 vol%`, `0.34`, `34` → fraction. Bare number > 1 is percent, ≤ 1 is a fraction; the rule
  applied is returned in `rule`. A written unit wins (`0.34 %` is 0.0034, with a note).
- flow: cm/s, mm/s, m/s → cm/s. thickness: mm, cm, µm, in → mm. temperature: K, °C → K.
- gravity: `0.165 g`, `1/6 g`, `lunar` (0.165 g, NTRS 20260001966 PDF p. 13 (slide 12)), `mars` (0.38 g, NASA NSSDC Mars Fact Sheet),
  `microgravity` (sets the regime, asserts no level).

`targetFromQuantities({ gravity, o2, pressure, ...})` returns a validated `Target` and the list of conversions
(`display`: `"8.2 psia → 56.54 kPa (×6.894757)"`), or every error with its field name.

Plausibility warnings (not errors; the value is still returned): `Quantity.warnings` is non-empty when O2 is
outside 0.05–0.60 or pressure outside 20–120 kPa (`HABITAT_WINDOWS`), e.g. `0.34 %` O2 → 0.0034 with
"far below any breathable atmosphere ... did you mean 34 %?".

Vocabulary also accepted: `normal/standard/sea-level air pressure`, `1 atmosphere`, `1 atm` (101.325 kPa, with a note);
`34% O2`, `34 % oxygen`, `34 vol% of oxygen` (trailing gas name ignored, with a note); `lunar gravity`, `the Moon`,
`Moon gravity`, `Martian gravity`; `22 degrees C`, `22 degrees Celsius`. Gravity levels from 0 to < 0.01 g
(`MICROGRAVITY_BELOW_G`, a PYRION convention, not a NASA value; see `MICROGRAVITY_CONVENTION_NOTE`) are regime `microgravity`, 0.01 to < 1 g `partial_gravity`, 1 g
`normal_gravity`; negative or above 3 g is an error.

Gravity and the Target (deep audit): a gravity level or name only selects `gravity_regime`; it is never a continuous
axis, because no condition record carries `gravity_level`. The level is kept in `target.informational.gravity_level`
(shown, never compared). Regimes by level: below `MICROGRAVITY_BELOW_G` (0.01 g) microgravity; 0.01 g up to
`NORMAL_GRAVITY_BAND.lo` (0.9 g) partial; 0.9 to 1.1 g normal (both cuts are PYRION conventions, not NASA values;
`MICROGRAVITY_CONVENTION_NOTE`, `NORMAL_GRAVITY_CONVENTION_NOTE`). Above 1.1 g no regime exists: the Target carries
`informational.gravity_not_covered` (`ABOVE_NORMAL_GRAVITY_MESSAGE`) and `evaluate()` returns INSUFFICIENT_EVIDENCE
for every cluster with that message as the reason, never a silently open axis. More names are accepted: Earth,
Earth gravity, normal gravity, `1 g Earth`, micro-gravity, zero-g, zero gravity, weightlessness, ISS (microgravity),
`sea level` (101.325 kPa), `kPa abs`, `psia (absolute)`, `mol%`, `per cent`. The O2 and pressure plausibility windows
(`HABITAT_WINDOWS`) are PYRION windows, not NASA values, and the warnings say so.

Measurement tolerance (judge battery): every inside-the-envelope test, per axis and in the (O2, pressure) hull,
counts a target as inside when it is within ±0.5 % of its own value of the measured range or hull
(`MEASUREMENT_TOLERANCE_REL`; PYRION convention, not a NASA value; `MEASUREMENT_TOLERANCE_NOTE`). 0.5 % is the worst-case
rounding of a three-significant-digit value and sits inside typical pressure-transducer accuracy (0.25–1 % of
reading), so "101.3 kPa", "14.7 psia" and "760 mmHg" count as the tested 1 atm while 110 kPa does not. When the
tolerance is what made the target count as inside, the reason says so ("within the 0.5 % measurement tolerance of
the tested 101.325 kPa") and `AxisCheck.viaTolerance` / `HullCheck.viaTolerance` is true. The chart geometry in
`locateTarget` (chart geometry) uses the same tolerance, so a chart marker is never outside a hull the verdict calls inside; when the tolerance is what put it inside, `TargetLocation.viaTolerance` (and the per-investigation flag) is true and `hullDistance` is 0: draw the marker on the edge with the "within 0.5 % tolerance" note.

More words: freefall / free fall / free-fall / weightless / in orbit / orbital / micro-g / µg (microgravity); Spanish
Luna, Marte, marciano/a, microgravedad, ingravidez, caída libre, gravedad cero, Tierra, gravedad normal/terrestre,
nivel del mar, presión normal, por ciento. A comma after a leading 0 ("0,165 g", "0,5 atm") is always a decimal comma; after a nonzero integer part one, two
or four-plus digits are a decimal ("8,2 psia"), while exactly three digits ("101,325", "1,000") or several commas
are refused: write 101.325 or 101325.

Gravity keywords anywhere (judge battery repeat test): when a gravity text is not a number and not a known name by itself,
`parseQuantity` looks for gravity keywords as whole words ("base lunar", "lunar habitat", "on the ground", "hábitat en
Marte"; the list is `GRAVITY_KEYWORDS`, accents ignored). Exactly one class found: that class, with a note naming the
keyword; two classes ("Moon and Mars"): typed error `ambiguous_gravity` naming both; none: the old error. A text that
starts with a number is never read by keyword.

`extractQuantities(question)` (`src/extract.ts`, pure, deterministic): returns `{ gravity?, o2?, pressure?,
flow_velocity?, sample_thickness?, ambient_temperature?, leftover, issues }` with the raw strings exactly as written,
ready for `targetFromQuantities`. Oxygen = a number with %, percent, por ciento, vol%, mol% and an oxygen word within 30
characters, or "oxygen fraction of 0.34"; pressure = a number with a pressure unit (a gauge unit is kept so the parser
refuses it) or "sea level pressure" and the like; a number right after "ppO2" / "partial pressure" is an issue, not a
pressure; gravity = a number with g, or a keyword; flow, thickness and ambient temperature need a context word
(flow, thick, ambient) because "a 2 mm sheet" is not assumed to be a thickness. It never guesses: two different values
for one quantity, a number that disagrees with a gravity keyword, or any number it cannot assign go to `issues` and
`leftover`. Tests run it over `validation/judge_battery/questions.json` (31 questions, EN + ES, and the traps).

NAVIGATOR (engine blocks, all deterministic, no model):
- `routesToEvidence(records, target)`: for each investigation that is not APPLICABLE, the smallest change that makes it APPLICABLE, verified with the engine's own cluster judgement. Kinds: `move` (a continuous axis to the nearest tested point, with the records that define the edge), `leave_open` (an axis the investigation did not record), `different_regime` (a regime axis that differs from every tested cluster; always ranked after every move or leave-open route, never a "small step"). A preset's `continuous.gravity_level` is treated as informational (no record carries it) and the route set says so.
- `evidenceMap(records, regime, { o2: [min, max, n], pressure: [min, max, n] })`: per cell of the O2 × pressure plane, the investigations APPLICABLE and EXTRAPOLATION; hulls built once; each cell equals `evaluate()`.
- Blockers: every INSUFFICIENT_EVIDENCE or REGIME_BARRIER investigation in `evaluate().investigations[i].blockers` carries codes `AXIS_NOT_RECORDED`, `NO_USABLE_VALUE`, `REGIME_NOT_TESTED` (with the tested values), plus `RECORDS_DISAGREE`, `AXES_NOT_RECORDED_TOGETHER`, `VALUES_NOT_PAIRED`; each with a plain sentence and, when one exists, the action `routesToEvidence` would take ("Leave fuel phase open."). The distance note now reads "not defined: ..." instead of "undefined: ...". Engine version 0.2.0.

Reason wording (judge's-eye pass): every reason, blocker and route sentence is plain language: axis and value names through `axisLabel`/`valueLabel`, verdict names through `verdictLabel` (Applicable / Extrapolation / Insufficient evidence / Not comparable (different regime)), oxygen as % with one decimal, pressure in kPa with psia at 3 significant figures, other axes 3 significant figures. Figures for specialists (normalized distances, test-id lists) are in `Reason.technicalNote`, never in the sentence. Excluded records are described as "flagged as insufficient in the extraction"; "not verified" appears only when `minimumStatus: 'verified'` is on. `evaluation.regimeUntested` ({ axis: 'gravity_regime', value, testedValues }) is set when the target states a gravity regime in which no investigation was tested.

Extrapolation levels (the verdict does not change): `ClusterVerdict.extrapolationLevel` and `InvestigationVerdict.extrapolationLevel` (the lowest level among an investigation's EXTRAPOLATION clusters) are `combination` (inside every tested range, but this combination was not tested), `just_outside` (worst axis gap up to 10 % of the nearest tested value), `outside` (up to 30 %) or `far_outside`. The relative gap is gap / max(|nearest tested value|, 5 % of the axis scale), so a zero-width envelope such as PSI-23 at exactly 1 atm works (110 kPa is `just_outside`, 8.6 %; 140 kPa `far_outside`). Constants `EXTRAPOLATION_LEVELS`, `EXTRAPOLATION_LEVEL_ORDER`, `EXTRAPOLATION_LEVEL_NOTE`; plain sentences via `levelSentence`. The note ("PYRION convention: these levels measure distance from the tested data, not how reliable or safe the condition is...") travels in the reason's `technicalNote`. `evidenceMap` cells carry the closest level among their extrapolating investigations.

N10 "Experiments needed": `experimentsNeeded(records, target, { catalog? })` returns a PYRION proposal (`label`: "PYRION proposal (a testable plan, not a NASA plan)"): the `gap` (untested regime, outside the tested data with its level, insufficient, or covered), coverage per fuel phase and the phases with none, a `testMatrix` (the target plus oxygen ±4 and ±8 points and pressure ±15 %, constants `TEST_MATRIX_O2_OFFSETS_POINTS` / `TEST_MATRIX_PRESSURE_FRACTIONS`, a PYRION design convention), the configuration of the nearest comparable solid-fuel investigations (PSI id, acronym, DOI via `parseInvestigationCatalog(investigations.csv)`, platform, material, flow and thickness ranges as recorded), the measurements PSI records for them (derived from their `outcome:` variables, never invented), `plannedCoverage` (FM2 and LUCI statements quoted verbatim with file and page, `PLANNED_SOURCES`: FM2's four starting atmospheres, 8.2 psia ± 0.3 psi at 37/33/29/25 % oxygen, NTRS 20260001966 PDF p. 10; LUCI "in air at normal pressure", NTRS 20250010653 PDF p. 12; where a source gives no figures the sentence says "not stated by the source"), the `remainingGap` (test points no stated experiment covers) and an ordered `priority` (untested regime, then solids, then far outside, then outside). The engine reads no files: the catalog is passed in.

N10 audit changes: the result is titled "What would close this gap — PYRION proposal (a testable plan, not a NASA plan)" (`EXPERIMENT_LABEL`; also exported as `whatWouldCloseThisGap`). Every statement about LUCI carries "simulated partial gravity (rotating vehicle)" (`LUCI_QUALIFIER`; vehicle rotation PDF p. 12, Coriolis PDF p. 17, gravity drop at 125 s PDF p. 43), and LUCI's data list is "listed by NASA as potential follow-on data, not results" (PDF p. 18). FM2 is stated per material and as a plan: "FM2 plans four burns of one fabric (Synergy Pro "Navy") at 8.2 psia ± 0.3 psi with 37, 33, 29 and 25 % oxygen". The matrix justifies its ±4-point step with FM2's own 4-point steps, marks `marginPoint` where the oxygen partial pressure exceeds the target's, and lists (does not grid) gravity level (0.16 and 0.38 g with sources), flow velocity (microgravity) and sample thickness as "to be stated by the experimenter" (`additionalAxes`). `TESTING_MEASURES` lists what flammability testing measures, each with a verbatim quote, file and PDF page (NASA-STD-6001B in the repository: `NASA_STD_6001B`, standards.nasa.gov historical copy, no DOI; LUCI). "Solids first" cites NASA-STD-6001B Test 1, FM2 and LUCI (`SOLIDS_RATIONALE_SOURCES`). A test checks every PDF quote against the PDF page when `pdftotext` and `data/raw` are present.
