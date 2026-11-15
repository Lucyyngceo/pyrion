// Server only. Question translation and narration through the provider router (OpenRouter first, NVIDIA NIM as fallback).
// Keys live in the server environment (see web/.env.example): never sent to the client, never logged.
//
// Parse: the model copies the quantities as the question wrote them; code verifies they are in the question and the
// engine converts them. Narrate: the client sends only a target; the server runs the engine itself, writes the counts and
// verdicts with code, asks the model for context only, and checks that context before it can reach the page.

import { NoModelAvailable, RateLimited, askLlm, budget, checkContent, providers, selectableModels, visitorId } from "@/lib/llm";
import { openWeightsLabel } from "@/lib/llm/config";
import { NARRATE_SYSTEM, PARSE_SYSTEM, PROMPT_VERSION } from "@/lib/prompts";
import { buildNarrationInput, parseTargetReply, renderVerdicts, shapeTarget } from "@/lib/ask-core";
import { cleanModelText } from "@/lib/llm/clean";
import { checkNarration, modelText } from "@/lib/narration-check";
import { evaluateOnServer } from "@/lib/server-eval";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const STRUCTURED = "Structured mode: no language model is available right now. Pick a preset or set the target by hand; every verdict still works.";
const DEADLINE_MS = 25_000;

/** Whether questions are enabled and which models a visitor can choose. No secret is returned. */
export async function GET() {
  const models = providers().length ? selectableModels() : [];
  return json({ enabled: models.length > 0, models, promptVersion: PROMPT_VERSION });
}

const metaOf = (m: { model: string; provider: string; latency_ms: number; fell_back_from?: string }) => ({
  provider: m.provider,
  model: m.model,
  latency_ms: m.latency_ms,
  fell_back_from: m.fell_back_from ?? null,
  // Only a verified table entry is called open weights, with its license and source; anything else carries no label.
  open_weights: openWeightsLabel(m.model),
});

const parsesAsObject = (t: string) => {
  try {
    const x = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    return x !== null && typeof x === "object";
  } catch {
    return false;
  }
};

export async function POST(req: Request) {
  if (providers().length === 0) return json({ error: `Structured mode: add a key to enable questions. ${STRUCTURED}` }, 503);
  let body: { step?: unknown; model?: unknown; question?: unknown; target?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "the request body is not JSON" }, 400);
  }
  // Visitors may choose only the models PYRION_CLIENT_MODELS allows; anything else uses the default.
  const model = typeof body.model === "string" && selectableModels().includes(body.model) ? body.model : undefined;
  const visitor = visitorId(req);
  // One deadline for the whole step, started now: the content check and the model calls share it.
  const started = Date.now();
  const deadline = AbortSignal.any([req.signal, AbortSignal.timeout(DEADLINE_MS)]);
  const remaining = () => Math.max(1000, DEADLINE_MS - (Date.now() - started));

  try {
    if (body.step === "parse") {
      const q = typeof body.question === "string" ? body.question.trim() : "";
      if (q === "" || q.length > 500) return json({ error: "the question must be 1 to 500 characters" }, 400);
      // The rate limit comes first: a visitor over the limit costs nothing, not even a safety call.
      budget().visitor(visitor);
      budget().recordSafety();
      const safety = await checkContent(q, providers(), undefined, undefined, deadline);
      const safetyState = safety.flagged ? "flagged" : safety.checked ? "checked" : "unavailable";
      if (safety.flagged) return json({ error: "PYRION cannot help with that question. Ask about a combustion condition instead.", safety: safetyState }, 422);
      // Reasoning models on the fallback provider need room to think before the JSON.
      const c = await askLlm({ model, signal: req.signal, deadlineMs: remaining(), maxTokens: 2000, validate: parsesAsObject, messages: [{ role: "system", content: PARSE_SYSTEM }, { role: "user", content: q }] }, visitor);
      const reply = c.json?.choices?.[0]?.message?.content;
      if (typeof reply !== "string") return json({ error: "the model returned no text" }, 502);
      let parsed;
      try {
        parsed = parseTargetReply(cleanModelText(reply), q);
      } catch (e) {
        return json({ error: `The question could not be turned into a valid target. ${modelText(e instanceof Error ? e.message : "invalid reply")}`, safety: safetyState, ...metaOf(c.meta) }, 422);
      }
      return json({ meta: metaOf(c.meta), promptVersion: PROMPT_VERSION, safety: safetyState, parsed });
    }

    if (body.step === "narrate") {
      // Shape and engine validation happen before any paid call; the client's target is the only thing trusted from it.
      const shaped = shapeTarget(body.target);
      if (!shaped.ok) return json({ error: shaped.error }, 400);
      // Same limit as the parse step, counted before the engine runs or any model is called.
      budget().visitor(visitor);
      const { evaluation, investigations, sha256 } = await evaluateOnServer(shaped.target);
      const { input, facts } = buildNarrationInput(evaluation, investigations, shaped.target);
      // Counts and verdicts are written by code. The model adds context only.
      const verdictLines = renderVerdicts(input);
      let context: string | null = null;
      let check: { ok: boolean; failures: string[] } = { ok: true, failures: [] };
      let meta = null;
      try {
        const c = await askLlm({ model, signal: req.signal, deadlineMs: remaining(), maxTokens: 1200, validate: (t) => t.length > 0, messages: [{ role: "system", content: NARRATE_SYSTEM }, { role: "user", content: JSON.stringify(input) }] }, visitor);
        meta = metaOf(c.meta);
        const text = c.json?.choices?.[0]?.message?.content;
        if (typeof text === "string") {
          check = checkNarration(cleanModelText(text), facts);
          context = check.ok ? cleanModelText(text) : null;
        }
      } catch (e) {
        if (e instanceof RateLimited || e instanceof NoModelAvailable) {
          // The verdicts are still there: the model's part is optional.
          return json({ meta: null, promptVersion: PROMPT_VERSION, engine_sha256: sha256, verdicts: verdictLines, context: null, check: { ok: true, failures: [] }, narration_unavailable: true });
        }
        throw e;
      }
      return json({ meta, promptVersion: PROMPT_VERSION, engine_sha256: sha256, verdicts: verdictLines, context, check });
    }
    return json({ error: "unknown step" }, 400);
  } catch (e) {
    if (e instanceof RateLimited) return json({ error: e.message }, 429);
    if (e instanceof NoModelAvailable) return json({ error: STRUCTURED }, 503);
    if (e instanceof Error && e.name === "AbortError") return json({ error: "the request was cancelled" }, 499);
    return json({ error: "the language-model request failed" }, 502);
  }
}
