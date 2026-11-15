// "Check a claim": paste a text, each claim is classified by code (supported / not supported in PSI / contradicted / overclaim).
// The model only proposes claims and candidate quotes; the verdict is the engine's and the quotes are verified on their pages.
// With no model available the code splits the text itself, so the skill still works.

import { RateLimited, budget, checkContent, providers, visitorFor } from "@/lib/llm";
import { serverData } from "@/lib/server-eval";
import { loadLibrary } from "@/lib/expert/library";
import { checkClaim } from "@/lib/expert/claim";
import { makeAskModel } from "@/lib/tars/ask-model";

export const dynamic = "force-dynamic";

const MAX_TEXT = 3000;

export async function POST(req: Request) {
  const { visitor, setCookie } = visitorFor(req);
  const headers = { "Cache-Control": "no-store", ...(setCookie ? { "Set-Cookie": setCookie } : {}) };
  const json = (b: unknown, status = 200) => Response.json(b, { status, headers });
  const raw = await req.text();
  if (raw.length > 16 * 1024) return json({ error: "the request is too large" }, 413);
  let body: { text?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "the request body is not JSON" }, 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 12 || text.length > MAX_TEXT) return json({ error: `paste between 12 and ${MAX_TEXT} characters` }, 400);
  const library = await loadLibrary();
  if (!library) return json({ error: "The NASA library is not available on this server." }, 503);

  const deadline = AbortSignal.any([req.signal, AbortSignal.timeout(90_000)]);
  try {
    budget().visitor(visitor);
    if (providers().length > 0) {
      budget().recordSafety();
      const safety = await checkContent(text, providers(), undefined, undefined, deadline);
      if (safety.unresolved) return json({ error: "The content check could not finish right now. Please try again in a moment." }, 503);
      if (safety.flagged) return json({ error: "TARS cannot check that text. Paste text about combustion, fire safety in space or NASA documents." }, 422);
    }
  } catch (e) {
    if (e instanceof RateLimited) return json({ error: e.message }, 429);
    return json({ error: "the request failed" }, 502);
  }

  const { records, investigations } = await serverData();
  const catalog = Object.fromEntries(investigations.map((i) => [i.accession, { acronym: i.acronym, title: i.title, doi: i.doi }]));
  const result = await checkClaim(text, {
    corpus: library.corpus,
    askModel: providers().length > 0 ? makeAskModel(visitor) : async () => { throw new Error("no language model is available"); },
    search: async (q, top) => (await library.search(q, top)).map((p) => ({ doc_id: p.doc_id, page_start: p.page_start, text: p.text, title: p.title, url: p.url })),
    records,
    catalog,
  });
  return json(result);
}
