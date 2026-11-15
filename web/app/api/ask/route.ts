// Server only. Question translation and narration through the provider router (OpenRouter first, NVIDIA NIM as fallback).
// Keys live in the server environment (see web/.env.example): never sent to the client, never logged.
//
// Parse: the model copies the quantities as the question wrote them; code verifies they are in the question and the
// engine converts them. Narrate: the client sends only a target; the server runs the engine itself, writes the counts and
// verdicts with code, asks the model for context only, and checks that context before it can reach the page.

import { NoModelAvailable, RateLimited, askLlm, budget, checkContent, providers, selectableModels, visitorId } from "@/lib/llm";
import { displayName, openWeightsLabel } from "@/lib/llm/config";
import { NARRATE_SYSTEM, PARSE_SYSTEM, PROMPT_VERSION } from "@/lib/prompts";
import { PARTIAL_PRESSURE_MESSAGE, PlainError, buildNarrationInput, parseTargetReply, readByCode, questionHasOxygenPartialPressure, renderVerdicts, shapeTarget } from "@/lib/ask-core";
import { cleanModelText } from "@/lib/llm/clean";
import { checkContext, type ContextTarget } from "@/lib/context-check";
import { modelText } from "@/lib/narration-check";
import { evaluateOnServer } from "@/lib/server-eval";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const STRUCTURED = "Structured mode: no language model is available right now. Pick a preset or set the target by hand; every verdict still works.";
const DEADLINE_MS = 25_000;
const MAX_BODY = 8 * 1024;

