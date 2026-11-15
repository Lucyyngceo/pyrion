// "Add a source": input checks for the dialog, and the single hook the Phase 3 pipeline will fill in.
// Pure (no imports), so it runs in the browser and in node tests.
// The visitor never supplies a URL to fetch: the server builds the ntrs.nasa.gov address itself from the NTRS number.

export const NASA_ONLY_SENTENCE =
  "Only NASA sources are accepted: an NTRS document number from ntrs.nasa.gov (e.g. 20250010653), or a NASA CSV or Excel table you upload.";
export const UPLOAD_NOTE = "Uploaded files are labelled “your file, not verified as NASA” unless they match an NTRS download.";
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ["csv", "xlsx"] as const;

export type Check = { ok: true } | { ok: false; reason: string };
export type NtrsCheck = { ok: true; id: string } | { ok: false; reason: string };

const ID_RE = /^\d{8,12}$/;

/**
 * An NTRS document number: digits only, or a pasted ntrs.nasa.gov citation / download link, from which only the digits are taken.
 * Anything else is rejected. The link itself is never used for fetching.
 */
export function checkNtrsInput(input: string): NtrsCheck {
  const text = input.trim();
  if (!text) return { ok: false, reason: "Enter an NTRS document number, or upload a file." };
  if (ID_RE.test(text)) return { ok: true, id: text };
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, reason: NASA_ONLY_SENTENCE };
  }
  if (u.protocol !== "https:" || u.username || u.password || u.hostname.toLowerCase() !== "ntrs.nasa.gov") return { ok: false, reason: NASA_ONLY_SENTENCE };
  const m = /^\/(?:api\/)?citations\/(\d{8,12})(?:\/|$)/.exec(u.pathname);
  return m ? { ok: true, id: m[1] } : { ok: false, reason: NASA_ONLY_SENTENCE };
}

export function checkSourceFile(file: { name: string; size: number }): Check {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) return { ok: false, reason: "Only CSV or XLSX files are accepted for now." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: "The file is larger than 20 MB." };
  if (file.size === 0) return { ok: false, reason: "The file is empty." };
  return { ok: true };
}

export type SourceInput = { kind: "ntrs"; id: string } | { kind: "file"; file: File };

/**
 * TODO(Phase 3): the pipeline. The server builds the ntrs.nasa.gov URL from `id` (never from visitor text), then: read -> extract with quotes ->
 * located in the source by code -> classified only if stated -> every scenario recalculated, shown before/after
 * (see pyrion-ops/FASE-3-ADD-SOURCE.md). Until it exists this reports that it does not, and never returns a made-up result.
 */
export async function addSource(_input: SourceInput): Promise<{ status: "not_available" }> {
  return { status: "not_available" };
}
