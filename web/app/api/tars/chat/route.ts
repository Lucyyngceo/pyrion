// Server only. The expert chat: an agent that calls tools (engine, NASA library, calculators), then code checks its answer.
// The response is a stream of JSON lines: {"type":"status","text"}, then {"type":"result",...} or {"type":"error","error"}.

import { NoModelAvailable, RateLimited, askLlm, budget, checkContent, providers, visitorFor } from "@/lib/llm";
import { shapeTarget } from "@/lib/ask-core";
import { serverData } from "@/lib/server-eval";
import { helpTopics } from "@/lib/tars/topics-server";
import { loadLibrary } from "@/lib/expert/library";
import { runAgent, type AssistantMsg, type HistoryTurn, type UiContext } from "@/lib/expert/agent";
import { displayName } from "@/lib/llm/config";

export const dynamic = "force-dynamic";

const STRUCTURED = "TARS needs a language model for open questions, and none is available right now. Ask about a condition with numbers (oxygen %, pressure with unit, gravity) or about the site, and TARS answers without one.";
const DEADLINE_MS = Number(process.env.PYRION_AGENT_DEADLINE_MS) > 0 ? Number(process.env.PYRION_AGENT_DEADLINE_MS) : 90_000;
const MAX_BODY = 16 * 1024;

const line = (o: unknown) => `${JSON.stringify(o)}\n`;

export async function POST(req: Request) {
  const { visitor, setCookie } = visitorFor(req);
  const cookie: Record<string, string> = setCookie ? { "Set-Cookie": setCookie } : {};
  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "the request is too large" }, { status: 413 });
  let body: { message?: unknown; history?: unknown; lastTarget?: unknown; ui?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "the request body is not JSON" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message === "" || message.length > 600) return Response.json({ error: "the message must be 1 to 600 characters" }, { status: 400 });
  if (providers().length === 0) return Response.json({ error: STRUCTURED }, { status: 503 });

  const history: HistoryTurn[] = Array.isArray(body.history)
    ? body.history.flatMap((h) => {
        const x = h as { role?: unknown; text?: unknown };
        return (x.role === "user" || x.role === "assistant") && typeof x.text === "string" ? [{ role: x.role, text: x.text.slice(0, 1500) } as HistoryTurn] : [];
      }).slice(-8)
    : [];
  const shaped = body.lastTarget ? shapeTarget(body.lastTarget) : null;
  const lastTarget = shaped && shaped.ok ? shaped.target : null;
  const ui = (body.ui && typeof body.ui === "object" ? body.ui : {}) as UiContext;

  const started = Date.now();
  const deadline = AbortSignal.any([req.signal, AbortSignal.timeout(DEADLINE_MS)]);
  const remaining = () => Math.max(1000, DEADLINE_MS - (Date.now() - started));

  try {
    // The visitor's limit and the content check come first, exactly as for the Ask box.
    budget().visitor(visitor);
    budget().recordSafety();
    const safety = await checkContent(message, providers(), undefined, undefined, deadline);
    if (safety.unresolved) return Response.json({ error: "The content check could not finish right now. Please try again in a moment, or pick a NASA condition — every verdict works without questions." }, { status: 503 });
    if (safety.flagged) return Response.json({ error: "TARS cannot help with that question. Ask about combustion, fire safety in space, NASA documents or this site." }, { status: 422 });
  } catch (e) {
    if (e instanceof RateLimited) return Response.json({ error: e.message }, { status: 429 });
    return Response.json({ error: "the request failed" }, { status: 502 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (o: unknown) => controller.enqueue(enc.encode(line(o)));
      try {
        const [{ records, investigations }, topics, library] = await Promise.all([serverData(), helpTopics(), loadLibrary()]);
        let used: { model: string; name: string; provider: string; fellBackFrom: string | null } | null = null;
        const result = await runAgent(
          {
            records,
            investigations,
            topics,
            library,
            onStatus: (text) => send({ type: "status", text }),
            chat: async (messages, tools) => {
              const c = await askLlm({ messages, tools, effort: "medium", maxTokens: 4000, maxTokensByProvider: { openrouter: 4000, nim: 4000 }, deadlineMs: remaining(), signal: req.signal }, visitor);
              used = { model: c.meta.model, name: displayName(c.meta.model), provider: c.meta.provider, fellBackFrom: c.meta.fell_back_from ? displayName(c.meta.fell_back_from) : null };
              return (c.json?.choices?.[0]?.message ?? { content: null }) as AssistantMsg;
            },
          },
          { message, history, lastTarget, ui },
        );
        if (result.report.dropped.length || result.report.flaggedNumbers.length) console.warn("[pyrion] expert answer check:", JSON.stringify(result.report));
        send({ type: "result", blocks: result.kept, dropped: result.report.dropped.length, droppedReasons: result.report.dropped.map((d) => `${d.layer}: ${d.reason}${d.detail ? ` (${d.detail})` : ""}`), flagged: result.report.flaggedNumbers.length, actions: result.actions, target: result.target, lang: result.lang, steps: result.steps, model: used });
      } catch (e) {
        if (e instanceof RateLimited) send({ type: "error", error: e.message });
        else if (e instanceof NoModelAvailable) send({ type: "error", error: STRUCTURED });
        else send({ type: "error", error: "TARS could not finish that answer. Try again in a moment." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", ...cookie } });
}
