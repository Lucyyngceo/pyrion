// The extracted condition files (CSV text), fetched by the Envelope page after its first paint so the home page HTML stays small.
import { loadDataset } from "@/lib/data";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
  const ds = await loadDataset();
  return Response.json({ files: ds.files }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
}
