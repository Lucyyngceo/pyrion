# Ground (1 g) test data in the downloaded PSI files: inventory

Inventory only; nothing here is extracted into condition records. Written 2026-11-14 from a pre-scan of every PDF, DOCX, XLSX and CSV under `data/raw/psi-data/` for ground, 1-g and normal-gravity wording (1 485 hits in 1 page/paragraph units), followed by a reading of the substantive documents by two agents (a segregated internal check by language models, not expert or NASA review). The structured entries are in `extraction/documents/review/ground-inventory-acme.json` and `ground-inventory-other.json`.

## Rules used

- **Ground test** = a normal-gravity (1 g) test on Earth. **Drop towers (2.2 s, 5.18 s), parabolic flights, KC-135 and microgravity wind tunnels are NOT ground**: they are microgravity or partial gravity and were excluded.
- Requirements and planning documents (SRD, ERD, EIRD, ISRD, SORD, verification plans) that only say ground testing is planned are not test data. Their many 'ground-based' mentions explain why 23 investigations show hits (for example the shared ACME Engineering Requirements Document alone adds about 97 hits to each ACME investigation).
- 'O2 and pressure per test' requires a table or a clearly stated condition for each ground test. A value only in a figure, or an ambient condition that is implied, is reported as such.

## Summary

