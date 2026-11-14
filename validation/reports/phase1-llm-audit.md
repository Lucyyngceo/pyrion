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
