// Replay: re-runs ONLY the engine part for a condition and returns its fingerprint, so the browser can say "same fingerprint".
// No model, no budget: the same condition gives the same bytes. Also used to open a shared link.

import { shapeTarget } from "@/lib/ask-core";
import { evaluateOnServer } from "@/lib/server-eval";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 8 * 1024) return Response.json({ error: "the request is too large" }, { status: 413 });
  let body: { target?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "the request body is not JSON" }, { status: 400 });
  }
  const shaped = shapeTarget(body.target);
  if (!shaped.ok) return Response.json({ error: shaped.error }, { status: 400 });
  const { evaluation, sha256 } = await evaluateOnServer(shaped.target);
  const counts: Record<string, number> = {};
  for (const i of evaluation.investigations) counts[i.verdict] = (counts[i.verdict] ?? 0) + 1;
  return Response.json({ fingerprint: sha256, counts, target: shaped.target }, { headers: { "Cache-Control": "no-store" } });
}