/** The request body as text, or null if it exceeds `max` bytes. Stops reading at the limit. */
async function readLimited(req: Request, max: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Whether questions are enabled and which models a visitor can choose. No secret is returned. */
export async function GET() {
  const models = providers().length ? selectableModels() : [];
  return json({ enabled: models.length > 0, models, promptVersion: PROMPT_VERSION });
}

const metaOf = (m: { model: string; provider: string; latency_ms: number; fell_back_from?: string }) => ({
  provider: m.provider,
  model: m.model,
  name: displayName(m.model),
  latency_ms: m.latency_ms,
  fell_back_from: m.fell_back_from ?? null,
  // Only a verified table entry is called open weights, with its license and source; anything else carries no label.
  open_weights: openWeightsLabel(m.model),
});

/** The target as the context check sees it: regime words and numbers with their units. */
function contextTarget(input: { target: Record<string, unknown>; open_axes: string[] }): ContextTarget {
  const t = input.target;
  const num = (k: string) => (typeof t[k] === "number" ? (t[k] as number) : undefined);
  const regime: Record<string, string> = {};
  for (const k of ["gravity_regime", "fuel_phase", "diluent", "flame_type"]) if (typeof t[k] === "string") regime[k] = t[k] as string;
  return { regime, o2_percent: num("o2_percent"), pressure_kpa: num("pressure_kpa"), pressure_psia: num("pressure_psia"), gravity_level_g: num("gravity_level_g"), open_axes: input.open_axes };
}

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
  // The body is read through a hard limit: a huge or endless upload is refused before it is buffered.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY) return json({ error: "the request is too large" }, 413);
  let body: { step?: unknown; model?: unknown; question?: unknown; target?: unknown };
  try {
    const raw = await readLimited(req, MAX_BODY);
    if (raw === null) return json({ error: "the request is too large" }, 413);
    body = JSON.parse(raw);
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
      // An oxygen partial pressure without a total pressure cannot become a target: say so before any paid call.
      if (questionHasOxygenPartialPressure(q)) return json({ error: PARTIAL_PRESSURE_MESSAGE }, 422);
      budget().recordSafety();
      const safety = await checkContent(q, providers(), undefined, undefined, deadline);
      const safetyState = safety.flagged ? "flagged" : safety.checked ? "checked" : "unavailable";
      if (safety.unresolved) return json({ error: "The content check could not finish right now. Please try again in a moment, or pick a NASA condition below — every verdict works without questions.", safety: "unavailable", safety_detail: safety.detail }, 503);
      if (safety.flagged) return json({ error: "PYRION cannot help with that question. Ask about a combustion condition instead.", safety: safetyState, safety_detail: safety.detail }, 422);
      // Deterministic first: code reads the question when it can; an issue is returned in plain words, with no model call.
      const code = readByCode(q);
      if (code.kind === "issue") return json({ error: code.message, safety: safetyState, safety_detail: safety.detail, read_by: "code" }, 422);
      if (code.kind === "code") {
        return json({
          meta: { provider: "code", model: null, latency_ms: 0, fell_back_from: null, open_weights: null, read_by: "code" },
          promptVersion: PROMPT_VERSION,
          safety: safetyState,
          safety_detail: safety.detail,
          parsed: code.parsed,
        });
      }
      // Reasoning models on the fallback provider need room to think before the JSON.
      const c = await askLlm({ model, signal: req.signal, deadlineMs: remaining(), maxTokens: 400, maxTokensByProvider: { nim: 2000, openrouter: 1500 }, effort: "low", validate: parsesAsObject, messages: [{ role: "system", content: PARSE_SYSTEM }, { role: "user", content: q }] }, visitor);
      const reply = c.json?.choices?.[0]?.message?.content;
      if (typeof reply !== "string") return json({ error: "the model returned no text" }, 502);
      let parsed;
      try {
        parsed = parseTargetReply(cleanModelText(reply), q, code.extracted);
      } catch (e) {
        if (e instanceof PlainError) return json({ error: e.message, safety: safetyState, meta: metaOf(c.meta) }, 422);
        return json({ error: `The question could not be turned into a valid target. ${modelText(e instanceof Error ? e.message : "invalid reply")}`, safety: safetyState, ...metaOf(c.meta) }, 422);
      }
      return json({ meta: metaOf(c.meta), promptVersion: PROMPT_VERSION, safety: safetyState, safety_detail: safety.detail, parsed });
    }

    if (body.step === "narrate") {
      // Shape and engine validation happen before any paid call; the client's target is the only thing trusted from it.
      const shaped = shapeTarget(body.target);
      if (!shaped.ok) return json({ error: shaped.error }, 400);
      // Same limit as the parse step, counted before the engine runs or any model is called.
      budget().visitor(visitor);
      const { evaluation, investigations, sha256 } = await evaluateOnServer(shaped.target);
      const { input } = buildNarrationInput(evaluation, investigations, shaped.target);
      // Counts and verdicts are written by code. The model adds context only.
      const verdictLines = renderVerdicts(input);
      let context: string | null = null;
      let dropped = 0;
      let meta = null;
      try {
        const c = await askLlm({ model, signal: req.signal, deadlineMs: remaining(), maxTokens: 400, maxTokensByProvider: { nim: 1200, openrouter: 1500 }, effort: "low", validate: (t) => t.length > 0, messages: [{ role: "system", content: NARRATE_SYSTEM }, { role: "user", content: JSON.stringify({ target: input.target, open_axes: input.open_axes }) }] }, visitor);
        meta = metaOf(c.meta);
        const text = c.json?.choices?.[0]?.message?.content;
        if (typeof text === "string") {
          // Allowlist: only sentences that restate the target in its own numbers and words survive; the rest is dropped.
          const r = checkContext(cleanModelText(text), contextTarget(input));
          context = r.kept;
          dropped = r.dropped;
        }
      } catch (e) {
        if (e instanceof RateLimited || e instanceof NoModelAvailable) {
          // The verdicts are still there: the model's part is optional.
          return json({ meta: null, promptVersion: PROMPT_VERSION, engine_sha256: sha256, verdicts: verdictLines, context: null, dropped: 0, narration_unavailable: true });
        }
        throw e;
      }
      return json({ meta, promptVersion: PROMPT_VERSION, engine_sha256: sha256, verdicts: verdictLines, context, dropped });
    }
    return json({ error: "unknown step" }, 400);
  } catch (e) {
    if (e instanceof RateLimited) return json({ error: e.message }, 429);
    if (e instanceof NoModelAvailable) return json({ error: STRUCTURED }, 503);
    if (e instanceof Error && e.name === "AbortError") return json({ error: "the request was cancelled" }, 499);
    return json({ error: "the language-model request failed" }, 502);
  }
}
