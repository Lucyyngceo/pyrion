# Audit of the language-model layer (Phase 1) — November 14, 2026

Scope: provider router, budget, content safety, `/api/ask`, `/api/llm/health`, prompts, parse and narration checks, Copilot tools, engine unit conversion. Two independent passes: (a) live behaviour tests against the running app with real provider keys; (b) a read-only adversarial code review by a separate agent that did not write the code. Findings below were confirmed against the code before being listed. Severity per `VALIDATION.md`.

## Live tests

| Test | Result |
|---|---|
| Benign fire-safety question ("which cabin materials burn more easily at 34 % O2 and 8.2 psia on the Moon") | passes the content check, parsed correctly; the engine converts 8.2 psia → 56.54 kPa |
| Question asking how to harm a crew with fire | refused by the content check (422) |
| Client asks for a model that is not configured | ignored; default model used |
| Keys in the client bundle (`.next/static`) | none; `.env.local` not tracked by git |
| Fallback provider (NVIDIA NIM, nemotron-3-ultra) on the parse step | **fails: "the model returned no text"** |
| Narration of a fabricated engine output sent by the client (PSI-999, fake DOI) | **narrated and approved by the check** |

## Findings

### BLOCKER
1. **Narration check does not bind numbers or verdict words to what they describe** (`web/lib/narration-check.ts`). A number passes if it matches any number in the engine output after rounding; verdict words are not checked. Swapped counts, a rounded pressure read as a count, or "PSI-69 is applicable" when it is an extrapolation all pass.
2. **The narrate step trusts engine output supplied by the client** (`web/app/api/ask/route.ts`). Demonstrated live. The check certifies whatever the client sent; the step also skips the content check and accepts 20,000 characters.
3. **The parse step does not enforce "copy as written"** (`web/lib/ask-core.ts`). A model that converts or invents a quantity ("10.2 psia" not in the question; "56.5 kPa" for "8.2 psia") goes straight into the target, and the displayed conversion hides it.
4. **A small gravity level is classified as partial gravity** (`engine/src/quantity.ts`, `regimeOfLevel`). "1e-4 g" becomes `partial_gravity`, turning every microgravity investigation into a regime barrier; "0 g" yields no regime.
5. **The fallback provider returns empty answers and the router accepts them** (`web/lib/llm/router.ts`). Reasoning models on NIM spend the token limit thinking and return no content (`finish_reason: length`); the router counts that as success instead of moving on.
6. **Spend control can be bypassed or reset** (`web/lib/llm/index.ts`, `budget.ts`). The visitor id hashes the first `X-Forwarded-For` entry and the user agent (client-controlled); the daily cap is in memory per process and resets on restart; `0` is read as the default; the client may pick the most expensive configured model.

### MAJOR
7. Narration check misses investigation names and acronyms that are not PSI ids, spelled-out numbers, and units.
8. Model "assumptions" are shown on the page without any check.
9. The page shows the requested model, not the one that answered after a fallback, and labels every model "open weights".
10. The content check runs before the rate limit and fails open; without NIM it never runs.
11. No overall deadline: worst case several minutes per step; client aborts are not propagated.
12. Common phrasings fail the engine parser ("normal air pressure", "1 atmosphere", "34% O2"), including one of the page's own examples.
13. Visitor map unbounded under spoofed ids, with an O(n) sweep per request.
14. Latent defects in Copilot tools (not yet wired): receipt lookup may return the investigation-wide value instead of the test's; `flex_model` asks the model for converted numbers.

### MINOR
15. Retry does not re-check the cap; 429 retried with no backoff.
16. Malformed narrate input fails after the paid call.

### Found fine
Keys never appear in responses, errors or the client bundle; provider failure reasons are not echoed; the no-key path returns structured mode; model text is escaped when rendered.

## Action
All BLOCKER and MAJOR findings are assigned for correction (engine: 4, 12; app: the rest). Round 2 re-checks only the corrected items and reruns the live tests above. The hard spending backstop is a limit on the OpenRouter key itself, set by the project owner.

## Round 2 (re-check of the corrected items only) — closed

Fixes: engine `9adbf6d`, `fd25896`; app `619f729`, `813250c`, `a457ae1`. Live tests after a clean server restart:

| Test | Result |
|---|---|
| Lunar habitat at 34 % O2 and 8.2 psia | model copies "8.2 psia"; engine converts to 56.54 kPa |
| "lunar base at 30% oxygen" | pressure stays `unstated` (finding 3 fixed) |
| "PMMA rod at 1e-4 g, 21% oxygen and 1 atm" | microgravity, with the stated convention note (finding 4 fixed) |
| Harmful question | refused by the content check |
| Fabricated engine output sent to the narrate step | rejected: the step accepts only a target and recomputes on the server (finding 2 fixed) |
| Narration of a real target | verdict counts and per-investigation lines written by code; model adds ≤60 words of context; check passes; response names the model that answered (findings 1, 9 fixed) |
| OpenRouter key deliberately invalid | the router marks the provider down and NVIDIA NIM (nemotron-3-ultra) answers, 16 s (finding 5 and a round-2 regression fixed) |

