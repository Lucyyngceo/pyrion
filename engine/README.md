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

## Tests

```bash
cd engine
node --test "test/**/*.test.ts"
```

They cover: byte-identical output for the same input, in any record order; a partial-gravity lunar target against microgravity evidence (`REGIME_BARRIER`, no distance, no rank); an in-range target (`APPLICABLE`); O2 out of range (`EXTRAPOLATION` naming the axis and the gap); inside every range but outside the hull (`EXTRAPOLATION`); missing O2 and missing regime (`INSUFFICIENT_EVIDENCE`); a record flagged `insufficient_evidence` never widening the envelope; the CSV reader and the schema checks; presets and unit conversions; the envelope export.

The fixtures in [`test/fixtures/synthetic/`](test/fixtures/synthetic/) are **invented test data, not NASA data**. Their accessions (`PSI-9001` to `PSI-9007`) do not exist in PSI, and every row says so.

Type check (optional, uses the TypeScript already installed for the web app): `node ../web/node_modules/typescript/bin/tsc -p tsconfig.json`.

## Limits

- **The convex hull assumes the measured region is filled in.** A target inside the hull may still be far from every test, if the tests sit on the edges. The nearest-point distance is reported for that reason.
- **Only O2 and pressure have a joint (2-D) check.** The other axes are checked one at a time, so a combination of values that each lie inside their own range can still be untested.
- **All tests of a cluster are pooled.** Tests that differ in something the schema does not encode (geometry, material, flow configuration) share one envelope. The descriptive values of each cluster are returned (`descriptors`) so the difference is visible.
- **Measurement uncertainty is not modelled.** Values are used as written in the source. A target near a bound is "inside" or "outside" by the stated value only.
- **Targets are points.** A band such as "30 % O2 or more" is checked at one point of it.
- **The verdict is only as good as the records.** A value that is wrong in the records gives a wrong verdict. That is why every reason cites the records it rests on, and why `evidenceStatus` says whether a person has checked them.
