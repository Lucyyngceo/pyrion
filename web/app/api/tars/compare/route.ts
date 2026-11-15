// "Ask 3 models": the same question to three models, side by side, with the engine fingerprint of each run.
// Costs credit, so it runs only on a click, counts against the visitor's limits once per model, and never falls back to another model:
// a model that is not available says so.

import { NoModelAvailable, RateLimited, askLlm, budget, checkContent, providers, visitorFor } from "@/lib/llm";
import { allModels, displayName } from "@/lib/llm/config";
import { shapeTarget } from "@/lib/ask-core";
import { evaluateOnServer, serverData } from "@/lib/server-eval";
import { helpTopics } from "@/lib/tars/topics-server";
import { loadLibrary } from "@/lib/expert/library";
import { runAgent, type AssistantMsg } from "@/lib/expert/agent";

export const dynamic = "force-dynamic";

/** The three models of the panel, in order; only the configured ones are asked. */
const PANEL = ["nvidia/nemotron-3-ultra-550b-a55b", "google/gemma-4-31b-it", "mistralai/mistral-small-3.2-24b-instruct"];
const DEADLINE_MS = Number(process.env.PYRION_AGENT_DEADLINE_MS) > 0 ? Number(process.env.PYRION_AGENT_DEADLINE_MS) : 90_000;

export async function POST(req: Request) {
  const { visitor, setCookie } = visitorFor(req);
  const headers = { "Cache-Control": "no-store", ...(setCookie ? { "Set-Cookie": setCookie } : {}) };
  const json = (b: unknown, status = 200) => Response.json(b, { status, headers });
  const raw = await req.text();
  if (raw.length > 16 * 1024) return json({ error: "the request is too large" }, 413);
  let body: { message?: unknown; lastTarget?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "the request body is not JSON" }, 400);
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message === "" || message.length > 600) return json({ error: "the message must be 1 to 600 characters" }, 400);
  const ps = providers();
  if (ps.length === 0) return json({ error: "No language model is available on this server." }, 503);
  const models = PANEL.filter((m) => allModels(ps).includes(m));
  if (models.length === 0) return json({ error: "None of the panel models is configured on this server." }, 503);
  const shaped = body.lastTarget ? shapeTarget(body.lastTarget) : null;
  const lastTarget = shaped && shaped.ok ? shaped.target : null;

  const deadline = AbortSignal.any([req.signal, AbortSignal.timeout(DEADLINE_MS)]);
  try {
    // One content check for the question; one visitor count per model asked.
    budget().recordSafety();
    const safety = await checkContent(message, ps, undefined, undefined, deadline);
    if (safety.unresolved || !safety.checked) return json({ error: "The content check could not finish right now, so no model can answer. Try again in a moment; the engine verdicts work without it." }, 503);
    if (safety.flagged) return json({ error: "TARS cannot help with that question. Ask about combustion, fire safety in space, NASA documents or this site." }, 422);
    for (let i = 0; i < models.length; i++) budget().visitor(visitor);
  } catch (e) {
    if (e instanceof RateLimited) return json({ error: e.message }, 429);
    return json({ error: "the request failed" }, 502);
  }

  const [{ records, investigations }, topics, library] = await Promise.all([serverData(), helpTopics(), loadLibrary()]);
  const started = Date.now();
  const runs = await Promise.all(
    models.map(async (model) => {
      try {
        let used: { provider: string } | null = null;
        const result = await runAgent(
          {
            records,
            investigations,
            topics,
            library,
            chat: async (messages, tools) => {
              const c = await askLlm({ messages, tools, model, pin: true, effort: "medium", maxTokens: 4000, maxTokensByProvider: { openrouter: 4000, nim: 4000 }, deadlineMs: Math.max(1000, DEADLINE_MS - (Date.now() - started)), signal: req.signal }, visitor);
              used = { provider: c.meta.provider };
              return (c.json?.choices?.[0]?.message ?? { content: null }) as AssistantMsg;
            },
          },
          { message, lastTarget, ui: {} },
        );
        const fingerprint = result.target ? (await evaluateOnServer(result.target)).sha256 : null;
        return { model, name: displayName(model), provider: (used as { provider: string } | null)?.provider ?? null, ok: true as const, blocks: result.kept, dropped: result.report.dropped.length, flagged: result.report.flaggedNumbers.length, target: result.target, fingerprint, lang: result.lang };
      } catch (e) {
        const why = e instanceof NoModelAvailable ? "not available right now" : e instanceof RateLimited ? e.message : "could not answer";
        return { model, name: displayName(model), ok: false as const, error: why };
      }
    }),
  );
  const prints = [...new Set(runs.flatMap((r) => (r.ok && r.fingerprint ? [r.fingerprint] : [])))];
  return json({ runs, identicalFingerprint: prints.length === 1 && runs.filter((r) => r.ok && r.fingerprint).length > 1 ? true : prints.length > 1 ? false : null, fingerprint: prints.length === 1 ? prints[0] : null });
}
