// Gives every browser an anonymous device id (a random number in an HttpOnly cookie) on its first page request.
// It is used only for fair rate limits; conversations stay in the browser. API routes set it themselves when it is missing.
import { NextResponse, type NextRequest } from "next/server";
import { deviceCookie, newDeviceId, readDeviceId } from "@/lib/llm/device";

export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  if (!readDeviceId(req.headers.get("cookie"))) res.headers.append("Set-Cookie", deviceCookie(newDeviceId()));
  return res;
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)"] };
