// Server only. The expert chat: an agent that calls tools (engine, NASA library, calculators), then code checks its answer.
// The response is a stream of JSON lines: {"type":"status","text"}, then {"type":"result",...} or {"type":"error","error"}.

import { NoModelAvailable, RateLimited, askLlm, budget, checkContent, providers, visitorFor } from "@/lib/llm";
import { shapeTarget } from "@/lib/ask-core";
import { evaluateOnServer, serverData } from "@/lib/server-eval";
import { helpTopics } from "@/lib/tars/topics-server";
import { loadLibrary } from "@/lib/expert/library";
import { runAgent, type AssistantMsg, type HistoryTurn, type UiContext } from "@/lib/expert/agent";
import { allModels, displayName } from "@/lib/llm/config";
import { reviewSecondOpinion } from "@/lib/expert/skeptic";
import { makeAskModel } from "@/lib/tars/ask-model";
import { runWorkflow, workflowOf } from "@/lib/tars/workflows";
import { codeAnswer } from "@/lib/tars/fallback";
import type { BriefTurn } from "@/lib/expert/brief";

export const dynamic = "force-dynamic";

const STRUCTURED = "TARS needs a language model for open questions, and none is available right now. Ask about a condition with numbers (oxygen %, pressure with unit, gravity) or about the site, and TARS answers without one.";
const DEADLINE_MS = Number(process.env.PYRION_AGENT_DEADLINE_MS) > 0 ? Number(process.env.PYRION_AGENT_DEADLINE_MS) : 90_000;
const MAX_BODY = 16 * 1024;
/** One model call gives up after this; the code fallback then answers within the request deadline. */
const CALL_MS = Number(process.env.PYRION_MODEL_CALL_MS) > 0 ? Number(process.env.PYRION_MODEL_CALL_MS) : 25_000;
/** The whole agent (all its rounds) gives up after this. */
const AGENT_MS = Number(process.env.PYRION_AGENT_TOTAL_MS) > 0 ? Number(process.env.PYRION_AGENT_TOTAL_MS) : 60_000;

const line = (o: unknown) => `${JSON.stringify(o)}\n`;

