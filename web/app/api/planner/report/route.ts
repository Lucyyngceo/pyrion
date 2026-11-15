// The gap report for the Moon Base band: Markdown or a print-ready HTML page, with its fingerprint. Deterministic.
import { report } from "@/lib/planner/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const r = await report();
  const fmt = new URL(req.url).searchParams.get("format");
  if (fmt === "md") return new Response(r.markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": 'attachment; filename="pyrion-gap-report.md"', "X-Fingerprint": r.fingerprint } });
  return new Response(r.html, { headers: { "Content-Type": "text/html; charset=utf-8", "X-Fingerprint": r.fingerprint } });
}
