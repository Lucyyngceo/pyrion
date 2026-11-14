# Models

**Class B results ("evaluated model"). Never evidence, never a verdict.** Everything in this folder is computed from the PSI condition records or from PSI text. It is deterministic (fixed seeds) and runs with `python -I`. Outputs go to `data/derived/`.

## `build_text_similarity.py`: what a standard embedding search would retrieve

```bash
python -I models/build_text_similarity.py   # needs fastembed and the model files already in its cache
```

Output: `data/derived/text_similarity.json`.

- **Model:** `BAAI/bge-small-en-v1.5`, MIT license, 384 dimensions, through fastembed. The file fastembed uses is the int8-quantized ONNX build from the Hugging Face repo `Qdrant/bge-small-en-v1.5-onnx-Q` (`model_optimized.onnx`); its SHA-256 is recorded in the JSON.
- **Documents (24):** one text per PSI combustion investigation: acronym, title, objective and approach from the PSI record JSON, and the titles of the publications PSI lists (`data/manifest/publications.csv`). Texts longer than 512 tokens are truncated by the model's tokenizer.
- **Queries (4):** exactly the text the web app feeds its TF-IDF panel, `${preset.description} ${targetRegimeName(regime)}` (`web/components/Explorer.tsx`), built with the app's starting regime (liquid fuel, N₂ diluent) and each preset's gravity regime. The script asserts the app's source lines it relies on and stops if they change.
- **Ranking:** cosine similarity of normalized embeddings, all 24 investigations per preset, with the scores.
- **What it is for:** the side-by-side "text similarity vs physics" comparison. It sees words, not gravity, fuel phase, oxygen or pressure, and it never changes a verdict.

## `flex_model.py`: FLEX droplet burn time with uncertainty

```bash
python -I models/flex_model.py   # numpy and scipy only, about 20 seconds, seed 20261114
```

Output: `data/derived/flex_model.json`. Data: the PSI-69 (FLEX) condition records that have `droplet_diameter_initial`, `o2_mole_fraction`, `pressure`, `outcome:burn_time` and `fuel` (table records with status `extracted`): **259 tests, 152 methanol and 107 heptane**. Ranges: methanol d0 1.61–4.53 mm, O₂ 0.12–0.34, 70–309 kPa; heptane d0 1.1–4.67 mm, O₂ 0.13–0.34, 70–207 kPa. Each fuel has its own model (fuel is a regime).

### (a) The d²-law check

Classical d²-law: burn time grows with the square of the initial diameter, so n = 2 in `log(t) = a + n·log(d0) + …`. Ordinary least squares with linear terms in O₂ and pressure, 95 % percentile bootstrap interval of n (2000 seeded resamples):

| Fuel | n (with O₂ and pressure) | 95 % interval | n (d0 only) | 95 % interval |
|---|---|---|---|---|
| Methanol | 1.64 | 1.11 to 2.11 | 1.82 | 1.35 to 2.27 |
| Heptane | **0.19** | **−0.17 to 0.56** | 0.64 | 0.11 to 1.12 |

What the data say: for methanol the interval contains 2; for heptane it does not, and with O₂ and pressure in the model it contains 0, so the burn time of the recorded heptane tests does not grow with d0 in this data set. This is reported as found, not explained away. The records give the time to the **end of the test**, which is extinction (heptane 57 of 107 tests, methanol 121 of 152), droplet disruption (31 and 23) or completion (19 and 8), not burnout; a test that ends in extinction at a finite droplet size has no reason to follow the d²-law. As a sensitivity check, leaving out the disruption tests gives n = −0.23 (−0.61 to 0.08) for heptane and 1.56 (1.00 to 2.07) for methanol. The diluent (N₂, CO₂, He mixtures) is not an input and is part of the scatter; R² is 0.49 (heptane) and 0.34 (methanol).

### (b) Gaussian-process model

Per fuel: GP on `log(burn_time)`, inputs d0, O₂ and pressure (standardized), ARD squared-exponential kernel plus noise; hyperparameters by marginal likelihood (L-BFGS-B, eight deterministic starts). Numbers are on the log scale (an RMSE of 0.4 is a factor of about 1.5).

| Fuel | 5-fold CV RMSE | baseline (predict the training mean) | coverage of the 68 % interval | coverage of the 95 % interval |
|---|---|---|---|---|
| Methanol | 0.560 | 0.751 | 0.816 | 0.947 |
| Heptane | 0.403 | 0.825 | 0.701 | 0.935 |

Calibration: heptane is close to nominal (0.70 for 68 %, 0.93 for 95 %); methanol is **over-cautious at 68 %** (0.82) and close to nominal at 95 %. The model beats the baseline in both fuels, but the methanol gain is modest.

Extrapolation, with the held-out block entirely outside the training range of that input:

| Fuel | Held out | n test | RMSE | baseline | coverage 68 % | coverage 95 % |
|---|---|---|---|---|---|---|
| Methanol | O₂ > 0.23 (training 0.12–0.23) | 21 | 0.315 | 0.536 | 1.00 | 1.00 |
| Methanol | pressure < 71.2 kPa (training 71.2–309) | 21 | 0.683 | 0.959 | 0.62 | 0.81 |
| Heptane | O₂ > 0.24 (training 0.13–0.24) | 12 | 0.866 | 0.983 | 0.58 | 1.00 |
| Heptane | pressure < 71.1 kPa (training 71.1–207) | 15 | 0.567 | 0.937 | 0.40 | 1.00 |

When extrapolating, the intervals are not reliable: the low-pressure blocks under-cover (methanol 0.81 at 95 %, heptane 0.40 at 68 %) and the heptane high-O₂ error is close to the baseline. The blocks are small (12 to 21 tests), so the coverage numbers are noisy.

### (c) Grid, with the hull flag

`grid` in the JSON: O₂ 0.10–0.40 (step 0.02) × pressure 40–400 kPa (step 30) at three diameters (the 25th, 50th and 75th percentiles of the training d0), with the predictive sd. The mean (`mean_log_burn_time`, `mean_burn_time_s`) is given **only** where `inside_training_hull` is true: the convex hull (`scipy.spatial.Delaunay`) of the standardized training inputs. At the middle diameter 41 of 208 cells (methanol) and 21 of 208 (heptane) are inside; the training tests sit at a few discrete O₂ and pressure combinations, so the hull is much smaller than the box.

### (d) Experiment designer

Per fuel, over a stated candidate grid (6 × 6 × 6 points between the training minimum and maximum of each input, microgravity droplet conditions only), the five conditions chosen greedily to most reduce the summed posterior variance of the latent function over the same grid, with the fitted hyperparameters held fixed. Five picks remove 29.5 % (methanol) and 30.7 % (heptane) of the total variance. **None of the ten picks lies inside the training hull**: the designer asks for conditions at the edges of the box (for example methanol d0 3.36 mm, O₂ 0.296, 261 kPa), where the model knows least. It is a suggestion of informative tests, not a prediction of what they would show.

### Limits

- Class B: a statistical description of 259 tests, not evidence, and nothing here feeds a verdict.
- GP uncertainty growing away from data is a property of the kernel and the spread of the training points, not a measurement.
- No gravity extrapolation: every FLEX test is a microgravity droplet test; the model says nothing about other gravity levels.
- Two fuels only; the diluent and the way the test ended are not inputs.
- The test conditions are nominal (the table gives the initial ambient composition and pressure); vitiation and pressure change during a test are not modelled.
