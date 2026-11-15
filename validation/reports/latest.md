# Validation report — 2026-11-15T03:43:39Z

Records: 10042 · trace check: ran · cells_traced: 8531 · quotes_traced: 942 · text_files_scanned: 59 · units_identity_no_unit_in_source: 207 · units_rechecked: 3250

**BLOCKER 0 · MAJOR 1 · MINOR 132**

| severity | check | where | what |
|---|---|---|---|
| MAJOR | units | `data/conditions/PSI-22.csv:31` | cannot recompute o2_mole_fraction: no known conversion 'on a volume basis' -> '1' |
| MINOR | consistency | `PSI-68 test Decane (pure)` | diluent lists ['He', 'N2'] in one source cell: summary row covering several conditions |
| MINOR | consistency | `PSI-68 test Ethanol (pure)` | diluent lists ['He', 'N2'] in one source cell: summary row covering several conditions |
| MINOR | consistency | `PSI-68 test Heptane (50%) IsoOctane (50%) (mixture)` | diluent lists ['He', 'N2'] in one source cell: summary row covering several conditions |
| MINOR | consistency | `PSI-68 test Heptane (pure)` | diluent lists ['He', 'N2'] in one source cell: summary row covering several conditions |
| MINOR | consistency | `PSI-68 test IsoOctane (pure)` | diluent lists ['He', 'N2'] in one source cell: summary row covering several conditions |
| MINOR | consistency | `PSI-68 test Propanol (80%) Glycerol (20%) (mixture)` | diluent lists ['He', 'N2'] in one source cell: summary row covering several conditions |
| MINOR | consistency | `PSI-68 test Propanol (95%) Glycerol (5%) (mixture)` | diluent lists ['He', 'N2'] in one source cell: summary row covering several conditions |
| MINOR | consistency | `PSI-68 test n-Octane (pure)` | diluent lists ['He', 'N2'] in one source cell: summary row covering several conditions |
| MINOR | language | `engine/README.md:246` | 'safe' in: Extrapolation levels (the verdict does not change): `ClusterVerdict.extrapolationLevel` and `InvestigationVerdict.extrap |
| MINOR | language | `web/lib/llm/safety.ts:40` | 'safe' in: * every harmful one): ask the first; if it says safe the input passes. If it flags, ask the second: refuse only if the s |
| MINOR | language | `web/lib/llm/safety.ts:58` | 'safe' in: /** One guard's opinion: true = flags, false = safe, null = could not answer. */ |
| MINOR | units | `data/conditions/PSI-26.csv:123` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.221 = 22.1 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:125` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.221 = 22.1 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:127` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.221 = 22.1 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:129` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.219 = 21.9 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:131` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.219 = 21.9 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:133` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.217 = 21.7 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:135` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.217 = 21.7 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:137` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.217 = 21.7 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:139` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21887043189368768 = 21.88704318 |
| MINOR | units | `data/conditions/PSI-26.csv:141` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21887043189368768 = 21.88704318 |
| MINOR | units | `data/conditions/PSI-26.csv:143` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21887043189368768 = 21.88704318 |
| MINOR | units | `data/conditions/PSI-26.csv:145` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21629213483146065 = 21.62921348 |
| MINOR | units | `data/conditions/PSI-26.csv:147` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21629213483146065 = 21.62921348 |
| MINOR | units | `data/conditions/PSI-26.csv:149` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21629213483146065 = 21.62921348 |
| MINOR | units | `data/conditions/PSI-26.csv:151` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.217 = 21.7 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:153` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.217 = 21.7 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:155` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.217 = 21.7 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:157` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.217 = 21.7 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:159` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.217 = 21.7 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:161` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21172171088251218 = 21.17217108 |
| MINOR | units | `data/conditions/PSI-26.csv:163` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21172171088251218 = 21.17217108 |
| MINOR | units | `data/conditions/PSI-26.csv:165` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21172171088251218 = 21.17217108 |
| MINOR | units | `data/conditions/PSI-26.csv:167` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21172171088251218 = 21.17217108 |
| MINOR | units | `data/conditions/PSI-26.csv:169` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21172171088251218 = 21.17217108 |
| MINOR | units | `data/conditions/PSI-26.csv:171` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21172171088251218 = 21.17217108 |
| MINOR | units | `data/conditions/PSI-26.csv:173` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21184054238011985 = 21.18405423 |
| MINOR | units | `data/conditions/PSI-26.csv:175` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21184054238011985 = 21.18405423 |
| MINOR | units | `data/conditions/PSI-26.csv:177` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21184054238011985 = 21.18405423 |
| MINOR | units | `data/conditions/PSI-26.csv:179` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21184054238011985 = 21.18405423 |
| MINOR | units | `data/conditions/PSI-26.csv:181` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.20889599147689442 = 20.88959914 |
| MINOR | units | `data/conditions/PSI-26.csv:183` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.20889599147689442 = 20.88959914 |
| MINOR | units | `data/conditions/PSI-26.csv:185` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.20889599147689442 = 20.88959914 |
| MINOR | units | `data/conditions/PSI-26.csv:187` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.20889599147689442 = 20.88959914 |
| MINOR | units | `data/conditions/PSI-26.csv:189` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21748625040439987 = 21.74862504 |
| MINOR | units | `data/conditions/PSI-26.csv:191` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21748625040439987 = 21.74862504 |
| MINOR | units | `data/conditions/PSI-26.csv:193` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21748625040439987 = 21.74862504 |
| MINOR | units | `data/conditions/PSI-26.csv:195` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21748625040439987 = 21.74862504 |
| MINOR | units | `data/conditions/PSI-26.csv:197` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21983426531024727 = 21.98342653 |
| MINOR | units | `data/conditions/PSI-26.csv:199` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21983426531024727 = 21.98342653 |
| MINOR | units | `data/conditions/PSI-26.csv:201` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21983426531024727 = 21.98342653 |
| MINOR | units | `data/conditions/PSI-26.csv:203` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21983426531024727 = 21.98342653 |
| MINOR | units | `data/conditions/PSI-26.csv:205` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21894414078122915 = 21.89441407 |
| MINOR | units | `data/conditions/PSI-26.csv:207` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21894414078122915 = 21.89441407 |
| MINOR | units | `data/conditions/PSI-26.csv:209` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21894414078122915 = 21.89441407 |
| MINOR | units | `data/conditions/PSI-26.csv:211` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21894414078122915 = 21.89441407 |
| MINOR | units | `data/conditions/PSI-26.csv:213` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2221985343104597 = 22.219853431 |
| MINOR | units | `data/conditions/PSI-26.csv:215` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2221985343104597 = 22.219853431 |
| MINOR | units | `data/conditions/PSI-26.csv:217` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2221985343104597 = 22.219853431 |
| MINOR | units | `data/conditions/PSI-26.csv:219` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2221985343104597 = 22.219853431 |
| MINOR | units | `data/conditions/PSI-26.csv:221` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2221985343104597 = 22.219853431 |
| MINOR | units | `data/conditions/PSI-26.csv:223` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.22383806099347453 = 22.38380609 |
| MINOR | units | `data/conditions/PSI-26.csv:225` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.22383806099347453 = 22.38380609 |
| MINOR | units | `data/conditions/PSI-26.csv:227` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.22383806099347453 = 22.38380609 |
| MINOR | units | `data/conditions/PSI-26.csv:229` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.22383806099347453 = 22.38380609 |
| MINOR | units | `data/conditions/PSI-26.csv:231` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.22721982701616103 = 22.72198270 |
| MINOR | units | `data/conditions/PSI-26.csv:233` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.22673656618610746 = 22.67365661 |
| MINOR | units | `data/conditions/PSI-26.csv:235` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.225254635675111 = 22.5254635675 |
| MINOR | units | `data/conditions/PSI-26.csv:237` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.225254635675111 = 22.5254635675 |
| MINOR | units | `data/conditions/PSI-26.csv:239` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.225254635675111 = 22.5254635675 |
| MINOR | units | `data/conditions/PSI-26.csv:241` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.22507182031862108 = 22.50718203 |
| MINOR | units | `data/conditions/PSI-26.csv:243` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.22583548563825623 = 22.58354856 |
| MINOR | units | `data/conditions/PSI-26.csv:245` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.22583548563825623 = 22.58354856 |
| MINOR | units | `data/conditions/PSI-26.csv:247` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.22583548563825623 = 22.58354856 |
| MINOR | units | `data/conditions/PSI-26.csv:249` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.22583548563825623 = 22.58354856 |
| MINOR | units | `data/conditions/PSI-26.csv:251` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.22583548563825623 = 22.58354856 |
| MINOR | units | `data/conditions/PSI-26.csv:253` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.215162301439728 = 21.5162301439 |
| MINOR | units | `data/conditions/PSI-26.csv:255` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2157922698897596 = 21.579226988 |
| MINOR | units | `data/conditions/PSI-26.csv:257` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2157922698897596 = 21.579226988 |
| MINOR | units | `data/conditions/PSI-26.csv:259` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2124492557510149 = 21.244925575 |
| MINOR | units | `data/conditions/PSI-26.csv:261` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2124492557510149 = 21.244925575 |
| MINOR | units | `data/conditions/PSI-26.csv:263` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2124492557510149 = 21.244925575 |
| MINOR | units | `data/conditions/PSI-26.csv:265` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2124492557510149 = 21.244925575 |
| MINOR | units | `data/conditions/PSI-26.csv:267` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2124492557510149 = 21.244925575 |
| MINOR | units | `data/conditions/PSI-26.csv:269` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2124492557510149 = 21.244925575 |
| MINOR | units | `data/conditions/PSI-26.csv:271` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2124492557510149 = 21.244925575 |
| MINOR | units | `data/conditions/PSI-26.csv:273` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2124492557510149 = 21.244925575 |
| MINOR | units | `data/conditions/PSI-26.csv:275` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2193393035902708 = 21.933930359 |
| MINOR | units | `data/conditions/PSI-26.csv:277` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2193393035902708 = 21.933930359 |
| MINOR | units | `data/conditions/PSI-26.csv:279` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2193393035902708 = 21.933930359 |
| MINOR | units | `data/conditions/PSI-26.csv:281` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2193393035902708 = 21.933930359 |
| MINOR | units | `data/conditions/PSI-26.csv:283` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1707 = 17.07 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:285` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1707 = 17.07 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:287` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.211 = 21.1 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:289` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.211 = 21.1 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:291` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.211 = 21.1 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:293` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.211 = 21.1 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:295` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.211 = 21.1 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:297` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21111 = 21.111 %, ambient air); |
| MINOR | units | `data/conditions/PSI-26.csv:299` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21111 = 21.111 %, ambient air); |
| MINOR | units | `data/conditions/PSI-26.csv:301` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2113 = 21.13 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:303` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.173 = 17.3 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:305` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.171 = 17.1 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:307` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.171 = 17.1 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:309` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.159 = 15.9 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:311` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1753 = 17.53 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:313` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1753 = 17.53 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:315` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.205 = 20.5 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:317` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1667 = 16.67 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:319` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1667 = 16.67 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:321` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.178 = 17.8 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:323` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21 = 21 %, ambient air); listed |
| MINOR | units | `data/conditions/PSI-26.csv:325` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.21 = 21 %, ambient air); listed |
| MINOR | units | `data/conditions/PSI-26.csv:327` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1734 = 17.34 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:329` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1734 = 17.34 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:331` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1605 = 16.05 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:333` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1605 = 16.05 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:335` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.163 = 16.3 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:337` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.163 = 16.3 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:339` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.172 = 17.2 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:341` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.172 = 17.2 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:343` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.171 = 17.1 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:345` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1713 = 17.13 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:347` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1717 = 17.17 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:349` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1717 = 17.17 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:351` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1724 = 17.24 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:353` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.1724 = 17.24 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:355` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.174 = 17.4 %, ambient air); lis |
| MINOR | units | `data/conditions/PSI-26.csv:357` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2118 = 21.18 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:359` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2118 = 21.18 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:361` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2118 = 21.18 %, ambient air); l |
| MINOR | units | `data/conditions/PSI-26.csv:363` | documented unit-label mismatch (o2_mole_fraction): unit-label-mismatch: header says % by volume; cells are fractions (0.2118 = 21.18 %, ambient air); l |