export async function POST(req: Request) {
  const { visitor, setCookie } = visitorFor(req);
  const cookie: Record<string, string> = setCookie ? { "Set-Cookie": setCookie } : {};
  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "the request is too large" }, { status: 413 });
  let body: { message?: unknown; history?: unknown; lastTarget?: unknown; ui?: unknown; skeptic?: unknown; turns?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "the request body is not JSON" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message === "" || message.length > 600) return Response.json({ error: "the message must be 1 to 600 characters" }, { status: 400 });

  const history: HistoryTurn[] = Array.isArray(body.history)
    ? body.history.flatMap((h) => {
        const x = h as { role?: unknown; text?: unknown; content?: unknown };
        const t = typeof x.text === "string" ? x.text : typeof x.content === "string" ? x.content : null;
        return (x.role === "user" || x.role === "assistant") && t !== null ? [{ role: x.role, text: t.slice(0, 1500) } as HistoryTurn] : [];
      }).slice(-8)
    : [];
  const shaped = body.lastTarget ? shapeTarget(body.lastTarget) : null;
  const lastTarget = shaped && shaped.ok ? shaped.target : null;
  const ui = (body.ui && typeof body.ui === "object" ? body.ui : {}) as UiContext;

  const started = Date.now();
  const deadline = AbortSignal.any([req.signal, AbortSignal.timeout(DEADLINE_MS)]);
  const remaining = () => Math.max(1000, DEADLINE_MS - (Date.now() - started));

  // When the content check or every model is unavailable, TARS still answers by code (engine, help topics, NASA passages): no model words are involved.
  let screened = true;
  try {
    // The visitor's limit and the content check come first, exactly as for the Ask box.
    budget().visitor(visitor);
    if (providers().length === 0) screened = false;
    else {
      budget().recordSafety();
      try {
        const safety = await checkContent(message, providers(), undefined, undefined, AbortSignal.any([deadline, AbortSignal.timeout(15_000)]));
        if (safety.unresolved) screened = false;
        else if (safety.flagged) return Response.json({ error: "TARS cannot help with that question. Ask about combustion, fire safety in space, NASA documents or this site." }, { status: 422 });
      } catch (e) {
        if (e instanceof RateLimited) throw e;
        screened = false;
      }
    }
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
        const agentRun = screened && providers().length > 0 ? runAgent(
          {
            records,
            investigations,
            topics,
            library,
            onStatus: (text) => send({ type: "status", text }),
            chat: async (messages, tools) => {
              const c = await askLlm({ messages, tools, effort: "medium", maxTokens: 4000, maxTokensByProvider: { openrouter: 4000, nim: 4000 }, deadlineMs: Math.min(CALL_MS, remaining()), signal: req.signal }, visitor);
              used = { model: c.meta.model, name: displayName(c.meta.model), provider: c.meta.provider, fellBackFrom: c.meta.fell_back_from ? displayName(c.meta.fell_back_from) : null };
              return (c.json?.choices?.[0]?.message ?? { content: null }) as AssistantMsg;
            },
          },
          { message, history, lastTarget, ui },
        ) : Promise.reject(new NoModelAvailable("none"));
        let agentOut: Awaited<ReturnType<typeof runAgent>> | null = null;
        try {
          agentOut = await Promise.race([agentRun, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("agent budget spent")), AGENT_MS))]);
        } catch (e) {
          if (e instanceof RateLimited) throw e;
          agentOut = null;
        }
        if (!agentOut) {
          // No model answered (timeout, no credit, a rate limit, none configured): answer by code, say so, never a dead end.
          const code = await codeAnswer({ message, lastTarget, records, investigations, topics, library });
          send({ type: "result", fallback: true, notice: code.notice, helpTopics: code.helpTopics, fingerprint: code.fingerprint ?? null, blocks: code.blocks, dropped: 0, droppedReasons: [], flagged: 0, actions: code.target ? [{ type: "show", target: code.target }] : [], target: code.target, engineCounts: code.engineCounts, lang: code.lang, steps: [], model: null });
          return;
        }
        const result = agentOut;
        if (result.report.dropped.length || result.report.flaggedNumbers.length) console.warn("[pyrion] expert answer check:", JSON.stringify(result.report));
        // A typed workflow request ("Check this: …", "Make an evidence brief…", "Compare … with …", "second opinion") gives the same
        // result fields as the panel buttons, in this same final event.
        const workflow = workflowOf(message, ui as { workflow?: unknown });
        const clientTurns: BriefTurn[] = Array.isArray(body.turns)
          ? (body.turns as Record<string, unknown>[]).slice(0, 20).flatMap((t) => (typeof t?.question === "string" && Array.isArray(t.kept) ? [{ question: t.question.slice(0, 600), kept: t.kept, target: ((x) => (x && x.ok ? x.target : null))(t.target ? shapeTarget(t.target) : null), model: (t.model as BriefTurn["model"]) ?? null, skeptic: (t.skeptic as BriefTurn["skeptic"]) ?? null } as BriefTurn] : []))
          : [];
        if (workflow) send({ type: "status", text: "Running the requested workflow…" });
        const extras = workflow
          ? await runWorkflow(workflow, { message, history, ui: ui as { conditions?: unknown }, kept: result.kept, target: result.target, model: used ? { model: (used as { model: string }).model, name: (used as { name: string }).name } : null, records, investigations, library, askModel: makeAskModel(visitor), available: allModels(providers()), turns: clientTurns })
          : {};
        const tShaped = result.target ? shapeTarget(result.target) : null;
        const fingerprint = tShaped && tShaped.ok ? (await evaluateOnServer(tShaped.target)).sha256 : null;
        send({ type: "result", fingerprint, ...extras, blocks: result.kept, dropped: result.report.dropped.length, droppedReasons: result.report.dropped.map((d) => `${d.layer}: ${d.reason}${d.detail ? ` (${d.detail})` : ""}`), flagged: result.report.flaggedNumbers.length, actions: result.actions, target: result.target, lang: result.lang, steps: result.steps, model: used });
        // Second opinion: a model of a different family reviews the checked answer; it never changes it. Sent after the answer, so the answer is not delayed.
        if (body.skeptic === true && workflow !== "second_opinion" && result.kept.length > 0 && used) {
          send({ type: "status", text: "Asking for a second opinion…" });
          const askModel = makeAskModel(visitor);
          try {
            const sk = await reviewSecondOpinion(message, result.kept, { corpus: library?.corpus ?? { get: () => undefined, hasDocument: () => false }, askModel, answeredBy: (used as { model: string }).model, available: allModels(providers()) });
            send({ type: "skeptic", skeptic: sk });
          } catch {
            send({ type: "skeptic", skeptic: { verdict: "unavailable", objections: [], model: null, answeredBy: null, dropped: [], note: "The second opinion could not run." } });
          }
        }
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
