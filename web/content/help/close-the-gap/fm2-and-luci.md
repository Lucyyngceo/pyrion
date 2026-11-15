---
id: fm2-and-luci
title: "FM2 and LUCI: what is stated, and what is not"
keywords: fm2, luci, planned experiments, lunar, moon, simulated partial gravity, rotating vehicle, synergy pro, 8.2 psia, what nasa plans, follow-on
chapter: 5
order: 6
dataHelp: [gap-section-planned, fm2-panel, tile-fm2-link]
sources: ["NTRS 20260001966 PDF pp. 5, 10", "NTRS 20250010653 PDF pp. 12, 17, 18, 43", "NASA FM2 web page (data/raw/nasa/crawl-...fm2...)"]
---

Two NASA experiments are about burning materials at lunar gravity: **FM2** (Flammability of Materials on the Moon, planned to launch in late 2026) and **LUCI** (a flight that burned samples under simulated lunar gravity). The plan lists what the NASA documents in the repository *state*, word for word.

**FM2** is stated as a plan, per material: *"FM2 plans four burns of one fabric (Synergy Pro "Navy") at 8.2 psia ± 0.3 psi with 37, 33, 29 and 25 % oxygen."* The NASA web page adds only that it burns four samples "in atmospheric conditions planned for future lunar habitats or vehicles"; the page states no oxygen or pressure. So FM2 is **not** stated to cover solids in general: it covers one fabric, at those conditions.

**LUCI** used a rotating vehicle: the gravity came from rotation (11 RPM at a radius of 1.22 m), a Coriolis force bends the flame, and in one burn the gravity level dropped at 125 s. Every statement about LUCI therefore carries **"simulated partial gravity (rotating vehicle)"**. It burned a cotton-fiberglass fabric and a 4-mm acrylic rod "in air at normal pressure"; the source gives no pressure figure in that passage. Its list of data (oxygen limits at lunar gravity, flame spread rate in exploration atmospheres) is under the heading "Potential Follow-on Objectives": PYRION calls it "listed by NASA as potential follow-on data, not results".

Where a source gives no figures, the plan says "not stated by the source" and does not guess.

## For engineers

`PLANNED_SOURCES` (`engine/src/experiments.ts`), each `{ id, name, file, page, slide?, quote, supports, qualifier? }`:

| id | Document | Page |
|---|---|---|
| `fm2-web` | FM2 NASA web page (`crawl-combustion-science-flammability-of-materials-on-the-moon-fm2-ecc5990d/page.html`) | web |
| `fm2-conditions` | NTRS 20260001966 | PDF p. 10 (slide 9): "Test 1: 8.2 psia (+/- 0.3 psi), 37% O2 ..." to "Test 4: ... 25% O2" |
| `fm2-fuel` | NTRS 20260001966 | PDF p. 10 (slide 9): "Fabric sheets (Synergy Pro "Navy") mounted between thin metal frames" |
| `fm2-limit` | NTRS 20260001966 | PDF p. 5 (slide 4): expected lunar LOC of 24-26 % |
| `luci-conditions` | NTRS 20250010653 | PDF p. 12: "Two samples are burned simultaneously in air at normal pressure ..." |
| `luci-rotation` | NTRS 20250010653 | PDF p. 12: 11 RPM, effective radius 1.22 m |
| `luci-coriolis` | NTRS 20250010653 | PDF p. 17: Coriolis force pulls the flame away from the fuel axis |
| `luci-gravity-drop` | NTRS 20250010653 | PDF p. 43: gravity starts dropping at t = 125 s |
| `luci-followon` | NTRS 20250010653 | PDF p. 18: "Potential Follow-on Objectives" |
| `luci-data` | NTRS 20250010653 | PDF p. 18: flammability limits (%O2), flame spread rate |

`LUCI_QUALIFIER = 'simulated partial gravity (rotating vehicle)'` (`experiments.ts:38`) is attached to every LUCI source, statement and measure (`qualifier`). `statements` (`plannedCoverage.statements`): `{ source: 'FM2' | 'LUCI', material, covered[], sentence }`; FM2's `material` is `Synergy Pro "Navy" fabric`.

FM2 covers a matrix point (`coveredByFm2`, `experiments.ts:303`) only when the target gravity regime is `partial_gravity`, pressure in psia is within 8.2 ± 0.3, and oxygen is within 0.5 % (relative) of 0.37, 0.33, 0.29 or 0.25. LUCI never marks points as covered, because its pressure is "normal pressure" without a figure.

Verified by test against the PDFs: every `quote` appears on its stated page (`engine/test/experiments.test.ts`, with `pdftotext`).
