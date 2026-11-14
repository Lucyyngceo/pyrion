# Condition records — the shared data contract

Every physical condition PYRION uses is stored as one **condition record**: one value of one variable for one test, with the exact place it came from. The evidence engine reads only these records. The extraction work writes only these records.

Schema: [`condition_record.schema.json`](condition_record.schema.json). Records live in `data/conditions/<accession>.csv`, one file per investigation, UTF-8, header row = schema field names.

## Fields

| Field | Meaning |
|---|---|
| `accession` | PSI investigation, e.g. `PSI-69` |
| `test_id` | test identifier as written by NASA (e.g. `Flex-007`, `Test #12`), or `*` when the value applies to every test of the investigation |
| `variable` | controlled name from the list below |
| `value` | value as normalized by PYRION (number, or a controlled term for regime variables) |
| `unit` | SI or controlled unit of `value` (see list); empty for terms |
| `value_original` | the value exactly as written in the source |
| `unit_original` | the unit exactly as written in the source |
| `method` | `table` (read from a PSI table by code) or `document` (read from a document, quote required) |
| `source_file` | path relative to `data/raw/`, e.g. `psi-data/PSI-69/Experimental table/PSI-69_Experimental table_FLEX.csv` |
| `source_location` | `row=<n>;column=<header>` for tables (n = 1-based data row), `page=<n>` or `section=<name>` for documents |
| `quote` | for `document`: the verbatim sentence that states the value. For `table`: the column header verbatim |
| `status` | `extracted` → `verified` (checked by a human against the source) or `insufficient_evidence` |
| `note` | free text, e.g. a unit conversion |

## Variables

**Regime axes — barriers, never interpolated across:**

| `variable` | allowed `value` |
|---|---|
| `gravity_regime` | `microgravity`, `partial_gravity`, `normal_gravity` |
| `fuel_phase` | `solid`, `liquid`, `gas` |
| `diluent` | `N2`, `He`, `CO2`, `Ar`, `mixed` |

**Continuous axes — interpolated only inside the measured range:**

| `variable` | `unit` |
|---|---|
| `o2_mole_fraction` | `1` (0 to 1) |
| `pressure` | `kPa` |
| `flow_velocity` | `cm/s` |
| `sample_thickness` | `mm` |
| `droplet_diameter_initial` | `mm` |
| `ambient_temperature` | `K` |
| `gravity_level` | `g` (multiples of Earth gravity, when stated) |

**Descriptive:** `fuel` (name as written), `material`, `geometry`, `flow_configuration` (`opposed`, `concurrent`, `quiescent`, `coflow`), `platform`.

**Outcomes:** `outcome:<name>` with its unit, e.g. `outcome:flame_spread_rate` (`mm/s`), `outcome:burn_time` (`s`), `outcome:extinction` (`true`/`false`), `outcome:burning_rate_constant` (`mm2/s`).

New variables are added to this file first, in the same commit as the code that uses them.

## Rules

1. **No value without a source.** `source_file` and `source_location` are always filled. A `document` record without a verbatim `quote` is invalid.
2. **Never guess.** If a value is not stated, there is no record. If it is ambiguous, the record gets `status = insufficient_evidence`.
3. **Unit conversions are explicit.** `value_original` and `unit_original` keep the source; `note` says how it was converted.
4. **Gravity comes from the source, not from the platform.** "Flown on the ISS" is not a gravity value unless a document states the regime.
