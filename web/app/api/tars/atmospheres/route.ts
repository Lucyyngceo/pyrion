// "Compare atmospheres": GET lists the presets; POST compares a set of conditions with compareConditionSet (engine and calculators only).
// No model is involved and nothing is estimated, so it costs nothing and is not counted against the limits.

import { PRESETS } from "../../../../../engine/src/index.ts";
import { serverData } from "@/lib/server-eval";
import { compareConditionSet, type ConditionInput } from "@/lib/expert/compare";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ presets: PRESETS.map((p) => ({ id: p.id, label: p.label })) });
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 16 * 1024) return Response.json({ error: "the request is too large" }, { status: 413 });
  let body: { conditions?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "the request body is not JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.conditions) || body.conditions.length < 2 || body.conditions.length > 8) return Response.json({ error: "choose between 2 and 8 conditions" }, { status: 400 });
  const conditions: ConditionInput[] = [];
  for (const c of body.conditions as unknown[]) {
    if (typeof c === "string") {
      conditions.push(c.slice(0, 80));
    } else if (c && typeof c === "object") {
      const x = c as Record<string, unknown>;
      // Only the three plain fields a person can write; a ready-made target is not accepted from the browser.
      conditions.push({
        name: typeof x.name === "string" ? x.name.slice(0, 60) : undefined,
        o2: typeof x.o2 === "string" || typeof x.o2 === "number" ? x.o2 : undefined,
        pressure: typeof x.pressure === "string" ? x.pressure.slice(0, 40) : undefined,
        gravity_regime: typeof x.gravity_regime === "string" ? x.gravity_regime.slice(0, 40) : undefined,
      });
    }
  }
  const { records, investigations } = await serverData();
  const catalog = Object.fromEntries(investigations.map((i) => [i.accession, { acronym: i.acronym, title: i.title, doi: i.doi }]));
  return Response.json(compareConditionSet(conditions, { records, catalog }), { headers: { "Cache-Control": "no-store" } });
}
