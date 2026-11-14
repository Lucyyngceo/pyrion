# SYNTHETIC TEST FIXTURES — NOT NASA DATA

Every file in this folder is invented to exercise the engine's rules. None of it comes from NASA,
PSI or any experiment. The accessions `PSI-9001` … `PSI-9007` do not exist in PSI (they only
match the `PSI-<number>` pattern the schema requires). Every row says so in `quote` and `note`.

| File | What it exercises |
|---|---|
| `PSI-9001.csv` | microgravity / solid / N2 / normal flame, four tests that form a 2-D envelope; test T5 has an O2 record flagged `insufficient_evidence` (0.50) that must never widen the envelope; T3 is `extracted`, not `verified` |
| `PSI-9002.csv` | microgravity / gas / N2: a fuel-phase barrier for solid targets |
| `PSI-9003.csv` | no O2 record at all: `INSUFFICIENT_EVIDENCE` for any target that uses O2 |
| `PSI-9004.csv` | gravity regime not stated: `INSUFFICIENT_EVIDENCE` |
| `PSI-9005.csv` | normal flame; two clusters in one investigation: microgravity tests G1–G3 and normal-gravity tests E1–E2 |
| `PSI-9006.csv` | the only gravity record is flagged `insufficient_evidence`: the regime counts as missing |
| `PSI-9007.csv` | two O2 values and two pressures for the whole investigation, pairing not stated |

Only `PSI-9001` and `PSI-9005` state `flame_type`; the others leave it unstated on purpose.
