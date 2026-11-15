# PYRION Ω — The Evidence Envelope

**NASA Space Apps Challenge 2026** · Challenge: *Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data* · Team **NDMLM** · Local event: San José, Costa Rica

> Built during the NASA Space Apps Challenge hackathon, November 14–15, 2026.

PYRION shows how far NASA's Physical Sciences Informatics (PSI) combustion data reaches for a fire question.
It plots every extracted PSI test point as an evidence envelope (O₂ against pressure) and gives a deterministic verdict on whether a target condition lies inside the region spanned by tested points.
Every test point is cited to its PSI investigation (DOI and license on the Data page), and the verdict says when a condition lies outside what PSI tested.
It is for spacecraft and habitat fire-safety engineers, students and researchers who need to know what PSI already tested and what it did not.
No API key and no language model are needed for the envelope and the verdict: the engine is pure TypeScript and runs in the browser.

## Try it

- [Envelope with the Moon Base preset](https://pyrion.us/envelope?preset=challenge-lunar-base)
- [Mission Planner](https://pyrion.us/planner)
- [Investigations](https://pyrion.us/investigations)
- [TARS SI](https://pyrion.us/tars)

## Run locally

Requires Node.js 20.9 or newer (`web/README.md`); the public instance runs Node 24 (`docs/DEPLOY.md`). A clean clone builds and passes its tests; the TARS library (`web/.data/corpus/`) is regenerated from `data/raw/` with `tools/build_corpus.py` (see `docs/DEPLOY.md`).

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:3000>. Production build:

```bash
npm run build
npm start
```

Tests and type check (scripts in `web/package.json`):

```bash
npm test
npm run typecheck
```

The public instance behind nginx, as in `docs/DEPLOY.md`:

```bash
PYRION_TRUST_PROXY=1 PYRION_PROXY_SECRET="<same long random value>" NODE_ENV=production npm --prefix web run start -- -H 127.0.0.1 -p 3000
```

## Features

- **Evidence envelope** (`/`): every extracted PSI test point, O₂ mole fraction against pressure, with a deterministic applicability verdict for a target condition and presets such as the Moon Base band.
- **Mission Planner** (`/planner`): how much of the Moon Base oxygen-pressure band lies inside the region spanned by PSI test points, what FM2 as planned would add, and the fewest test points that would span the band under a stated geometric convention (not a test programme). Evidence coverage, not a prediction.
- **Investigations** (`/investigations`): one sheet per PSI combustion investigation, a side-by-side comparison (`/investigations/compare`) and a materials view (`/investigations/materials`).
- **Lenses** (`/lenses`): PSI investigations by safety leg (prevention, detection, suppression) and phenomenon, each tag with a verbatim quote, a filter by leg, and the evidence timeline.
- **More** (`/more`): fire-safety equipment and Earth uses, quoted from PSI records and the NASA Space Apps 2026 challenge statement, plus spacesuits and rockets as out of PSI scope.
- **TARS SI** (`/tars`): an AI assistant that answers in labelled layers: what the engine computed, what NASA wrote (quote checked on its page) and its own reasoning (not verified); it runs in structured mode when no API key is set (`web/.env.example`).
- **Bridge** (`/bridge`): a labelled hypothesis relating microgravity tests to other gravity levels through flame stretch rate. Not evidence.
- **Method, Data and Proof** (`/method`, `/data`, `/proof`): how a verdict is decided, what was extracted from each investigation (DOI and license), and the repository numbers read at build time.
- **Help** (`/help`): every control on the site has a help topic.


## What it is

PYRION is being built to rank NASA combustion experiments by how physically applicable they are to a target condition (gravity level, oxygen concentration, pressure, fuel type) and to show where the measured evidence ends.

A condition between tested values counts as comparable, although no test was necessarily run at that exact point and PYRION computes no value there. Across a change of physical regime, such as microgravity versus partial gravity, nothing counts as comparable. It reports the gap instead.

The applicability verdict is computed by a deterministic engine. A language model is used only to parse inputs and to narrate results. It never decides the verdict.

## Data

Primary source: NASA Physical Sciences Informatics (PSI), <https://psi.nasa.gov>: the 24 investigations in the Combustion Science research area.
Each investigation is cited with its DOI and the license its PSI record states (the PSI-10 record states none) in [`data/manifest/investigations.csv`](data/manifest/investigations.csv).
How the data are selected, downloaded and checked: [`data/README.md`](data/README.md).

## Provenance

Development started on November 14, 2026, after the hackathon opened at 09:00 CST (UTC−6). Pre-event work was conceptual only: challenge study and scope decisions. Server-side push timestamps and CI run logs are available in the repository history.

## How it was built

One person (team NDMLM) working from two computers. Data, extraction, engine and validation were built on one; the interface redesign was built on the other in branch `laptop/ui` and merged through pull request #1. Every push carries a server-side provenance stamp (GitHub Actions, workflow `provenance`).

## Use of AI (SI) tools

NASA Space Apps asks every team to declare its use of Artificial Intelligence / Super Intelligence. This is the full declaration. The trail is in git: every AI-assisted commit carries a `Co-Authored-By` line naming the model.

**Who did what.** One person (Luis Johan Elizondo Arias, team NDMLM) directed the project, made every decision, wrote the personal text on the Why page, and checked the work. The code, data extraction, tests, documentation and this README were written with AI assistance, under his direction, during the event.

**Tools used to build the project (development time):**

| Tool | Models | Used for |
|---|---|---|
| Claude Code (Anthropic) | Claude Opus 5.5, Claude Sonnet 5.5, Claude Fable 5.2 | Writing the engine, the web app, the validators and tests; extracting condition values from NASA documents (with a verbatim quote and location for every value, then checked by code); reviews and audits by separate AI reviewer agents; documentation. Several Claude Code sessions ran in parallel, each on one part (engine, app, extraction), coordinated by one session. |
| Claude Code on a second computer | Claude models | The interface redesign, merged through pull request #1. |
| GPT (OpenAI) | GPT-6.1 Terra | The Investigations pages, the compare and materials views, and the unified downloadable dataset (built from a written brief by the coordinating Claude session, reviewed by a separate AI reviewer agent before commit). Log: `notes/GPT-CHANGES.md`. |
| Grok (xAI) | Grok | The safety/phenomenon lenses (each tag with a quote verified by script), the evidence timeline and the More page; also planning notes and adversarial questions in a private working repository. Log: `notes/GROK-CHANGES.md`. |

**Models that run inside the app (run time).** All of them have open weights with a license checked on the model's own page; the page names the model that answered every question.

| Role | Model | License | Provider |
|---|---|---|---|
| TARS SI brain (chat, reading questions) | GLM-5.3 (Z.ai) | GLM-5.3 License | OpenRouter |
| Fallback | Qwen3.8-27B | Apache-2.0 | OpenRouter |
| Free fallback | NVIDIA Nemotron 3 Ultra; Gemma 4 31B | OpenMDW-1.1 (per NVIDIA NGC); Apache-2.0 | NVIDIA NIM |
| Content check on questions | NVIDIA Nemotron safety guard 8B v3, then Llama Guard 4 12B as second opinion | as published by NVIDIA and Meta | NVIDIA NIM |
| Text-similarity baseline (the "text vs physics" comparison) | BAAI bge-small-en-v1.5 | MIT | local (fastembed) |

**What the AI does not do.** No model decides a verdict: the applicability engine is plain TypeScript rules over the extracted records, and it gives the same verdict with any model or with none. Models never convert units or do arithmetic (code does), every NASA quote a model shows is checked by code against the page it cites, and any number in the model's own reasoning that does not come from a source or a calculation is removed before it is shown. Without any model key the site works in structured mode.

**What was checked by people and by code.** Every extracted value was located by code in its NASA source file (table cell at its row and column, or quote found word for word with its numbers as written). Reviews of the data and the engine were run by separate AI reviewer agents; they are not NASA review or expert validation.

## TARS library

The library TARS reads: the page-by-page text of the NASA documents downloaded under `data/raw/` (PSI reports, presentations, readmes and investigation records; NTRS papers and presentations; NASA-STD-6001B; JSC 29353D; NASA web pages). It is the only text TARS answers from, so every claim can be checked by code against the page it came from.

- **The text comes from code, not from a model.** PDF pages come from PyMuPDF `page.get_text()` (the call the validator uses), DOCX/PPTX/XLSX from their XML, web pages from the standard-library HTML parser, tables from the `csv` module. Nothing is OCR'd, summarised or rewritten; pages with no text layer are skipped and listed.
- **Rebuild** (about 70 s, deterministic: the same files give the same `pages.jsonl` hash):

  ```bash
  python -I tools/build_corpus.py
  python -I tools/build_corpus.py --search "limiting oxygen concentration BASS-II"
  ```

- **Output** in `web/.data/corpus/` (git-ignored, regenerable from `data/raw/`): `pages.jsonl` (one line per page with document, accession or NTRS id, 1-based PDF page, printed page when detectable, citation URL, DOI, SHA-256 of the file), `chunks.jsonl` (~320-word chunks with 50-word overlap, each pointing to its pages), `bm25.json` (a BM25 index, no model needed), `no_text_pages.json`, `skipped.json`, `corpus_manifest.json`.
- **Not read:** binary formats (`.xls`, `.doc`, `.ppt`), `.zip`, `.dat`, images and video, files identical to another by SHA-256, and one PDF that PyMuPDF cannot open (listed in `skipped.json`). Tables are included as header plus the first rows only; the numbers used by the engine live in `data/conditions/`. DOCX has no pages, so its pseudo-pages are blocks of paragraphs (`paragraph=a-b`).

## License

Code: Apache License 2.0, see [LICENSE](LICENSE).
Data from NASA PSI keeps its own terms, listed per investigation.
