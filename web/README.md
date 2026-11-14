# PYRION web app

The interface of PYRION: the **evidence envelope** of NASA PSI combustion data and a deterministic
applicability verdict for a target condition.

No API key and no language model are needed. Everything on the page is computed from the condition
records in [`../data/conditions/`](../data/conditions/) and the investigation list in
[`../data/manifest/investigations.csv`](../data/manifest/investigations.csv).

## Run it

Requires Node.js 20.9 or newer.

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:3000>.

Production build:

```bash
npm run build
npm start
```

The app reads `../data` relative to the `web/` folder. To read another folder, set `PYRION_DATA_DIR`.

## What the page shows

1. **The evidence envelope.** Every extracted test point, O₂ mole fraction against pressure, one layer per
   regime combination (gravity regime · fuel phase · diluent), with the convex hull of each layer.
2. **Target condition.** Presets with their sources (the challenge statement and NASA/TM-20260003925) and
   custom values. The target is the ringed marker on the chart.
3. **Applicability, one row per investigation.** A verdict badge, the reasons, and a receipt: every value
   used links to the investigation DOI and to the file and location it was read from.

| Verdict | Meaning |
|---|---|
| `APPLICABLE` | same regime, and the target is inside the measured envelope |
| `EXTRAPOLATION` | same regime, but outside the measured envelope |
| `INSUFFICIENT_EVIDENCE` | the extracted records do not state enough to compare |
| `REGIME_BARRIER` | different gravity regime, fuel phase or diluent: not comparable, no distance |

## Data states

- **PSI data:** when `data/conditions/*.csv` holds records, the page uses them and says how many are
  verified by a person.
- **Synthetic demo data:** when it holds none, the page uses invented fixtures named `DEMO-A` to `DEMO-G`
  and shows a banner saying they are not NASA measurements.

## Code map

| Path | What |
|---|---|
| `app/page.tsx` | server component: reads the data folder |
| `components/EnvelopeChart.tsx` | the envelope chart (hand-written SVG, no chart library) |
| `components/TargetPanel.tsx` | presets and custom target |
| `components/Results.tsx` | verdict rows and receipts |
| `lib/engine-adapter.ts` | the one place that calls the applicability engine |
| `lib/presets.ts` | target presets with their sources |
