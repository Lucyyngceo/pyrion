// A shared link carries a question, a condition and the fingerprint of the engine part. Nothing is stored on a server.

/** What a shared link carries: the question, the condition, and the fingerprint of the engine part when it was shared. */
export interface Shared {
  q: string;
  t: unknown;
  fp?: string;
}
export function encodeShare(x: Shared): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, ...x }));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeShare(raw: string): Shared | null {
  try {
    const bin = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    const j = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as { v?: number; q?: unknown; t?: unknown; fp?: unknown };
    if (j.v !== 1 || typeof j.q !== "string" || !j.t || typeof j.t !== "object") return null;
    return { q: j.q.slice(0, 600), t: j.t, ...(typeof j.fp === "string" && /^[0-9a-f]{64}$/.test(j.fp) ? { fp: j.fp } : {}) };
  } catch {
    return null;
  }
}
