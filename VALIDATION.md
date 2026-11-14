# Validation protocol

How PYRION checks its own data and claims, and when it stops checking.

Two layers:

1. **Automated gates.** Deterministic code in `validation/`. It runs on every push, is cheap, and cannot loop.
2. **Milestone reviews.** Adversarial review of sampled records against their sources. It runs only at fixed milestones and has a hard round limit.

A finding counts only if it is **reproducible**: it names the file, the location and what differs. Anything else is discarded.

## Severity

Severity is decided by impact on what a user of PYRION would see, not by how a reviewer feels about it.

| Severity | Definition | Action |
|---|---|---|
| **BLOCKER** | Changes a number, a regime or a verdict shown to the user; a value with no traceable source; an overclaim in public text | Fix before the next push to `main`, or downgrade the record to `insufficient_evidence` |
| **MAJOR** | Weakens traceability, or could change a verdict under plausible conditions (for example an unverifiable unit conversion, or an ambiguous value used as evidence) | Fix in the current round, or downgrade to `insufficient_evidence` |
| **MINOR** | Wording, style, redundancy, cosmetic | Logged in the report. Not fixed during the hackathon |

## Layer 1 — automated gates (`python -I validation/run_all.py`)

| Check | What it verifies | Needs `data/raw/` |
|---|---|---|
| `schema` | every condition record has the required fields, allowed variables, allowed regime values and the unit fixed for its variable | no |
| `provenance` | every `source_file` is listed in the download checksums with status `ok` | no |
| `trace` | **table records:** the cell at `source_location` holds `value_original`. **document records:** `quote` appears in the text of `source_file` | yes |
| `units` | `value` can be recomputed from `value_original` and `unit_original` within 0.5 % | no |
| `bounds` | values are physically possible (for example O2 mole fraction between 0 and 1, pressure above 0) | no |
| `consistency` | one test never has two different values for a regime axis | no |
| `citation` | every investigation used has a DOI in `data/manifest/investigations.csv` | no |
| `language` | public text contains no banned claim ("first in the world", "validated by NASA", "no data exists", …) | no | <!-- lang-ok: lists the banned phrases -->

A line can carry the marker `lang-ok` when it quotes a banned phrase on purpose (as this table does). The marker is visible in the source, so every exception can be reviewed.

The run writes `validation/reports/latest.md` and `latest.json`, and exits with an error if there is any BLOCKER. GitHub Actions runs every check that does not need `data/raw/` on every push. The `trace` check runs locally, where the PSI files are, and its report is committed.

## Layer 2 — milestone reviews

Each milestone is reviewed by the specialties it can actually get wrong:

| Milestone | When | Reviewers |
|---|---|---|
| **M1** | after table extraction | metrology (units, quantity definitions, ranges, precision) · data provenance (cell trace, versions, duplicates, licenses) |
| **M2** | after document extraction | combustion and fire safety (gravity regime, fuel phase, flame type, oxygen meaning, flow configuration) · data provenance |
| **M3** | after the engine runs on real records | computational methods (hull geometry, intervals, normalization, regime barriers, determinism) · combustion and fire safety |
| **M4** | before submission | spacecraft atmospheres and mission context (every public claim against its NASA source) · automated language gate |

Each reviewer has a written checklist of the mistakes typical of its field, and it may only report findings it can reproduce.

Each review:

1. Starts only when Layer 1 has no BLOCKER.
2. Samples records: **every** `document` record, plus a stratified random sample of `table` records (10 % per investigation, at least 3, at most 20). The sample seed is recorded.
3. A reviewer that did not write the records tries to break each sampled record against its source.
4. BLOCKER and MAJOR findings are fixed. MINOR findings are logged only.
5. **Round 2** re-checks **only** the fixed records and reruns Layer 1. It is not a new full review.

**Stop rules — no round 3:**

- If a record is still wrong after round 2, it becomes `insufficient_evidence` with the reason in `note`. It is not debated further.
- If the reviewer and the source disagree and no source text settles it, the record becomes `insufficient_evidence`.
- If round 1 finds more than 20 % of the sample wrong for one investigation, that investigation's extractor is fixed and rerun. That is a fix, not a new review round.
- Each milestone review is time-boxed to 30 minutes.

Reports live in `validation/reports/`, one file per milestone review, with the sample seed, the findings and what was done about each one.

## What this does not claim

"Independent" here means the review is done by a separate process that did not produce the records. It is **not** a review by NASA, and it is **not** a validation by combustion experts.
