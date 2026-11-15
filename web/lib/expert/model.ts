// How the expert modules talk to a language model without importing any provider code. The app passes an `AskModel` that
// wraps its router (askLlm); the tests pass stubs. A module that needs a model never gets to see a key or a URL.

export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelRequest {
  messages: ModelMessage[];
  /** Model ids in order of preference. The caller uses the first one that is available. */
  prefer: string[];
  /** Model families that must NOT answer this request (a reviewer must not be the family that wrote the answer). */
  avoidFamilies: string[];
  /** What the call is for, for logs ("second opinion", "split claims"). */
  purpose: string;
}

export interface ModelReply {
  text: string;
  /** The model id that really answered (after any fallback). */
  model: string;
  /** The display name, when the app has one. */
  name?: string;
  provider?: string;
}

/** One model turn. Rejects (throws) when no model can answer. */
export type AskModel = (req: ModelRequest) => Promise<ModelReply>;

/** The models the project knows about, by family, in the order a reviewer is tried (free NIM Nemotron first). */
export const REVIEWER_ORDER: readonly string[] = ["nvidia/nemotron-3-ultra-550b-a55b", "z-ai/glm-5.3", "qwen/qwen3.8-27b", "moonshotai/kimi-k2.6", "google/gemma-4-31b-it"];

/** "nemotron", "glm", "qwen", "kimi", "gemma"; any other id: its vendor prefix. */
export function modelFamily(id: string | null | undefined): string {
  const m = (id ?? "").toLowerCase();
  if (m === "") return "unknown";
  if (m.includes("nemotron")) return "nemotron";
  if (m.includes("glm")) return "glm";
  if (m.includes("qwen")) return "qwen";
  if (m.includes("kimi")) return "kimi";
  if (m.includes("gemma")) return "gemma";
  return m.split("/")[0] || "unknown";
}

/** The reviewer preference for an answer written by `answeredBy`: every known model of another family, Nemotron first unless it wrote the answer. */
export function reviewerPreference(answeredBy: string | null | undefined, available?: readonly string[]): string[] {
  const own = modelFamily(answeredBy);
  const list = REVIEWER_ORDER.filter((m) => modelFamily(m) !== own);
  return available ? list.filter((m) => available.includes(m)) : [...list];
}

/** The first JSON value ({...} or [...]) in a model's text, or null. Tolerates code fences and prose around it. */
export function extractJson(text: string): unknown | null {
  const t = text.replace(/```(?:json)?/gi, " ");
  for (let start = 0; start < t.length; start += 1) {
    const open = t[start];
    if (open !== "{" && open !== "[") continue;
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;
    for (let i = start; i < t.length; i += 1) {
      const c = t[i];
      if (inStr) {
        if (c === "\\") i += 1;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === open) depth += 1;
      else if (c === close && --depth === 0) {
        try {
          return JSON.parse(t.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}
