# PYRION web app

The interface of PYRION: the **evidence envelope** of NASA PSI combustion data and a deterministic
applicability verdict for a target condition.

No API key and no language model are needed. Every verdict and every envelope is computed by the
PYRION engine in [`../engine/`](../engine/) from the condition records in
[`../data/conditions/`](../data/conditions/); citations come from
[`../data/manifest/investigations.csv`](../data/manifest/investigations.csv). The engine core is pure
TypeScript, so it runs in the browser and the verdict updates as the target changes.

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
2. **Target condition.** Presets with their sources, quoted with page numbers (the challenge statement,
   NASA/TM-20260003925, NTRS 20210020446), and custom values. Regime axes a source does not state are
   left to the user and labelled as their choice. The target is the ringed marker on the chart.
3. **Applicability, one row per investigation.** A verdict badge, the reasons, and a receipt: every value
   used links to the investigation DOI and to the file and location it was read from.

| Verdict | Meaning |
|---|---|
| `APPLICABLE` | same regime, and the target is inside the measured envelope |
| `EXTRAPOLATION` | same regime, but outside the measured envelope |
| `INSUFFICIENT_EVIDENCE` | the extracted records do not state enough to compare |
| `REGIME_BARRIER` | different physical regime (gravity regime, fuel phase, diluent, flame type): not comparable, no distance |

The chart's headline (inside, outside, undetermined) is derived only from these verdicts and from the
engine's `locateTarget` geometry.

## Data states

- **PSI data:** when `data/conditions/*.csv` holds records, the page uses them and says how many are
  verified by a person.
- **Synthetic demo data:** when it holds none, the page uses the engine's synthetic test fixtures
  (`engine/test/fixtures/synthetic/`, accessions PSI-9001 to PSI-9007, which do not exist in PSI) and
  shows a banner saying they are not NASA measurements.

## Code map

| Path | What |
|---|---|
| `app/page.tsx` | server component: reads the data folder |
| `components/EnvelopeChart.tsx` | the envelope chart (hand-written SVG, no chart library) |
| `components/TargetPanel.tsx` | presets and custom target |
| `components/Results.tsx` | verdict rows and receipts |
| `lib/engine.ts` | the one place that imports the engine |
| `lib/data.ts` | server-side reading of `data/` (CSV text is passed to the browser and parsed there by the engine) |
| `lib/presets.ts` | target presets: the engine's, plus the ISS cabin preset with its source |

## Ask PYRION (optional language model)

The page runs fully without a key (structured mode). With a key, an input at the top of the home page accepts a question. The language
model translates and narrates; **the engine decides**.

1. The model turns the question into a JSON target (regime axes and O₂, pressure, gravity, `null` where the question states nothing).
   Code validates it with the engine's `validateTarget`, and the page shows "PYRION understood: …" before anything else.
2. The deterministic engine computes the verdicts, exactly as without a model.
3. The model narrates the engine's structured output in at most 120 words. A narration check in code (`lib/narration-check.ts`) requires
   every number, investigation id and DOI to appear in that output and no banned phrase to be present. If it fails, the text is
   withheld and the failures are listed.
4. With several models configured, the same question can be re-run with another one. The SHA-256 of the engine's canonical output is
   shown for each run; the same hash means the same verdict, different words.

Configure on the server only, in `web/.env.local` (git-ignored; names in `.env.example`):

```bash
PYRION_LLM_BASE_URL=https://integrate.api.nvidia.com/v1   # any OpenAI-compatible endpoint
PYRION_LLM_API_KEY=...                                     # never sent to the browser, never logged
PYRION_LLM_MODELS=model-id-1,model-id-2                    # the first is the default
```

Without these, `/api/ask` answers 503 and the page shows "Structured mode: add a key to enable questions". All prompts are in
[`lib/prompts.ts`](lib/prompts.ts) (plain text, versioned). Pure logic is unit-tested: `npm test`.
