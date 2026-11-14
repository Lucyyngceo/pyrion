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
