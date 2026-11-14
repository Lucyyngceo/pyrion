// Server only. Question translation and narration through the provider router (OpenRouter first, NVIDIA NIM as fallback).
// Keys live in the server environment (see web/.env.example): never sent to the client, never logged.

import { NoModelAvailable, RateLimited, allModels, askLlm, checkContent, providers, visitorId } from "@/lib/llm";
import { NARRATE_SYSTEM, PARSE_SYSTEM, PROMPT_VERSION } from "@/lib/prompts";
import { checkNarration } from "@/lib/narration-check";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const STRUCTURED = "Structured mode: no language model is available right now. Pick a preset or set the target by hand; every verdict still works.";

/** Whether questions are enabled and which models can be chosen. No secret is returned. */
export async function GET() {
  const models = allModels(providers());
  return json({ enabled: models.length > 0, models, promptVersion: PROMPT_VERSION });
}

/** Facts a narration may use, derived from the exact input the model was given. */
function factsOf(input: { top?: { accession?: string; doi?: string }[] }) {
  const top = Array.isArray(input.top) ? input.top : [];
  return {
    ids: top.map((t) => t.accession ?? "").filter(Boolean),
    dois: top.map((t) => t.doi ?? "").filter(Boolean),
    source: JSON.stringify(input),
  };
}

export async function POST(req: Request) {
  if (providers().length === 0) return json({ error: `Structured mode: add a key to enable questions. ${STRUCTURED}` }, 503);
  let body: { step?: unknown; model?: unknown; question?: unknown; input?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "the request body is not JSON" }, 400);
  }
  const model = typeof body.model === "string" && allModels(providers()).includes(body.model) ? body.model : undefined;
  const visitor = visitorId(req);

  try {
    if (body.step === "parse") {
      const q = typeof body.question === "string" ? body.question.trim() : "";
      if (q === "" || q.length > 500) return json({ error: "the question must be 1 to 500 characters" }, 400);
      const safety = await checkContent(q, providers());
      if (safety.flagged) return json({ error: "PYRION cannot help with that question. Ask about a combustion condition instead." }, 422);
      const c = await askLlm({ model, maxTokens: 500, messages: [{ role: "system", content: PARSE_SYSTEM }, { role: "user", content: q }] }, visitor);
      const reply = c.json?.choices?.[0]?.message?.content;
      if (typeof reply !== "string") return json({ error: "the model returned no text" }, 502);
      return json({ ...c.meta, promptVersion: PROMPT_VERSION, safetyChecked: safety.checked, reply });
    }
    if (body.step === "narrate") {
      const input = body.input;
      const text = JSON.stringify(input ?? null);
      if (text.length > 20_000 || text === "null" || typeof input !== "object") return json({ error: "the engine output is missing or too large" }, 400);
      const c = await askLlm({ model, maxTokens: 400, messages: [{ role: "system", content: NARRATE_SYSTEM }, { role: "user", content: text }] }, visitor);
      const reply = c.json?.choices?.[0]?.message?.content;
      if (typeof reply !== "string") return json({ error: "the model returned no text" }, 502);
      // The consistency check runs here, on the server, before the text can reach the page.
      const check = checkNarration(reply, factsOf(input as Parameters<typeof factsOf>[0]));
      return json({ ...c.meta, promptVersion: PROMPT_VERSION, reply: check.ok ? reply : null, check });
    }
    return json({ error: "unknown step" }, 400);
  } catch (e) {
    if (e instanceof RateLimited) return json({ error: e.message }, 429);
    if (e instanceof NoModelAvailable) return json({ error: `${STRUCTURED}` }, 503);
    return json({ error: "the language-model request failed" }, 502);
  }
}
