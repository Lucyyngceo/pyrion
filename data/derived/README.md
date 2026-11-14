# Derived tables

Tables computed from the PSI files and the condition records. They are **not** condition records: `data/conditions/` is the evidence the engine reads, and nothing here replaces it. A derived table says how it was computed, from which cell, and where it stops.

Rebuild (standard library plus `openpyxl`):

```bash
python -I extraction/build_derived.py
```

## `bass2_flow_steps.csv`: BASS-II flow readings during each test

One row per BASS-II test (129 rows, one per row of the PSI experimental table).

### Why it exists

In the BASS-II table the "Air display" cell is not one flow value. For many tests it is the series of readings shown on the video display while the flow was changed during the test, for example `5 3 2` or `10 5 4 3 2 1`. The condition records keep it as `insufficient_evidence` ("display reading series during the test, not a test condition"); this table keeps the series in order so that the lowest flow at which a flame burned can be read from it. The BASS-II ReadMe lists, at paragraph 38, Zhao et al., "Concurrent flame growth, spread, and quenching over composite fabric samples in low speed purely forced flow in microgravity", *Proceedings of the Combustion Institute* 36 (2017) 2971–2978. Whether the stepped-flow cells of this table follow that paper's protocol is not stated in the ReadMe, so this table makes no claim about it.

### Which display, and which unit

Both statements come from the BASS-II ReadMe, `psi-data/PSI-25/Science Documents/PSI-25_Science Documents_BASS-II_ReadMe.docx` (paragraph numbers count every `w:p` element of `word/document.xml` from 1):

- paragraph 20: "Air display:  flow speed measured in the duct in cm/s on the video display.  Response time is very slow (~ 1 min), so reading is only steady for long times at the same flow setting."
- paragraph 19: "Fan display:  instantaneous fan voltagex10 on the video display." The Fan display is a voltage, not a velocity, and is not used here.

The fan calibration workbook, `psi-data/PSI-25/Reference Data/PSI-25_Reference Data_Fan calibration data.xlsx`, sheet "Fan Calibration data", header row 6 (`Pot | Fan Display | Air Display | Fan V | U cm/s*`), data row 7: pot 10, Fan Display 122, Air Display 29, U 29.19 cm/s. The Air Display values are on the same scale as the computed velocity in cm/s, which supports reading Air display as cm/s. The workbook also shows that the reading depends on the date and on the number of restrictors (the same pot setting reads 29 on 2014-043 and 10 on 2014-050), so a flow reading is a display value for that test, not a calibrated velocity.

`build_derived.py` checks both quoted ReadMe sentences and that calibration row before it writes anything, and stops if either has changed.

### Columns

| Column | Meaning |
|---|---|
| `accession`, `test_id` | `PSI-25` and the test id of the PSI table (column "Test #") |
| `material` | the sample as written in the table ("Fuel Sample Material") |
| `geometry_class` | `rod`, `sphere`, `sheet`, `film` or `other`, from words in the label (`rod`; `sphere`/`spherical`; `film`/`micron`; `slab`/`sheet`/`thick`); SIBAL fabric, Nomex and wax candles are `other` |
| `size_original` | the sample label again, kept as the record of what the radius was computed from |
| `sample_radius_mm`, `radius_basis` | for a rod whose label gives a diameter in inches: diameter × 25.4 / 2, with the arithmetic and the original text in `radius_basis` (`1/4" clear rod` → 6.35 mm diameter → 3.175 mm radius). Empty otherwise |
| `o2_initial`, `o2_final` | oxygen mole fractions: the existing condition records `o2_mole_fraction` (calibrated initial) and `outcome:o2_mole_fraction_after_test` of `data/conditions/PSI-25.csv` |
| `flow_steps` | the readings in order, as written, separated by spaces |
| `flow_unit`, `flow_unit_source` | `cm/s` and the ReadMe quotation above, only for rows that parsed |
| `flow_min_with_flame` | lowest listed reading, filled only when the cell ends in the separate word `ext` (see below) |
| `ended_in_extinction` | `true` when the cell ends in the separate word `ext` or `extinguished`, `false` for other parsed rows, empty for ambiguous rows |
| `cell_mentions_extinction` | `true` when the original cell contains "ext" in any form, including cells that could not be parsed (a text flag, not a derived number) |
| `parse_status`, `parse_reason` | `ok` or `ambiguous`, and why |
| `air_display_original`, `source_file`, `source_row` | the cell as written, the PSI table and the 1-based data row |

### Parser rules

The parser is deterministic and never guesses.

- `ok`: the cell is only numbers separated by spaces, optionally followed by one separate word `ext` or `extinguished`.
- `ambiguous`, no derived numbers: anything else, including words ("down to ext", "blowoff", "decr"), symbols ("<1", ">", parentheses), "max", a fused token such as `0ext`, and an empty cell.
- `ambiguous` also when any reading is above 55. The BASS-II Summary Report gives the duct maximum as ~55 cm/s ("With no restrictors, the maximum flow velocity was ~55 cm/s", `psi-data/PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf`, page 12), so a larger number is probably a fan-display value in the wrong column.
- `flow_min_with_flame` is an interpretation of the notation: readings are listed in time order, the flame is taken as burning at every listed reading and out after the last when the cell ends in `ext`. The cell does not say this in words. It is empty whenever the cell does not end in `ext`.

### Counts

Run `python -I extraction/build_derived.py` for the current counts; they are also printed in the commit that last changed this table. In this version: 129 rows; 64 `ok`, 65 `ambiguous`; 54 rods, 50 of them with a radius (4 rod labels have no inch mark, e.g. `1/4 blac rod`, and are not guessed); 2 spheres, 0 with a radius (the label is "4 cm spherical section": a section of a larger sphere, with no stated radius); 1 test ended in extinction in a parseable cell (B14, `5 3 2 ext`), and it has no rod radius. 15 cells mention extinction in some form; the other 14 are ambiguous text such as "5 down to ext".

### Limits

- The table supports very few stretch-rate inputs: only 9 `ok` rows have a rod radius and none of them ended in a parseable extinction. The low-flow quenching experiment is mostly described in free text that this parser leaves alone on purpose.
- The Air display response time is about one minute (ReadMe), so a step in the series is a display reading, not a steady velocity.
- "Flame burning at every listed reading" is not in the table; see `flow_min_with_flame` above.
- A spherical section is not a sphere of known radius. `sample_radius_mm` is empty for it.

### BASS (PSI-26): skipped

The PSI-26 experimental table has no flow column (date, test numbers, sample number and material only). The as-run test matrix in its Science Documents has "Fan display" and "Air display" cells, but they are written as free notes with ">" separators and words ("4.0 > 8.0 > max", "5, 3, 2, 1, low"), the BASS ReadMe-equivalent that defines the display units is not in PSI, and there is no calibration workbook for BASS. The units could not be established with a quotation, so no derived table is built for BASS.
