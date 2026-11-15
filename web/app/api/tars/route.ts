// TARS: Support answers (help topics, no model) and the three-part answer (engine only). No model is called here.

import { experimentsNeeded, threePartAnswer } from "@/lib/engine";
import { shapeTarget } from "@/lib/ask-core";
import { evaluateOnServer, serverData } from "@/lib/server-eval";
import { MIN_SCORE, searchTopics } from "@/lib/tars/help";
import { helpTopics } from "@/lib/tars/topics-server";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 4000) return json({ error: "the request is too large" }, 413);
  let body: { kind?: unknown; message?: unknown; target?: unknown; readBy?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "the request body is not JSON" }, 400);
  }

  if (body.kind === "help") {
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (message === "" || message.length > 300) return json({ error: "the question must be 1 to 300 characters" }, 400);
    const topics = await helpTopics();
    const hits = searchTopics(topics, message, 3).filter((h) => h.score >= MIN_SCORE);
    const pick = (t: (typeof topics)[number]) => ({ id: t.id, title: t.title, body: t.body, link: t.link, highlight: t.highlight ?? null });
    if (hits.length === 0) return json({ none: true, topics: topics.map((t) => ({ id: t.id, title: t.title })) });
    return json({ topic: pick(hits[0].topic), others: hits.slice(1).map((h) => ({ id: h.topic.id, title: h.topic.title })) });
  }

  if (body.kind === "help-all") {
    const topics = await helpTopics();
    return json({ topics: topics.map((t) => ({ id: t.id, title: t.title, keywords: t.keywords, page: t.page ?? "overview", link: t.link, highlight: t.highlight ?? null, body: t.body })) });
  }

  if (body.kind === "answer" || body.kind === "experiments") {
    const shaped = shapeTarget(body.target);
    if (!shaped.ok) return json({ error: shaped.error }, 400);
    const { records, investigations } = await serverData();
    if (body.kind === "experiments") {
      const { sha256 } = await evaluateOnServer(shaped.target);
      return json({ experiments: experimentsNeeded(records, shaped.target), fingerprint: sha256 });
    }
    const readBy = typeof body.readBy === "string" && body.readBy.length < 120 ? body.readBy : "Read by code";
    const catalog = Object.fromEntries(investigations.map((i) => [i.accession, { acronym: i.acronym, title: i.title, doi: i.doi }]));
    // The engine writes both wordings of the same facts; the client chooses by mode.
    const easy = threePartAnswer(records, shaped.target, { mode: "easy", catalog });
    const advanced = threePartAnswer(records, shaped.target, { mode: "advanced", catalog });
    return json({ answer: { easy, advanced, readBy } });
  }
  return json({ error: "unknown request" }, 400);
}
