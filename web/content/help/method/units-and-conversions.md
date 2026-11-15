---
id: units-and-conversions
title: "Units and conversions: every factor"
keywords: units, conversions, psia to kpa, atm, mmhg, torr, bar, percent, fraction, gauge pressure, psig, temperature
chapter: 10
order: 3
dataHelp: [ctl-oxygen-number, ctl-pressure-number, ctl-gravity-level]
sources: ["validation/run_all.py", "engine/src/quantity.ts"]
---

Language models are bad at arithmetic: in a benchmark they put wrong numbers into an oxygen partial pressure. So **models never convert units in PYRION; code does**, with one table of factors that the engine shares with the validation script.

**Pressure** goes to kilopascals (kPa): 1 Pa = 0.001 kPa; 1 atm = 101.325 kPa; 1 bar = 100 kPa; 1 mbar = 0.1 kPa; 1 psi = 1 psia = 6.894757 kPa; 1 mmHg = 1 torr = 0.1333224 kPa. Gauge pressure (psig, barg, kPag) is refused, because the engine needs absolute pressure; plain "psi" is taken as absolute and says so.

**Oxygen** goes to a mole fraction: "34 %", "34 vol%", "34 percent" and "34 por ciento" are 0.34. A bare number above 1 is read as a percent and one up to 1 as a fraction, and the result says which rule it applied; a written unit always wins ("0.34 %" is 0.0034, with a warning).

**Flow**: 1 m/s = 100 cm/s; 1 mm/s = 0.1 cm/s. **Thickness** in millimetres: 1 cm = 10 mm; 1 µm = 0.001 mm; 1 in = 25.4 mm; 1 m = 1000 mm. **Temperature** in kelvin: K = °C + 273.15.

Values that look like a unit slip (for example 200 % oxygen, or a negative pressure) are errors with a plain sentence, not guesses. Values outside a plausible window for a habitat (oxygen 5 to 60 %, pressure 20 to 120 kPa) are accepted but come with a warning. Those windows are PYRION's, not NASA's.

## For engineers

Table in `engine/src/quantity.ts` (copy of `TO_KPA`, `CONVERSIONS`, `BOUNDS` of `validation/run_all.py`; a test compares them):

- `TO_KPA` (line 88): kpa 1.0, pa 0.001, atm 101.325, bar 100.0, mbar 0.1, psi 6.894757, psia 6.894757, mmhg 0.1333224, torr 0.1333224.
- `TO_FRACTION` (line 99): '' and '1' and 'mole fraction' and 'fraction' 1.0; '%', 'percent', '% by vol', '% by volume', 'percent by volume', 'vol%', 'vol %' 0.01. Aliases: 'mol%', 'mol %', 'mole%', 'mole %', 'vol. %' as %; 'per cent', 'mol percent', 'mole percent', 'por ciento', 'porciento' as percent. A trailing "O2", "oxygen", "of oxygen", "de oxígeno" is ignored.
- `TO_CM_S` (line 112): cm/s 1.0, mm/s 0.1, m/s 100.0.
- `TO_MM` (line 113): mm 1.0, cm 10.0, um and µm and micron(s) 0.001, in 25.4, m 1000.0.
- `TO_K_OFFSET` (line 123): k 0, c and °c and degc 273.15 ("degrees C", "Celsius" also).
- `BOUNDS` (line 125, inclusive): o2_mole_fraction [0, 1]; pressure [0.1, 2000] kPa; flow_velocity [0, 1000] cm/s; sample_thickness [0, 200] mm; ambient_temperature [100, 4000] K; gravity_level [0, 3] g. Outside: error `out_of_range` (for oxygen, `percent_out_of_range`), message "<axis> <typed> (<converted>) is outside the plausible range A to B; this usually means the wrong unit."
- `HABITAT_WINDOWS = { o2_mole_fraction: [0.05, 0.6], pressure: [20, 120] }` (line 184): warnings only, labelled "PYRION plausibility window, not a NASA value".
- `KPA_PER_PSI = 6.894757293168361` (`engine/src/presets.ts:8`) is used to show psia next to kPa in sentences; the table factor 6.894757 differs from it by less than 1e-7 (relative); the table is the authority for conversions.

Decimal comma: `0,165` and `8,2` are decimals (a comma after a leading 0, or followed by 1 or 2 digits, or 4 or more); "101,325" and "1,000" (nonzero integer part and exactly 3 digits) or several commas are refused with "write 101.325 (decimal point) or 101325 (no separator)". Vocabulary: "1 atm", "1 atmosphere", "sea level", "normal air pressure" = 101.325 kPa with a note; "kPa abs", "psia (absolute)" accepted; "psi(g)" refused.

The calculators the chat uses (`web/lib/expert/calculators.ts`) call the same table.
