// A page of a NASA document from the library, for the citation preview. Read-only; the lookup is by (doc_id, page) in memory, never by a path.

import { loadLibrary } from "@/lib/expert/library";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const doc = u.searchParams.get("doc_id") ?? "";
  const page = Number(u.searchParams.get("page"));
  if (doc === "" || doc.length > 300 || !Number.isInteger(page) || page < 1 || page > 5000) return Response.json({ error: "doc_id and page are required" }, { status: 400 });
  const lib = await loadLibrary();
  if (!lib) return Response.json({ error: "The NASA library is not available on this server." }, { status: 404 });
  const p = lib.page(doc, page);
  if (!p) return Response.json({ error: "No such page in the library." }, { status: 404 });
  return Response.json({ doc_id: doc, page, title: p.title ?? "", url: p.url ?? p.file_url ?? "", text: p.text.slice(0, 12000) }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