- Investigations inventoried: **24** (all 24 PSI combustion investigations). `ground_data`: none 10, partial 9, requirements_only 2, not_ground 2, yes_table 1.
- **Only one clean per-test 1-g table exists: PSI-107 (SPICE)**, Dotson thesis Tables 6.3 (15 SPICE-module points) and 6.4 (about 21 points on a 13.7 mm unconfined coflow burner): fuel, nozzle, coflow velocity, fuel flow and smoke height. O2 and pressure are **not tabulated**: ambient air (about 21 % and 101 kPa) is implied. Gas-jet smoke points, not material flammability.
- **PSI-25 (BASS-II)** states one 1-g condition for its downward PMMA tests (101 kPa, 21 % O2 on p.46; the Fig. 2.20 caption says 20.7 %), but the per-thickness spread rates exist only as plots. **PSI-20 (BRE)** has about 15 normal-gravity gas-burner points in an SRD table (air stated once, pressure not stated) and 4 one-gravity points at XO2 0.21 and 1 bar in a figure legend.
- **PSI-99 (SAFFIRE-II)** has '1-g Burn Length' and '1-g Spread Rate' columns for 9 samples, mostly qualitative (two numbers, 1.2 and 0.6 mm/s); no PSI file says where or at what O2 and pressure those runs were done. **PSI-142** holds laboratory counterflow-flame data without O2 or pressure in its tables.
- Everything else is figure-only, photos, a paper abstract, requirements text, smoke from heated samples (SAME, SAME-R: no flame), or flight-only. **No investigation offers ground tests with both O2 and pressure per test in a table.**
- Outside PSI (`data/raw/nasa/`): `ntrs-20000004509` (Olson and T'ien) is a genuine normal-gravity PMMA experiment in air with a table of about 8 stretch-rate rows (pdf p.28); pressure is not stated. It is not a PSI investigation.

## Table

| Investigation | Ground data | Files and location | Ground tests | O2 and pressure per test | Ground vs flight, quoted | Effort |
|---|---|---|---|---|---|---|
| PSI-10 ACME Flame Design | none | `Experimental table/PSI-10_Experimental table_Flame Design_Normal Flame` (whole file (207 rows)); `Experimental table/PSI-10_Experimental table_Flame Design_Inverse Flam` (whole file (120 rows)) | 0 found | o2: no (no ground tests in the files); pressure: no; note: The only per-test XO2/pressure tables are the ISS flight CSVs. | "There are no analogous experiments at 1g that can accomplish this." (page=7 (a statement that no 1-g analog exists, not a ground test)) | not usable |
| PSI-20 ACME BRE (Burning Rate Emulator) | partial | `Science Documents/PSI-20_Science Documents_BRE_SRD_201306.pdf` (page=20-21 (Fig. 13, Table 3 'BRE Simulation' rows); page=15-16 (BRE vs 50 mm methanol pool, 52% CH4/48% N2); page=56-57 (Fig. 6 flammability map by BRE in normal gravity)); `Science Documents/PSI-20_Science Documents_BRE_science_concept_RDR_201` (page=14 ('Proof of Concept in Normal Gravity'), page=35) | ~15 BRE gas-fuel points in SRD Table 3 (plus methanol and heptane pool comparisons); 4 legend entries for Auth 1-g data in the dissertation | o2: constant: 'air' (about 21%) stated once for the SRD 1-g BRE runs; XO2 = 0.21 in the Fig. 5.4 legend for the 4 Auth points; pressure: SRD runs: not stated; Fig. 5.4 legend: p = 1 bar for the 4 Auth points; note: O2 and pressure appear only as a single state | "prototype BRE burner at 50 mm operating in normal gravity and air with pure methane and ethylene as the fuels." (page=20 (sentence fragment; the sentence starts after the Fig. 13 caption text)) | needs reading |
| PSI-21 ACME CLD Flame | none | `Experimental table/PSI-21_Experimental table_CLD Flame.csv` (whole file (32 rows)); `metadata/PSI-21_metadata_PSI-97_ACME CLD Flame.zip` (i_Investigation.txt) | 0 found | o2: no; pressure: no; note: Only the CSV and metadata exist for PSI-21 in the download; no report or paper. |  | not usable |
| PSI-22 ACME E-FIELD Flames | partial | `Reports/PSI-22_Reports_E-FIELD Flames Final Report.pdf` (page=25 (Fig. 10: 1-g V-I curves), page=34-35 (Figs. 21-22: 1-g vs 0-g coflow methane flame images vs field strength)); `Presentations/PSI-22_Presentations_Karnani et al 2009 Exploring the ef` (page=7-10 'Normal-Gravity Results (UCI)'; page=11-12 'Normal and Low Gravity Results (NASA)') | unknown | o2: no (implicit lab air, never stated as a number); pressure: no; note: Only in figures; ground curves are ion current vs electric field for methane in air. The varied parameter is the electric field, not gravity or O2. | "For comparison, the equivalent V-I curves for 1-g flames with the same burner configuration with no coflow are shown Figure 10 [J. Tinajero, dissertation, 2015]." (page=25) | not usable |
| PSI-23 ACME s-Flame | none | `Experimental table/PSI-23_Experimental table_ACME s-Flame.csv` (whole file); `Reports/PSI-23_Reports_s_Flame_final_report_20210729.pdf` (page=4 (2.5.1 Limitations of Terrestrial 1g Testing), 17 and 40 (returned fuel bottle tested in the ground copy of CIR for a leak), 26, 29, 43, 53, 55, 84 ('not observed in our ground-based' studies)) | 0 found | o2: no; pressure: no; note: None for ground. | "Previous experimentation on earth has amply demonstrated" (page=4 (literature statement, not a test; sentence continues on the page)) | not usable |
| PSI-25 BASS-II | partial | `Reports/PSI-25_Reports_BASS-II Summary Report.pdf` (pdf page=46 (printed p38), Section 2.3.5; pdf pages 47-52 (Figs 2.19-2.22)); `Reports/PSI-25_Reports_BASS-II Summary Report.pdf` (pdf pages 23-24 (Section 2.1.2.2), page 49 (Fig 2.20 caption)) | unknown (nine fuel thicknesses in Fig 2.21, plus further 2-cm sheets for the thick limit; 1 g rod tests of four diameters in Fig 4.3) | o2: constant: 21 percent (Fig 2.20 caption: 20.7 percent O2, 79 percent N2) for the downward sheet tests, stated once; rod 1 g tests vary O2 but only inside Fig 4.3 (minimum 19 vol%); pressure: constant: 101 kPa (1 atm) for the downward sheet tests, stated onc | "The downward experiments were performed in the atmospheric condition (pressure 101 kPa, O2 level 21 percent)." (pdf page=46) | needs reading |
| PSI-26 BASS | none | `Science Documents/PSI-26_Science Documents_FlammabilityAspectsofFabric` (paragraphs 166-172 (Figs 13 and 14); also the 2013 pdf in Presentations pages 31-33); `Presentations/PSI-26_Presentations_BASS_Overview of Recent ISS Results` (pdf pages 30-32) | unknown (1-2 flames shown as images) | o2: no (1 g images have no stated O2; text says 'normal gravity air'); pressure: no; note: The As Run and Planned Test Matrix xlsx and the experimental table CSV are ISS runs; the only 1-g hit in the xlsx is a comment on row 49 ('This doesn't burn in 1g like t | "These tests show the enhanced flammability in microgravity for this geometry, since, in normal gravity air, a flame self-extinguishes in the opposed-flow geometry (downwa" (paragraph=178) | not usable |
| PSI-39 CFI | none | `Presentations/PSI-39_Presentations_Cool Flames in Space, a Hot Prospec` (page=3); `Experimental table/PSI-39_Experimental table_CFI.csv` (23 rows) | 0 usable | o2: no ground data (the CSV has O2 per run but those are ISS tests); pressure: no ground data (the CSV has pressure per run but ISS); note: Final report p.6 says cool flames cannot be observed under normal gravity with droplet flames; final report p.33 says 1- | "Moreover, the cool flames need much longer residence times and cannot be observed under normal gravity conditions with droplet flames." (page=6) | not usable |
| PSI-47 DAFT | partial | `Reports/PSI-47_Reports_DAFT_30Day.PostFlightReport.pdf` (page=8 (text), page=12 (Figure 7 'DAFT Ground Test data'), page=11 (Fig 5 slope 0g vs 1g)) | unknown (a plot with several samples, no table) | o2: no; pressure: no; note: Aerosol detector calibration (dust, not a flame); no atmosphere statement. | "Section III C. Figure 7 contains a chart developed from the ground testing that was performed in May of 2003, using the crew training hardware in a flight like manner." (page=8) | not usable |
| PSI-60 (Computational and Experimental Analysis of SPICE Data Sets) | none | `metadata/PSI-60_metadata_NEWID-5_Computational and Ex.zip` (i_Investigation.txt, s_PSI-60.txt) | 0 | o2: no; pressure: no; note: Approach: color-ratio pyrometry on SPICE images plus soot modelling; hypothesis compares microgravity to normal gravity. |  | not usable |
| PSI-62 (Concurrent flame spread FGM modelling vs BASS) | none | `metadata/PSI-62_metadata_NEWID-7_Concurrent Flame Spr.zip` (i_Investigation.txt, s_PSI-62.txt) | 0 | o2: no; pressure: no; note: Computational study compared with BASS (PSI-25/26) flight tests. |  | not usable |
| PSI-68 FLEX-2 | requirements_only | `Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf` (page=27 (Fig 11 caption), pages 20-22, 56-58 (Section 7 Ground-Based Research Program)) | 0 | o2: no; pressure: Fig 11 caption names 1 and 2 atm but it is a literature review figure; note: Section 7 ground program is drop towers and aircraft (excluded). | "Burning of ethanol droplet in normal-gravity under 1 and 2 atmospheric pressures." (Figure 11 caption, pdf page=27) | not usable |
| PSI-69 FLEX | requirements_only | `Engineering Documents/PSI-69_Engineering Documents_FLEX_EIRD_v4.pdf` (pages 44-45, 60-61, 73-77); `Science Documents/PSI-69_Science Documents_FLEX_Test_Plan.pdf` (pages 3-5) | 0 | o2: no; pressure: no; note: 2G11-070HE-0310.pdf (Cornell, ISS plus ground-based experiments) uses a 1.2 s drop tower for Do < 0.85 mm: excluded as not ground. |  | not usable |
| PSI-98 SAFFIRE-I | none | `Science Documents/PSI-98_Science Documents_SAFFIRE Objectives, Develop` (pages 1-5) | 0 | o2: no (the table has Percent O2 21.5-21.7 but for the flight run); pressure: no; note: Experimental table CSV has 2 flight samples (SIBAL, 20 cm/s). |  | not usable |
| PSI-99 SAFFIRE-II | partial | `Experimental table/PSI-99_Experimental table_SAFFIRE-2.csv` (rows 2-10 (samples 2-1 to 2-9), columns '1-g Burn Length' and '1-g Spread Rate'); `Science Documents/PSI-99_Science Documents_SAFFIRE Objectives, Develop` (pages 2-3) | 9 samples have a 1-g entry (only 2 numeric spread rates, 1.2 and 0.6 mm/s; the rest are Complete, Acceleratory, ~0 or n/a) | o2: no for the 1-g tests: the Percent O2 column (~21.5 to 22.1) belongs to the ISS flight run (Note 1: derived from CO2 production, referenced to the initial O2 reported by ISS); pressure: no (there is no pressure column at all); note: The 1-g columns have no  | "The second objective is to examine the flammability limits of materials in low gravity for comparison with results of NASA’s terrestrial normal gravity evaluation tests." (page=2) | unclear |
| PSI-100 SAFFIRE-III | none | `Experimental table/PSI-100_Experimental table_SAFFIRE-3.csv` (2 rows) | 0 | o2: no; pressure: no; note: Objectives paper is the same one as in PSI-98/99. |  | not usable |
| PSI-101 SAME-R | partial | `Reports/PSI-101_Reports_SAME-R_Final Report.pdf` (pages 2, 9-14); `Analyzed Data/PSI-101_Analyzed Data_SAME, SAME-R_Results.xlsx` (sheets 'Gnd Verif. 8-2012' (~10 numbered tests), 'Drum 8-2012' (~20 numbered tests), 'Flight-ground plot', '3-tests Compar.') | ~30 (about 10 ground verification plus about 20 drum tests, Aug 2012) | o2: no (no O2 column; smoke is made by heating samples in an air stream); pressure: no (only upstream gauge pressure of instrument lines); note: Smoke generation by electric heating (Rt/R0 coil resistance ratio), not flames; ambient air at lab pressure is impl | "As a part of SAMER effort, three major post–flight ground tests were performed" (page=2) | not usable |
| PSI-102 SAME | partial | `Presentations/PSI-102_Presentations_SAME2_FlightVSGroundTestResults.pp` (slides 19-22, 28); `Reports/PSI-102_Reports_SAME_Final Science Report.pdf` (pages 56, 64) | unknown | o2: no; pressure: no; note: Pre-flaming pyrolysis smoke with varied pyrolysis rate and air flow rate (slide 6); no atmosphere composition or pressure variable. | "Ground based testing at 8 cm/s showed particle dimensions very close to the flight results" (slide=28) | not usable |
| PSI-106 SLICE | none | `Experimental table/PSI-106_Experimental table_Slice.csv` (12 rows) | 0 | o2: no; pressure: no; note: PSI holds the table and a metadata zip only; the image set is 72.9 GB and not in the downloaded set. |  | not usable |
| PSI-107 SPICE | yes_table | `Reports/PSI-107_Reports_SMOKE POINTS OF MICROGRAVITY AND  NORMAL GRAVI` (pdf page=80 (printed p.70), Table 6.3); `Reports/PSI-107_Reports_SMOKE POINTS OF MICROGRAVITY AND  NORMAL GRAVI` (pdf page=81 (printed p.71), Table 6.4) | ~36 (15 SPICE-module plus ~21 unconfined burner) | o2: constant: ambient air (open module with fresh air; the 75 and 50 percent C3H6 mixtures dilute the fuel with N2, not the oxidizer); no O2 measurement. The thesis assumes 21±1% O2 only in the Table 3.1 note (the microgravity table); pressure: constant ambien | "Experiments in normal gravity with the SPICE prototype module were conducted at the University of Maryland." (pdf page=42 (printed p.32), Section 3.2) | easy table |
| PSI-115 SAME smoke modelling (NNX17AF08A) | not_ground | `Reports/PSI-115_Reports_NNX17AF08A_FinalReport.pdf` (pages 3, 9, 11, 14-16); `Analyzed Data/*.dat (44 files, e.g. 8cmGravity*.dat)` (whole files) | 0 (4 Earth-gravity simulation cases) | o2: no; pressure: no; note: Computation, not measurement; the final report mentions no ground tests. | "We have simulated smoke formation and growth in microgravity and Earth gravity" (page=15) | not usable |
| PSI-117 (cool flames, Farouk; Effect of External T...) | not_ground | `Analyzed Data/PSI-117_Analyzed Data_ReadMe_List_of_Data.xlsx` (Sheet1); `Reports/PSI-117_Reports_Dissertation_Combustion Behavior Of Sub-Millim` (pages 9, 30-31, 128, 158, 196) | 0 | o2: yes in ReadMe (0.1 or 0.21) but for droplet-combustion simulations/ISS data; pressure: yes in ReadMe (0.5-5 atm) but same; note: Not ground: numerical and microgravity. Presentation page 26 'Cool diffusion flame, 1 g (Won et al.)' is a literature reference |  | not usable |
| PSI-142 (Quantitative Studies of Cool Flame Transitions, Princeton) | partial | `Analyzed Data/PSI-142_Analyzed Data_PSI data summary Princeton with li` (sheets 'data ID 1' to 'data ID 8' and 'data summary'); `Experimental table/PSI-142_Experimental table_Data Summary Table.csv` (8 rows) | unknown (8 datasets, each a curve of many points) | o2: no (columns are fuel mass fraction Yf, strain rate, O3 mol%, etc.; the oxidizer O2 level is in the cited papers); pressure: no (not in the tables); note: The approach text says the numerical modelling used the experimental conditions of FLEX flight. These  |  | unclear |
| PSI-159 ACME CFI-G (Cool Flames Investigation, Gaseous) | partial | `Reports/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf` (page=22-24 (abstract of Waddell et al., 'Cool Diffusion Flames in a Stably Stratified Stagnation Flow'; section F 'Additional Objectives Achieved')); `Reports/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf` (page=17 (4.A), page=23) | unknown (heptane pool: number of tests not stated) | o2: no; pressure: no; note: The heptane pool experiment is in a stably stratified stagnation flow between heated parallel plates; ambient O2 and pressure are not given in the report. The per-test XO2/p tables are flight data only. | "Cool diffusion flames burning near the surface of fuel pools in normal gravity were observed for the first time." (page=24 (section F)) | not usable |

## Per investigation

### PSI-10 ACME Flame Design: none, effort: not usable

- **Fuel and flame:** none (ground); flight: ethylene and other fuels, spherical burner-supported normal and inverse diffusion flames
- **Ground tests:** 0 found
- **O2 and pressure:** o2: no (no ground tests in the files); pressure: no; note: The only per-test XO2/pressure tables are the ISS flight CSVs.
- **Quote** (PSI-10/Reports/PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf, page=7 (a statement that no 1-g analog exists, not a ground test)): "There are no analogous experiments at 1g that can accomplish this."
- **Files:**
  - `PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Normal Flame.csv` (whole file (207 rows)): ISS microgravity flight tests (XO2 and pressure per test) - NOT ground
  - `PSI-10/Experimental table/PSI-10_Experimental table_Flame Design_Inverse Flame.csv` (whole file (120 rows)): ISS microgravity flight tests - NOT ground
  - `PSI-10/Reports/PSI-10_Reports_FinalRpt_ACMEFlameDesign.pdf` (page=4,6,7,29 (normal-gravity wording); page=98 (ref 50: Wang et al., 'Ground-Based Research Supporting Flame Design', ASGSR abstract 2017)): Only background/literature statements about normal-gravity flames and a cited ground-research abstract; no ground test table or conditions
  - `PSI-10/Reports/PSI-10_Reports_TaskbookRpts.pdf` (page=2,5,7,...): Says the PI directs 'normal gravity experiments' at Washington University; no data or conditions
- **Why:** All test tables are ISS flight data. Ground mentions are background/literature and the PI's separate Washington University program, whose data are not in the downloaded files. SRD/ISRD/SORD are requirements documents. Drop-tower (5 s) mentions excluded.

### PSI-20 ACME BRE (Burning Rate Emulator): partial, effort: needs reading

- **Fuel and flame:** gas burner emulating condensed-fuel pool fires: ethylene, methane, CH4/N2 and propane-N2 mixtures, 25 and 50 mm porous burner (laminar diffusion flames above a flat burner)
- **Ground tests:** ~15 BRE gas-fuel points in SRD Table 3 (plus methanol and heptane pool comparisons); 4 legend entries for Auth 1-g data in the dissertation
- **O2 and pressure:** o2: constant: 'air' (about 21%) stated once for the SRD 1-g BRE runs; XO2 = 0.21 in the Fig. 5.4 legend for the 4 Auth points; pressure: SRD runs: not stated; Fig. 5.4 legend: p = 1 bar for the 4 Auth points; note: O2 and pressure appear only as a single statement or figure-legend text, not as per-test columns. Auth's primary data (a thesis) is not among the files.
- **Quote** (PSI-20/Science Documents/PSI-20_Science Documents_BRE_SRD_201306.pdf, page=20 (sentence fragment; the sentence starts after the Fig. 13 caption text)): "prototype BRE burner at 50 mm operating in normal gravity and air with pure methane and ethylene as the fuels."
- **Files:**
  - `PSI-20/Science Documents/PSI-20_Science Documents_BRE_SRD_201306.pdf` (page=20-21 (Fig. 13, Table 3 'BRE Simulation' rows); page=15-16 (BRE vs 50 mm methanol pool, 52% CH4/48% N2); page=56-57 (Fig. 6 flammability map by BRE in normal gravity)): 1-g BRE prototype (50 mm) runs in air with methane and ethylene, plus methanol/heptane pool comparisons. Table 3 lists heat of combustion, heat of gasification, re-radiation per point (about 15 BRE points); no per-test O2 or pressure columns. Table 1 (D9023-D9030) is a 5 s drop-tower table (ignition at 1g, then microgravity): excluded.
  - `PSI-20/Science Documents/PSI-20_Science Documents_BRE_science_concept_RDR_201306.pdf` (page=14 ('Proof of Concept in Normal Gravity'), page=35): Same preliminary normal-gravity proof-of-concept material and the same drop-tower table (sampled, not read in full)
  - `PSI-20/Reports/PSI-20_Reports_Dissertation-PD-revised_.pdf` (page=104-106 (printed 101-103), Fig. 5.4 legend; page=50-51): Flammability map overlays 1-g data (from Auth's thesis, refs 55,56) for propane-nitrogen BRE. Figure legend text lists 4 one-gravity points: heat of combustion 43.7/35/26.2/17.5 kJ/g, each XO2=0.21, p=1 bar. The underlying 1-g data points are not tabulated here.
  - `PSI-20/Reports/PSI-20_Reports_Final_20220201.pdf` (page=29, 98, 127 (1-g BRE results quoted qualitatively); page=52, 68 (1-g lab duplicate of the flight burner, water-condensation test); page=49 (UMD ground runs with identical burner for igniter timing)): Qualitative statements of 1-g BRE experiments at University of Maryland; no conditions table
  - `PSI-20/Experimental table/PSI-20_Experimental table_ACME BRE.csv` (whole file): ISS flight days (O2 21-40%, pressure not listed) - NOT ground
- **Why:** BRE is a gas burner, not a real solid or liquid fuel. The only 1-g numbers are a heat-of-combustion/heat-of-gasification table and plot points, with air stated once. The SRD is a requirements document that happens to include preliminary results. Drop tower (2.2 s/5 s) and aircraft results excluded. At best a weak contextual 1-g reference.

### PSI-21 ACME CLD Flame: none, effort: not usable

- **Fuel and flame:** none (ground); flight: methane/ethylene coflow laminar diffusion flames
- **Ground tests:** 0 found
- **O2 and pressure:** o2: no; pressure: no; note: Only the CSV and metadata exist for PSI-21 in the download; no report or paper.
- **Files:**
  - `PSI-21/Experimental table/PSI-21_Experimental table_CLD Flame.csv` (whole file (32 rows)): ISS flight test days (fuel conc. range, flames ignited); no pressure column; NOT ground
  - `PSI-21/metadata/PSI-21_metadata_PSI-97_ACME CLD Flame.zip` (i_Investigation.txt): Metadata only; lists publications 'under microgravity and normal gravity' by title but holds no data
- **Why:** Folder contains just the flight CSV and metadata. The 1-g comparisons referenced in metadata and in the PSI-20 CSSCI papers (Tinajero and Long 2021) are not in the files.

### PSI-22 ACME E-FIELD Flames: partial, effort: not usable

- **Fuel and flame:** methane (also ethylene, hydrogen) laminar coflow or jet diffusion flames in an applied electric field
- **Ground tests:** unknown
- **O2 and pressure:** o2: no (implicit lab air, never stated as a number); pressure: no; note: Only in figures; ground curves are ion current vs electric field for methane in air. The varied parameter is the electric field, not gravity or O2.
- **Quote** (PSI-22/Reports/PSI-22_Reports_E-FIELD Flames Final Report.pdf, page=25): "For comparison, the equivalent V-I curves for 1-g flames with the same burner configuration with no coflow are shown Figure 10 [J. Tinajero, dissertation, 2015]."
- **Files:**
  - `PSI-22/Reports/PSI-22_Reports_E-FIELD Flames Final Report.pdf` (page=25 (Fig. 10: 1-g V-I curves), page=34-35 (Figs. 21-22: 1-g vs 0-g coflow methane flame images vs field strength)): 1-g UC Irvine laboratory comparisons of ion current vs field strength and flame images, taken from Tinajero 2015/2017 and Chien 2015 dissertations (cited, not included). Conditions only in figures; no O2/pressure table.
  - `PSI-22/Presentations/PSI-22_Presentations_Karnani et al 2009 Exploring the effects of gravity on a coflow diffusion flame.pdf` (page=7-10 'Normal-Gravity Results (UCI)'; page=11-12 'Normal and Low Gravity Results (NASA)'): 15-slide deck; text layer is mostly slide titles and bullets; UCI 1-g coflow methane flames in an electric field (figures). The NASA low-gravity part is the 2.2 s drop tower (excluded). No O2 or pressure given.
  - `PSI-22/Presentations/PSI-22_Presentations_Tinajero et al 2014 Ground-Based Schlieren Experiments.pdf` (page=6-10): Ground UCI coflow burner, methane, fuel velocity 7 cm/s; plots of ion current vs field strength for 25/30/35 mm gaps. Ambient air/pressure not stated; data only in plots.
  - `PSI-22/Presentations/PSI-22_Presentations_Tinajero et al 2016 characterizing i-v curves for non-premixed methane flames.pdf` (page=9 onward): 1-g I-V curves for methane/hydrogen on three burners; fuel flow in mL/min on plots; no O2/pressure
  - `PSI-22/Presentations/PSI-22_Presentations_Swenson et al 2011 Electric field induced convection in microgravity combustion.pdf` (page=1-6 (Fig. 3, 6)): 1g vs microgravity (2.2 s drop tower, excluded) ion current for a 24 cm/s methane flame; coflow is air; no O2 or pressure value
  - `PSI-22/Engineering Documents/PSI-22_Engineering Documents_ACME CLD burner hot wire anemometry measurements.pdf` (page=1): 1g cold-flow (air/N2, no flame) velocity profiles of the burner: not a flame test
- **Why:** 1-g laboratory comparisons exist but only as figures from other people's dissertations (not in the files), with no O2 or pressure; the electric field (not gravity) is the controlled variable. Karnani/Swenson low-gravity runs are 2.2 s drop tower and are excluded. Lopez-Camara decks are numerical simulations, not tests. Not suitable for an O2+pressure envelope.

### PSI-23 ACME s-Flame: none, effort: not usable

- **Fuel and flame:** none (ground); flight: spherical diffusion flames of ethylene, methane, hydrogen and mixtures
- **Ground tests:** 0 found
- **O2 and pressure:** o2: no; pressure: no; note: None for ground.
- **Quote** (PSI-23/Reports/PSI-23_Reports_s_Flame_final_report_20210729.pdf, page=4 (literature statement, not a test; sentence continues on the page)): "Previous experimentation on earth has amply demonstrated"
- **Files:**
  - `PSI-23/Experimental table/PSI-23_Experimental table_ACME s-Flame.csv` (whole file): ISS flight test days; 'Atmosphere is ~1 atm' with O2 about 21/30%; NOT ground
  - `PSI-23/Reports/PSI-23_Reports_s_Flame_final_report_20210729.pdf` (page=4 (2.5.1 Limitations of Terrestrial 1g Testing), 17 and 40 (returned fuel bottle tested in the ground copy of CIR for a leak), 26, 29, 43, 53, 55, 84 ('not observed in our ground-based' studies)): Qualitative statements only; no ground test conditions or data
  - `PSI-23/Science Documents/PSI-23_Science Documents_s-Flame_SRD_20100125.pdf` (page=16-22): Literature review of low-pressure normal-gravity experiments by others; requirements document
- **Why:** Ground items are literature references, a CIR ground-unit leak check (not a flame test) and requirements text. Drop tower 2.2 s/5 s preparatory testing excluded.

### PSI-25 BASS-II: partial, effort: needs reading

- **Fuel and flame:** PMMA thin sheets (100-400 um, 2 cm wide; also thick) downward (opposed buoyant-flow) flame spread; PMMA rods in 1 g
- **Ground tests:** unknown (nine fuel thicknesses in Fig 2.21, plus further 2-cm sheets for the thick limit; 1 g rod tests of four diameters in Fig 4.3)
- **O2 and pressure:** o2: constant: 21 percent (Fig 2.20 caption: 20.7 percent O2, 79 percent N2) for the downward sheet tests, stated once; rod 1 g tests vary O2 but only inside Fig 4.3 (minimum 19 vol%); pressure: constant: 101 kPa (1 atm) for the downward sheet tests, stated once; note: No per-test table of the 1 g runs. Spread rates per thickness are only plotted (Figs 2.19b, 2.21, 2.22); the only numbers in text are the 100 um average 2.0 mm/s and thick-limit 0.044 mm/s. The BASS-II CSV and Test Matrices in PSI-25 are ISS (microgravity) only.
- **Quote** (PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf, pdf page=46): "The downward experiments were performed in the atmospheric condition (pressure 101 kPa, O2 level 21 percent)."
- **Files:**
  - `PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf` (pdf page=46 (printed p38), Section 2.3.5; pdf pages 47-52 (Figs 2.19-2.22)): Downward (1 g) PMMA sheet flame spread at San Diego State University (SDSU flame stabilizer), 100 um to thick, vs ISS BASS-II; conditions stated once in text, per-thickness spread rates only in figures
  - `PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf` (pdf pages 23-24 (Section 2.1.2.2), page 49 (Fig 2.20 caption)): SDSU vertical flame tunnel (opposed flow up to 100 cm/s) and flame-stabilizer 1-g data described; Fig 2.20 caption: 1 g PMMA at SDSU in 20.7 percent O2 / 79 percent N2 at 1 atm, 100-400 um
  - `PSI-25/Reports/PSI-25_Reports_BASS-II Summary Report.pdf` (pdf pages 55-59 (Section 4, Fernandez-Pello rods; Fig 4.3), pages 96-97): 1 g PMMA rod spread (4 diameters, lowest O2 with all burning 19 vol%) and 1 g upward limit 15.4 percent O2 (ref. 23): only in figures / cited values
- **Why:** The Summary Report (NASA/TM-20210011385) includes a 1 g dataset of downward spread over PMMA in air at 101 kPa (Section 2.3), but the per-thickness 1 g values exist only as plots, so O2/pressure are a single stated condition rather than a per-test table. Drop-tower (5.18 s ZGRF) and sounding-rocket mentions were excluded. The 'computational model' downward values on pdf page 34 (2.8, 1.6, 1.2, 0.9 mm/s at 21 percent O2) are simulations, not tests.

### PSI-26 BASS: none, effort: not usable

- **Fuel and flame:** Cotton-fiberglass fabric (SIBAL), thin-fuel flame spread; also a PMMA sphere photo
- **Ground tests:** unknown (1-2 flames shown as images)
- **O2 and pressure:** o2: no (1 g images have no stated O2; text says 'normal gravity air'); pressure: no; note: The As Run and Planned Test Matrix xlsx and the experimental table CSV are ISS runs; the only 1-g hit in the xlsx is a comment on row 49 ('This doesn't burn in 1g like this.').
- **Quote** (PSI-26/Science Documents/PSI-26_Science Documents_FlammabilityAspectsofFabric_USNationalCombustion.2013.docx, paragraph=178): "These tests show the enhanced flammability in microgravity for this geometry, since, in normal gravity air, a flame self-extinguishes in the opposed-flow geometry (downward flame spread)."
- **Files:**
  - `PSI-26/Science Documents/PSI-26_Science Documents_FlammabilityAspectsofFabric_USNationalCombustion.2013.docx` (paragraphs 166-172 (Figs 13 and 14); also the 2013 pdf in Presentations pages 31-33): Photos of a 1 g upward flame (Fig 13) and a 1 g downward flame (Fig 14) next to 0 g flames for 2-cm-wide cotton-fiberglass (SIBAL) samples; no 1 g test conditions given
  - `PSI-26/Presentations/PSI-26_Presentations_BASS_Overview of Recent ISS Results.pdf` (pdf pages 30-32): Qualitative 0 g vs 1 g statements (e.g. Ultem/Nomex 'Similar to 1-g', 1-g opposed flame does not propagate)
- **Why:** The 2013 paper shows 1-g comparison flames as photographs only and gives no O2, pressure, flow or spread rate for them. Zero-g facility / 5 s drop-tower mentions (2-cm PMMA sphere, SysAcceptanceReview pages 37 and 56) were excluded as not ground. SRD/ERD/SAR/crew-training files are requirements/planning.

### PSI-39 CFI: none, effort: not usable

- **Fuel and flame:** Droplet combustion (n-alkanes), hot and cool flames, ISS
- **Ground tests:** 0 usable
- **O2 and pressure:** o2: no ground data (the CSV has O2 per run but those are ISS tests); pressure: no ground data (the CSV has pressure per run but ISS); note: Final report p.6 says cool flames cannot be observed under normal gravity with droplet flames; final report p.33 says 1-g droplet experiments at 1 atm need droplets smaller than 1 mm (statements, no data).
- **Quote** (PSI-39/Reports/PSI-39_Reports_CFI Science Final Report.pdf, page=6): "Moreover, the cool flames need much longer residence times and cannot be observed under normal gravity conditions with droplet flames."
- **Files:**
  - `PSI-39/Presentations/PSI-39_Presentations_Cool Flames in Space, a Hot Prospect on Earth_CFI.pdf` (page=3): Slide has an image pair labelled 'ISS' and '1-g' with no conditions in the text layer
  - `PSI-39/Experimental table/PSI-39_Experimental table_CFI.csv` (23 rows): FLEX runs on ISS (pressure, O2, N2, He, fuel per run): microgravity, not ground
- **Why:** No ground test data: the 'ISS / 1-g' slide is a qualitative image without conditions, ground work is in cited literature, and the other ground-based mentions are drop towers (excluded) or planning. The Analyzed Data FLEX summary PDFs are flight data (one failed to open in the pre-scan).

### PSI-47 DAFT: partial, effort: not usable

- **Fuel and flame:** none (Arizona road dust / Velcro dust aerosol, alcohol-wick particle counter); no flame
- **Ground tests:** unknown (a plot with several samples, no table)
- **O2 and pressure:** o2: no; pressure: no; note: Aerosol detector calibration (dust, not a flame); no atmosphere statement.
- **Quote** (PSI-47/Reports/PSI-47_Reports_DAFT_30Day.PostFlightReport.pdf, page=8): "Section III C. Figure 7 contains a chart developed from the ground testing that was performed in May of 2003, using the crew training hardware in a flight like manner."
- **Files:**
  - `PSI-47/Reports/PSI-47_Reports_DAFT_30Day.PostFlightReport.pdf` (page=8 (text), page=12 (Figure 7 'DAFT Ground Test data'), page=11 (Fig 5 slope 0g vs 1g)): May 2003 ground test of Arizona Test Dust aerosol with crew training hardware: P-Trak vs DustTrak response, as a plot
- **Why:** Smoke-detector aerosol comparison, not combustion; the only ground data is one figure with no O2 or pressure. The DAFT experimental table lists ISS sessions on ARD with GN2.

### PSI-60 (Computational and Experimental Analysis of SPICE Data Sets): none, effort: not usable

- **Fuel and flame:** SPICE coflow gas jet flames (analysis of existing images)
- **Ground tests:** 0
- **O2 and pressure:** o2: no; pressure: no; note: Approach: color-ratio pyrometry on SPICE images plus soot modelling; hypothesis compares microgravity to normal gravity.
- **Files:**
  - `PSI-60/metadata/PSI-60_metadata_NEWID-5_Computational and Ex.zip` (i_Investigation.txt, s_PSI-60.txt): Metadata only (7.7 kB total)
- **Why:** PSI holds a Ground Investigation record (projectType, related PSI-107) with no data files.

### PSI-62 (Concurrent flame spread FGM modelling vs BASS): none, effort: not usable

- **Fuel and flame:** Modelling of concurrent spread over charring fabrics
- **Ground tests:** 0
- **O2 and pressure:** o2: no; pressure: no; note: Computational study compared with BASS (PSI-25/26) flight tests.
- **Files:**
  - `PSI-62/metadata/PSI-62_metadata_NEWID-7_Concurrent Flame Spr.zip` (i_Investigation.txt, s_PSI-62.txt): Metadata only (9.4 kB total)
- **Why:** PSI holds the investigation record only (Ground Investigation, related PSI-25 and PSI-26); no data files.

### PSI-68 FLEX-2: requirements_only, effort: not usable

- **Fuel and flame:** Droplet combustion (literature figure: ethanol droplet; SRD for ISS)
- **Ground tests:** 0
- **O2 and pressure:** o2: no; pressure: Fig 11 caption names 1 and 2 atm but it is a literature review figure; note: Section 7 ground program is drop towers and aircraft (excluded).
- **Quote** (PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf, Figure 11 caption, pdf page=27): "Burning of ethanol droplet in normal-gravity under 1 and 2 atmospheric pressures."
- **Files:**
  - `PSI-68/Science Documents/PSI-68_Science Documents_FLEX-2 SRD Final.pdf` (page=27 (Fig 11 caption), pages 20-22, 56-58 (Section 7 Ground-Based Research Program)): SRD literature-review figure of earlier 1 g ethanol droplet burning (not a PSI test) and a plan for the ground program (drop towers)
- **Why:** SRD/ERD only; ground statements are literature review and plans (SRD page 31: detailed test points not provided); ground tests named are drop towers/parabolic flights (excluded). Calibration zips and the CSV are ISS data.

### PSI-69 FLEX: requirements_only, effort: not usable

- **Fuel and flame:** Droplet combustion; ISS
- **Ground tests:** 0
- **O2 and pressure:** o2: no; pressure: no; note: 2G11-070HE-0310.pdf (Cornell, ISS plus ground-based experiments) uses a 1.2 s drop tower for Do < 0.85 mm: excluded as not ground.
- **Files:**
  - `PSI-69/Engineering Documents/PSI-69_Engineering Documents_FLEX_EIRD_v4.pdf` (pages 44-45, 60-61, 73-77): Requirements/plan text about ground-based droplet work (drop towers, literature)
  - `PSI-69/Science Documents/PSI-69_Science Documents_FLEX_Test_Plan.pdf` (pages 3-5): Test plan: initial conditions to be set by ground testing in the drop towers
  - `PSI-69/Calibration/PSI-69_Calibration_20CAL08_Chamber_Gases.txt (and the other CAL files)` (whole file): 'Chamber gases used were ISS cabin air': on-orbit calibration test points, not ground
- **Why:** Requirements/planning documents and drop-tower references only; calibration test points are on ISS. No 1 g test table.

### PSI-98 SAFFIRE-I: none, effort: not usable

- **Fuel and flame:** SIBAL cotton-fiberglass fabric, large-scale flame spread (flight)
- **Ground tests:** 0
- **O2 and pressure:** o2: no (the table has Percent O2 21.5-21.7 but for the flight run); pressure: no; note: Experimental table CSV has 2 flight samples (SIBAL, 20 cm/s).
- **Files:**
  - `PSI-98/Science Documents/PSI-98_Science Documents_SAFFIRE Objectives, Development and Status.pdf` (pages 1-5): Paper states objectives; ground-based work is planned for SAFFIRE-IV-VI (Table 5 Ground column)
- **Why:** Flight only; the pre-scan hits are objective statements and the Operations PDF has no ground test data.

### PSI-99 SAFFIRE-II: partial, effort: unclear

- **Fuel and flame:** Silicone, SIBAL cotton-fiberglass, Nomex, PMMA samples (5 x 29 cm), concurrent/opposed flame spread
- **Ground tests:** 9 samples have a 1-g entry (only 2 numeric spread rates, 1.2 and 0.6 mm/s; the rest are Complete, Acceleratory, ~0 or n/a)
- **O2 and pressure:** o2: no for the 1-g tests: the Percent O2 column (~21.5 to 22.1) belongs to the ISS flight run (Note 1: derived from CO2 production, referenced to the initial O2 reported by ISS); pressure: no (there is no pressure column at all); note: The 1-g columns have no explanation in any PSI file: the first two columns are literally '?-g Burn Length' and '?-g Spread Length' (a lost character, evidently micro-g). The files do not say where, how or at what O2/pressure the 1-g runs were done. The link to NASA-STD-6001 Test 1 (upward burn in ambient air) is an inference, NOT stated.
- **Quote** (PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE Objectives, Development and Status.pdf, page=2): "The second objective is to examine the flammability limits of materials in low gravity for comparison with results of NASA’s terrestrial normal gravity evaluation tests."
- **Files:**
  - `PSI-99/Experimental table/PSI-99_Experimental table_SAFFIRE-2.csv` (rows 2-10 (samples 2-1 to 2-9), columns '1-g Burn Length' and '1-g Spread Rate'): Per-sample 1-g outcome beside the flight outcome: e.g. 2-2 silicone 0.61 mm: 7.6 cm, 1.2 mm/s; 2-4 silicone opposed: Complete, 0.6 mm/s; 2-5 and 2-6 SIBAL: Complete, Acceleratory; 2-3 silicone and 2-7 Nomex: ~0
  - `PSI-99/Science Documents/PSI-99_Science Documents_SAFFIRE Objectives, Development and Status.pdf` (pages 2-3): Says samples were chosen with normal-gravity MOC limits near 21 percent O2 and sized like NASA-STD-6001 Test 1 samples
- **Why:** The CSV carries qualitative 1-g counterpart results per sample but nothing states the 1-g test conditions, so O2 and pressure cannot be established for them; ask the PI/PSI before using. The SAFFIRE-II Readme and image xlsx contain no ground data.

### PSI-100 SAFFIRE-III: none, effort: not usable

- **Fuel and flame:** SIBAL fabric (flight)
- **Ground tests:** 0
- **O2 and pressure:** o2: no; pressure: no; note: Objectives paper is the same one as in PSI-98/99.
- **Files:**
  - `PSI-100/Experimental table/PSI-100_Experimental table_SAFFIRE-3.csv` (2 rows): Two flight samples (SIBAL, 30 cm/s concurrent/opposed); no O2 or pressure column
- **Why:** Flight only; no ground test data in the files.

### PSI-101 SAME-R: partial, effort: not usable

- **Fuel and flame:** Heated Kapton, lamp wick, silicone, Teflon, Pyrell: pyrolysis smoke, no flame
- **Ground tests:** ~30 (about 10 ground verification plus about 20 drum tests, Aug 2012)
- **O2 and pressure:** o2: no (no O2 column; smoke is made by heating samples in an air stream); pressure: no (only upstream gauge pressure of instrument lines); note: Smoke generation by electric heating (Rt/R0 coil resistance ratio), not flames; ambient air at lab pressure is implicit and not stated.
- **Quote** (PSI-101/Reports/PSI-101_Reports_SAME-R_Final Report.pdf, page=2): "As a part of SAMER effort, three major post–flight ground tests were performed"
- **Files:**
  - `PSI-101/Reports/PSI-101_Reports_SAME-R_Final Report.pdf` (pages 2, 9-14): Post-flight ground tests: flow tests, TEM 1-g counterpart, drum plus SMPS tests (flight hardware, ground SMPS drum)
  - `PSI-101/Analyzed Data/PSI-101_Analyzed Data_SAME, SAME-R_Results.xlsx` (sheets 'Gnd Verif. 8-2012' (~10 numbered tests), 'Drum 8-2012' (~20 numbered tests), 'Flight-ground plot', '3-tests Compar.'): Per-test table: sample, inlet velocity (8.1 cm/s), Rt/R0, duration, aging times
- **Why:** Ground smoke-aerosol data exist but they are particle size results from heated samples; there are no O2 or pressure variables, so they cannot populate a flame O2-pressure envelope.

### PSI-102 SAME: partial, effort: not usable

- **Fuel and flame:** Heated silicone, Teflon, Kapton, lamp wick, Pyrell, DBP: pyrolysis smoke, no flame
- **Ground tests:** unknown
- **O2 and pressure:** o2: no; pressure: no; note: Pre-flaming pyrolysis smoke with varied pyrolysis rate and air flow rate (slide 6); no atmosphere composition or pressure variable.
- **Quote** (PSI-102/Presentations/PSI-102_Presentations_SAME2_FlightVSGroundTestResults.pptx, slide=28): "Ground based testing at 8 cm/s showed particle dimensions very close to the flight results"
- **Files:**
  - `PSI-102/Presentations/PSI-102_Presentations_SAME2_FlightVSGroundTestResults.pptx` (slides 19-22, 28): Ground test schematic and flight vs ground particle diameter comparison at 8 cm/s airflow
  - `PSI-102/Reports/PSI-102_Reports_SAME_Final Science Report.pdf` (pages 56, 64): 1-g comparison runs mentioned; sizes compared with a comparable test in normal gravity
  - `PSI-102/Experimental table/PSI-102_Experimental table_SAME.csv` (9 rows): Sample, air flow, weight loss rate, aging (flight)
- **Why:** Ground comparison of smoke particle size only (figures); no O2 or pressure; VPRED/EIRD/BCDD are requirements documents.

### PSI-106 SLICE: none, effort: not usable

- **Fuel and flame:** Gas-jet diffusion flames (CH4, C2H4, C2H6 with N2) on ISS
- **Ground tests:** 0
- **O2 and pressure:** o2: no; pressure: no; note: PSI holds the table and a metadata zip only; the image set is 72.9 GB and not in the downloaded set.
- **Files:**
  - `PSI-106/Experimental table/PSI-106_Experimental table_Slice.csv` (12 rows): ISS test days Feb-Mar 2012 with fuel type; no ground
- **Why:** Flight experiment (projectType Microgravity Investigation); nothing ground in the downloaded files.

### PSI-107 SPICE: yes_table, effort: easy table

- **Fuel and flame:** Laminar coflow gas-jet diffusion flames (ethylene, propane, propylene and propylene/N2 mixtures), smoke point
- **Ground tests:** ~36 (15 SPICE-module plus ~21 unconfined burner)
- **O2 and pressure:** o2: constant: ambient air (open module with fresh air; the 75 and 50 percent C3H6 mixtures dilute the fuel with N2, not the oxidizer); no O2 measurement. The thesis assumes 21±1% O2 only in the Table 3.1 note (the microgravity table); pressure: constant ambient: no per-test value; ambient pressure taken from NOAA College Park airport only for the rotameter calibration; the Table 3.1 note assumes 101 kPa; note: Tables 6.3 and 6.4 list fuel, nozzle and flow but no O2 or pressure columns; both are ambient lab air by implication. Test dates/times are not in Tables 6.3/6.4. The Fig 6.3 stills (day of year 45, etc.) are microgravity flight tests, and the PSI-107 CSV is the ISS flight table.
- **Quote** (PSI-107/Reports/PSI-107_Reports_SMOKE POINTS OF MICROGRAVITY AND  NORMAL GRAVITY COFLOW DIFFUSION  FLAMES_DotsonThesis.pdf, pdf page=42 (printed p.32), Section 3.2): "Experiments in normal gravity with the SPICE prototype module were conducted at the University of Maryland."
- **Files:**
  - `PSI-107/Reports/PSI-107_Reports_SMOKE POINTS OF MICROGRAVITY AND  NORMAL GRAVITY COFLOW DIFFUSION  FLAMES_DotsonThesis.pdf` (pdf page=80 (printed p.70), Table 6.3): 15 normal-gravity smoke points on the SPICE prototype module (University of Maryland): test number, fuel (75/50/100 percent C3H6 in N2), nozzle ID, coflow velocity, mass fuel flow, mean fuel velocity, smoke height
  - `PSI-107/Reports/PSI-107_Reports_SMOKE POINTS OF MICROGRAVITY AND  NORMAL GRAVITY COFLOW DIFFUSION  FLAMES_DotsonThesis.pdf` (pdf page=81 (printed p.71), Table 6.4): ~21 smoke points for ethylene/propane/propylene on a 13.7 mm unconfined coflow burner in 1 g: coflow velocity, fuel velocity, mass flow, smoke height, Froude numbers (fuel column printed C2H6; Table 6.2 calls it ethylene)
  - `PSI-107/Reports/PSI-107_Reports_SMOKE POINTS OF MICROGRAVITY AND  NORMAL GRAVITY COFLOW DIFFUSION  FLAMES_DotsonThesis.pdf` (pdf pages 42-44 (Sections 3.2-3.3), 59-60 (Section 4.2); also presentation 'Laminar Smoke Points in Coflow Measured Aboard ISS' page 3 (1 atm, 14 mm nozzle, air)): How the 1 g tests were run
- **Why:** Best candidate: a real per-test table of 1 g smoke points with fuel, nozzle and coflow. Caveat: O2 and pressure are ambient air by implication (not tabulated), so as conditions they are constant ~21 percent / ~101 kPa with an assumption flag. Parabolic-flight/KC-135/drop-tower mentions in the thesis and SPICE reports were excluded. The SPICE final and 30-day reports mention the 1 g smoke-point comparison in text only.

### PSI-115 SAME smoke modelling (NNX17AF08A): not_ground, effort: not usable

- **Fuel and flame:** Simulated heated vapor source and smoke (SAME geometry), no flame
- **Ground tests:** 0 (4 Earth-gravity simulation cases)
- **O2 and pressure:** o2: no; pressure: no; note: Computation, not measurement; the final report mentions no ground tests.
- **Quote** (PSI-115/Reports/PSI-115_Reports_NNX17AF08A_FinalReport.pdf, page=15): "We have simulated smoke formation and growth in microgravity and Earth gravity"
- **Files:**
  - `PSI-115/Reports/PSI-115_Reports_NNX17AF08A_FinalReport.pdf` (pages 3, 9, 11, 14-16): Simulated Earth-gravity (EG) vs microgravity (MG) smoke cases (inlet velocity 0.08 and 0.1 m/s)
  - `PSI-115/Analyzed Data/*.dat (44 files, e.g. 8cmGravity*.dat)` (whole files): Simulation output fields; 'Gravity' means Earth-gravity cases
- **Why:** No ground tests: it is a numerical study with Earth-gravity cases, no experimental data and no O2/pressure.

### PSI-117 (cool flames, Farouk; Effect of External T...): not_ground, effort: not usable

- **Fuel and flame:** n-alkane and butanol droplet flames (numerical/ISS)
- **Ground tests:** 0
- **O2 and pressure:** o2: yes in ReadMe (0.1 or 0.21) but for droplet-combustion simulations/ISS data; pressure: yes in ReadMe (0.5-5 atm) but same; note: Not ground: numerical and microgravity. Presentation page 26 'Cool diffusion flame, 1 g (Won et al.)' is a literature reference.
- **Files:**
  - `PSI-117/Analyzed Data/PSI-117_Analyzed Data_ReadMe_List_of_Data.xlsx` (Sheet1): Lists each CSV with fuel, droplet diameter, P (atm), XO2: droplet-combustion model/ISS figure data (PROCI 2019, 2023; MST 2024)
  - `PSI-117/Reports/PSI-117_Reports_Dissertation_Combustion Behavior Of Sub-Millimeter Sized Oxygenated And N-Alka.pdf` (pages 9, 30-31, 128, 158, 196): Numerical analysis with comparisons to Cornell drop tower data (excluded) and ISS
- **Why:** The thesis is numerical with drop-tower validation (excluded); the CSV tables are model results for microgravity droplets, not 1 g tests.

### PSI-142 (Quantitative Studies of Cool Flame Transitions, Princeton): partial, effort: unclear

- **Fuel and flame:** Counterflow diffusion flames of n-alkanes and DME, with/without ozone; cool and hot flame extinction
- **Ground tests:** unknown (8 datasets, each a curve of many points)
- **O2 and pressure:** o2: no (columns are fuel mass fraction Yf, strain rate, O3 mol%, etc.; the oxidizer O2 level is in the cited papers); pressure: no (not in the tables); note: The approach text says the numerical modelling used the experimental conditions of FLEX flight. These are lab counterflow flames; that they are 1 g is inferred from 'Ground Investigation', not stated explicitly.
- **Files:**
  - `PSI-142/Analyzed Data/PSI-142_Analyzed Data_PSI data summary Princeton with links.xlsx` (sheets 'data ID 1' to 'data ID 8' and 'data summary'): Digitized figure data from counterflow flame papers (Reuter et al. 2017 CFE/HFE extinction limits vs fuel mass fraction and strain rate; ozone effect; PLIF, thermometry, chemiluminescence profiles)
  - `PSI-142/Experimental table/PSI-142_Experimental table_Data Summary Table.csv` (8 rows): Index of the datasets with DOIs
  - `PSI-142/_investigation/PSI-142.json` (projectType): 'Ground Investigation'; hardware is PI laboratory hardware
- **Why:** Real ground (lab) experimental data, but extinction-limit curves and profiles with O2 and pressure not in the PSI files; the cited papers (Combust. Flame 179 (2017) 23-32; Proc. Combust. Inst. 2018) would be needed.

### PSI-159 ACME CFI-G (Cool Flames Investigation, Gaseous): partial, effort: not usable

- **Fuel and flame:** liquid n-heptane pool, cool diffusion flame, heated parallel plates (stagnation flow)
- **Ground tests:** unknown (heptane pool: number of tests not stated)
- **O2 and pressure:** o2: no; pressure: no; note: The heptane pool experiment is in a stably stratified stagnation flow between heated parallel plates; ambient O2 and pressure are not given in the report. The per-test XO2/p tables are flight data only.
- **Quote** (PSI-159/Reports/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf, page=24 (section F)): "Cool diffusion flames burning near the surface of fuel pools in normal gravity were observed for the first time."
- **Files:**
  - `PSI-159/Reports/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf` (page=22-24 (abstract of Waddell et al., 'Cool Diffusion Flames in a Stably Stratified Stagnation Flow'; section F 'Additional Objectives Achieved')): Abstract-level text about a ground (normal-gravity) liquid n-heptane pool cool-flame experiment: peak gas temperatures 705-760 K, autoignition first at 550 K. No test table, O2 or pressure; the paper itself is not in the files.
  - `PSI-159/Reports/PSI-159_Reports_FinalRpt_ACME.CFI-G.pdf` (page=17 (4.A), page=23): 'ground testing' only to decide n-pentane vs ethane (low vapor pressure); no data
  - `PSI-159/Experimental table/PSI-159_Experimental table_CFI-G_Normal Flames.csv` (whole file (179 rows)): ISS flight tests with XO2 and approx p (bar) per test - NOT ground
  - `PSI-159/Experimental table/PSI-159_Experimental table_CFI-G_Inverse Flames.csv` (whole file (1015 rows)): ISS flight tests with XO2 and p per test - NOT ground
- **Why:** The ground heptane pool work appears only as a summary in the report; no conditions table is in the downloaded files (would need the Combustion and Flame paper by Waddell et al. or Waddell's dissertation).

## Cross-cutting notes from the two readings

1) All six 'Experimental table' CSVs in these folders are ISS flight test tables, not ground. 2) The ACME Engineering Requirements Doc, Integrated Science Requirements (ISRD/RevB), Science Operations Requirements, fact sheets, CDR package, Researcher's Guide and the SRDs are requirements/planning or background documents; their ground/1-g hits are statements of intent, literature references, or ground-unit/hardware checks. Hardware-only items (ground copy of CIR leak check, cold-flow hot-wire anemometry, UMD identical-burner igniter timing runs) are not flame condition data. 3) The only items with any 1-g O2 value: PSI-20 SRD (air, stated once) and PSI-20 dissertation Fig. 5.4 legend (XO2 0.21, p 1 bar for 4 Auth points whose primary data are in a thesis not in the files). Both are BRE gas-burner emulations, not real fuels. 4) 5 s/2.2 s drop towers and aircraft tests (BRE SRD Table 1 D9023-D9030, Figs. 7-9 heptane at 30% O2 and 2 atm, Swenson 2011, Karnani 2009 NASA part) were excluded as not_ground_drop_or_parabolic. 5) Karnani 2009 text layer is slide titles only; figures were not visually inspected, so numeric conditions printed only in an image would be missed. 6) PSI-20 RDR/SCR 2012 concept documents were only sampled by page-level snippets, not read in full.

Cross-cutting (not PSI investigations, in data/raw/nasa): (1) ntrs-20000004509 (Olson and T'ien, Buoyant Low Stretch Diffusion Flames Beneath Cylindrical PMMA Samples): a genuine normal-gravity experiment paper: PMMA cylinders of radius 2.5 to 200 cm (Table 1, pdf page 28, ~8 stretch-rate rows) burning in air (text: 'full range of flammability in air'; ambient air density 1.176 kg/m3). O2 constant (air); pressure not stated (ambient implied); results in a table plus figures. Effort: needs reading. (2) ntrs-20150008961 (Olson and Ferkul, PMMA rods in concurrent flow, 2015): ISS BASS-II microgravity rods plus 5.18 s Zero Gravity Research Facility drop tests (excluded); the only 1 g items are general statements (1 g upward-spread limit 15.4 percent O2 with 4 cm/s forced flow cited from a reference); no 1 g test table. Overall: of the 18 investigations, only PSI-107 has a clean per-test 1 g table (SPICE, Dotson thesis Tables 6.3 and 6.4; O2 and pressure constant ambient air, not tabulated). PSI-25 has 1 g downward PMMA at 101 kPa / ~21 percent O2 but only as figures. PSI-99 has 1-g result columns with undocumented conditions. PSI-142 holds lab counterflow flame data without O2/pressure in the tables. PSI-101/102 ground tests are smoke particle sizes from heated samples (no flame, no O2/pressure). Drop-tower, KC-135 and ZGRF mentions (FLEX, FLEX-2, BASS, CFI, PSI-117) were excluded as not ground. Image labels 'ISS' and '1-g' (PSI-39 p3) and literature citations were not treated as ground tests. The pre-scan could not open one PSI-39 Analyzed Data PDF (FLEX-1248 Summary; flight data anyway).

## What would be needed to use any of it

Nothing in the downloaded files gives ground tests with oxygen and pressure per test in a table. The best route is PSI-107's Tables 6.3 and 6.4 (a table already), with O2 and pressure entered as ambient air by an explicit, labelled assumption (insufficient_evidence in the strict reading of the schema); the gas-jet smoke point is not a material-flammability test. Everything else would need figures digitized or the primary theses that are not in the library. Luis decides whether to extract.
