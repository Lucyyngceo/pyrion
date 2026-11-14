// Server only. Talks to any OpenAI-compatible endpoint (first target: NVIDIA NIM).
// Env (never committed; see web/.env.example): PYRION_LLM_BASE_URL, PYRION_LLM_API_KEY, PYRION_LLM_MODELS.
// The key stays on the server: it is never sent to the client and never logged.

import { NARRATE_SYSTEM, PARSE_SYSTEM, PROMPT_VERSION } from "@/lib/prompts";

export const dynamic = "force-dynamic";

function config() {
  const base = (process.env.PYRION_LLM_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (process.env.PYRION_LLM_API_KEY ?? "").trim();
  const models = (process.env.PYRION_LLM_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return { base, key, models, enabled: base !== "" && key !== "" && models.length > 0 };
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Whether questions are enabled and which models can be chosen. No secret is returned. */
export async function GET() {
  const c = config();
  return json({ enabled: c.enabled, models: c.enabled ? c.models : [], promptVersion: PROMPT_VERSION });
}

async function chat(c: ReturnType<typeof config>, model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch(`${c.base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.key}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`the model endpoint answered HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim() === "") throw new Error("the model endpoint returned no text");
  return text;
}

export async function POST(req: Request) {
  const c = config();
  if (!c.enabled) {
    return json({ error: "Structured mode: add a key to enable questions. Set PYRION_LLM_BASE_URL, PYRION_LLM_API_KEY and PYRION_LLM_MODELS on the server." }, 503);
  }
  let body: { step?: unknown; model?: unknown; question?: unknown; input?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "the request body is not JSON" }, 400);
  }
  const model = typeof body.model === "string" && c.models.includes(body.model) ? body.model : c.models[0];

  try {
    if (body.step === "parse") {
      const q = typeof body.question === "string" ? body.question.trim() : "";
      if (q === "" || q.length > 500) return json({ error: "the question must be 1 to 500 characters" }, 400);
      const reply = await chat(c, model, PARSE_SYSTEM, q, 500);
      return json({ model, promptVersion: PROMPT_VERSION, reply });
    }
    if (body.step === "narrate") {
      const input = JSON.stringify(body.input ?? null);
      if (input.length > 20_000 || input === "null") return json({ error: "the engine output is missing or too large" }, 400);
      const reply = await chat(c, model, NARRATE_SYSTEM, input, 400);
      return json({ model, promptVersion: PROMPT_VERSION, reply });
    }
    return json({ error: "unknown step" }, 400);
  } catch (e) {
    // Only our own short messages reach the client: never the upstream body, never the key.
    const msg = e instanceof Error && e.name !== "TimeoutError" ? e.message : "the model endpoint did not answer in time";
    return json({ error: msg }, 502);
  }
}
