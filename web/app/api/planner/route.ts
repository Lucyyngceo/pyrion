// The designer: hypothetical test points in, live coverage out (coverageGained). Pure engine computation: no model, nothing saved.
import { design, PHASES } from "@/lib/planner/data";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 8 * 1024) return Response.json({ error: "the request is too large" }, { status: 413 });
  let body: { points?: unknown; fuelPhase?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "the request body is not JSON" }, { status: 400 });
  }
  const phase = PHASES.find((p) => p === body.fuelPhase);
  if (!phase) return Response.json({ error: "fuelPhase must be solid, liquid or gas" }, { status: 400 });
  if (!Array.isArray(body.points) || body.points.length > 20) return Response.json({ error: "send up to 20 points" }, { status: 400 });
  const points: { o2: number; pressure: number }[] = [];
  for (const p of body.points as { o2?: unknown; pressure?: unknown }[]) {
    if (typeof p?.o2 !== "number" || typeof p?.pressure !== "number" || !(p.o2 > 0.05 && p.o2 <= 1) || !(p.pressure > 5 && p.pressure < 400)) return Response.json({ error: "each point needs o2 (mole fraction) and pressure (kPa) in a plausible range" }, { status: 400 });
    points.push({ o2: p.o2, pressure: p.pressure });
  }
  if (points.length === 0) return Response.json({ error: "add at least one point" }, { status: 400 });
  return Response.json(await design(points, phase), { headers: { "Cache-Control": "no-store" } });
}
