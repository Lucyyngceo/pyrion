// "Add a source": input checks for the dialog, and the single hook the Phase 3 pipeline will fill in.
// Pure (no imports), so it runs in the browser and in node tests.

export const NASA_ONLY_SENTENCE =
  "Only NASA sources are accepted: a link from ntrs.nasa.gov, nasa.gov or NASA PSI, or a NASA PDF, CSV or Excel file you upload.";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ["pdf", "csv", "xlsx"] as const;

export type Check = { ok: true } | { ok: false; reason: string };

/** https only, and only NASA hosts: nasa.gov and its subdomains (ntrs.nasa.gov, psi.nasa.gov, www.nasa.gov, ...). No credentials in the URL. */
export function checkSourceUrl(input: string): Check {
  const text = input.trim();
  if (!text) return { ok: false, reason: "Paste a link, or upload a file." };
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, reason: `That is not a web address. ${NASA_ONLY_SENTENCE}` };
  }
  if (u.protocol !== "https:") return { ok: false, reason: `Only https links are accepted. ${NASA_ONLY_SENTENCE}` };
  if (u.username || u.password) return { ok: false, reason: NASA_ONLY_SENTENCE };
  const host = u.hostname.toLowerCase();
  if (host !== "nasa.gov" && !host.endsWith(".nasa.gov")) return { ok: false, reason: NASA_ONLY_SENTENCE };
  return { ok: true };
}

export function checkSourceFile(file: { name: string; size: number }): Check {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) return { ok: false, reason: "Only PDF, CSV or XLSX files are accepted." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: "The file is larger than 20 MB." };
  if (file.size === 0) return { ok: false, reason: "The file is empty." };
  return { ok: true };
}

export type SourceInput = { kind: "url"; url: string } | { kind: "file"; file: File };

/**
 * TODO(Phase 3): the pipeline. Read -> extract with quotes -> second check -> located in the source by code -> classified only if stated ->
 * every scenario recalculated, shown before/after (see pyrion-ops/FASE-3-ADD-SOURCE.md). Until it exists this reports that it does not,
 * and never returns a made-up result.
 */
export async function addSource(_input: SourceInput): Promise<{ status: "not_available" }> {
  return { status: "not_available" };
}
