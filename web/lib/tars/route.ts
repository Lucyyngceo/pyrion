// Where a message goes: a condition (the extractor finds quantities) -> the three-part answer; anything else -> TARS Support.
// A harmful message is stopped by the content check on the server, as for the Ask box.

import { readByCode } from "../ask-core.ts";

export type Route = "condition" | "support";

export function routeMessage(text: string): Route {
  const r = readByCode(text);
  if (r.kind === "code" || r.kind === "issue") return "condition";
  return Object.keys(r.extracted).length > 0 ? "condition" : "support";
}
