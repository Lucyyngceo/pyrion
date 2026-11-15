// "Brief me": the conversation as a document. No model is called: the engine part is recomputed from each condition and every
// NASA quote is verified again on its page (buildBrief), so what the client sends cannot add an unchecked statement.

import { visitorFor } from "@/lib/llm";
import { shapeTarget } from "@/lib/ask-core";
import { serverData } from "@/lib/server-eval";
import { loadLibrary } from "@/lib/expert/library";
import { buildBrief, type BriefTurn } from "@/lib/expert/brief";

export const dynamic = "force-dynamic";

const MAX_BODY = 400 * 1024;

export async function POST(req: Request) {
  const { setCookie } = visitorFor(req);
  const headers = { "Cache-Control": "no-store", ...(setCookie ? { "Set-Cookie": setCookie } : {}) };
  const json = (b: unknown, status = 200) => Response.json(b, { status, headers });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "the request is too large" }, 413);
  let body: { turns?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "the request body is not JSON" }, 400);
  }
  if (!Array.isArray(body.turns) || body.turns.length === 0 || body.turns.length > 20) return json({ error: "send between 1 and 20 answered questions" }, 400);
  const turns: BriefTurn[] = [];
  for (const t of body.turns as Record<string, unknown>[]) {
    if (typeof t?.question !== "string" || !Array.isArray(t.kept)) continue;
    const shaped = t.target ? shapeTarget(t.target) : null;
    turns.push({
      question: t.question.slice(0, 600),
      kept: t.kept as BriefTurn["kept"],
      target: shaped && shaped.ok ? shaped.target : null,
      model: (t.model as BriefTurn["model"]) ?? null,
      skeptic: (t.skeptic as BriefTurn["skeptic"]) ?? null,
    });
  }
  if (turns.length === 0) return json({ error: "no answered question to brief" }, 400);
  const [{ records, investigations }, library] = await Promise.all([serverData(), loadLibrary()]);
  const catalog = Object.fromEntries(investigations.map((i) => [i.accession, { acronym: i.acronym, title: i.title, doi: i.doi }]));
  const brief = buildBrief(turns, { date: new Date().toISOString().slice(0, 10), records, catalog, ...(library ? { corpus: library.corpus } : {}) });
  return json(brief);
}
