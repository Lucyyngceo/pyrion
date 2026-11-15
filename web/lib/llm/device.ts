// An anonymous device id: a random 128-bit number in an HttpOnly cookie, used only for fair rate limits. No personal data.
// Pure helpers (no Next imports), so the tests run them directly.

import { createHash, randomBytes } from "node:crypto";

export const DEVICE_COOKIE = "pyrion_device";
const ID_RE = /^[0-9a-f]{32}$/;

/** The raw id from a Cookie header, or null when it is missing or not a 128-bit hex number. */
export function readDeviceId(cookieHeader: string | null | undefined): string | null {
  for (const part of (cookieHeader ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === DEVICE_COOKIE) {
      const v = part.slice(i + 1).trim();
      return ID_RE.test(v) ? v : null;
    }
  }
  return null;
}

export const newDeviceId = () => randomBytes(16).toString("hex");

/** Set-Cookie value: HttpOnly, SameSite=Lax, one year, Secure in production. */
export function deviceCookie(id: string, production = process.env.NODE_ENV === "production"): string {
  return `${DEVICE_COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${production ? "; Secure" : ""}`;
}

/** What the limits see: a hash of the id, never the id itself. */
export const deviceKey = (id: string) => createHash("sha256").update(`device:${id}`).digest("hex").slice(0, 16);