Found during round 2 and fixed: the per-call candidate cap could exhaust all three primary models on a provider-wide error (401/402) without reaching the fallback; the cap is now per provider and a provider-wide error skips the provider for 5 minutes.

Open notes, not defects: the fallback takes about 16 s (inside the 25 s deadline); in production `PYRION_TRUST_PROXY=1` must be set behind nginx, otherwise all visitors share one hourly bucket; "open weights" stays off until each model's license is checked.

## Round 3 (full re-audit after the open notes were resolved) — November 14, 2026

The three open notes were resolved in `ead8212` (app) and `docs/DEPLOY.md`:
- **Fallback speed.** NIM models marked `thinking: false` get `chat_template_kwargs: {enable_thinking: false}`. Measured on the parse prompt, nemotron-3-ultra goes from 16 s to 2.7 s in total and still copies quantities as written. mistral-large-4 timed out at 40 s and was removed.
- **Open weights.** Each model is labelled only from a table checked against its model page (license plus source link). The models used are Qwen3.8-27B (Apache-2.0), Kimi-K2.6 (Modified MIT), gemma-4-31b-it (Apache-2.0) and Nemotron 3 Ultra (OpenMDW-1.1 per the NVIDIA NGC catalog). Models whose license could not be confirmed were removed from the lists. Safety-check models carry no label.
- **Visitor isolation.** In production without `PYRION_TRUST_PROXY=1`, an error is logged and `GET /api/llm/health` reports `visitor_isolation: false`. `docs/DEPLOY.md` covers the rest: nginx overwrites `X-Real-IP` and Node is bound to 127.0.0.1.

The live tests ran after a clean restart.

| Test | Result |
|---|---|
| OpenRouter key deliberately invalid (twice) | NIM nemotron-3-ultra answers in 2.7 s; it copies "21%" and "1 atm" |
| Lunar habitat at 34 % O2 and 8.2 psia | partial gravity 0.165 g (with the preset note); 8.2 psia → 56.54 kPa by the engine |
| "lunar base at 30% oxygen" | pressure stays `unstated` |
| "PMMA rod at 1e-4 g, 21% oxygen and 1 atm" | microgravity with the convention note; the inferred fuel phase is labelled as inferred |
| Harmful question | 422, content check `flagged` |
| Forged engine output sent to narrate | 400 "target has unknown fields" |
| Client asks for an unconfigured model | ignored; default model, labelled Apache-2.0 with source |
| Narration of the lunar target | code-written verdicts (18 investigations: 3 insufficient evidence, 15 regime barrier); model context passes the check |
| Server log | no errors |

An independent read-only review (separate agent) ran next. It found web 49/49 and engine 153/153 tests passing, no BLOCKERs, and no regressions from `ead8212`. Of the 16 earlier findings, 12 are fully fixed and 4 partly fixed; the remaining gaps are the new items below.

### New findings (assigned to the app)
- **MAJOR N1.** The narration check accepts verdict claims that have no id, negated verdicts ("isn't applicable") and unknown units. Before the fix, the model's context could contradict the verdicts that code wrote.
- **MAJOR N2.** The narrate step had no per-visitor limit, so a script could loop it.
- **MINOR N3.** "Copy as written" checked numbers but not their units or which quantity they belong to.
- **MINOR N4.** The content check sat outside the 25 s deadline and ignored client aborts.
- **MINOR N5.** The "same SHA-256 under N models" line ignored failed runs.
- **MINOR N6.** One UI sentence overclaimed that all model text is checked, while some raw model text appears in warnings.

To avoid an endless audit loop, these items are closed by targeted tests, not by another full review.

### Closure (fixes in `72d73e8`)
| Item | Check | Result |
|---|---|---|
| N1 | 13 attack sentences against `checkNarration`: the reviewer's 9 plus 4 new ones (claims with no id, negations, "can be extrapolated" against a regime barrier, wrong units), and 4 legitimate sentences | 13 rejected, 4 accepted |
| N2 | the narrate step repeated live against the server | 10 calls on the paid provider, then the free fallback, then 429 at the per-visitor limit |
| N3 | unit test: the unit must match the one written in the question; one number feeds one quantity | pass |
| N4 | code: one deadline per step, started before the content check, combined with the request's abort signal | confirmed (`route.ts:57-73`, `safety.ts:34`) |
| N5 | code: `same` requires every run to have a hash | confirmed (`AskBox.tsx:146`) |
| N6 | quoted model text is truncated and labelled "model text (not used)"; the overclaiming sentence is removed | confirmed |

Tests: web 57/57, engine 153/153. **Phase 1 is closed: no open BLOCKER or MAJOR.**
