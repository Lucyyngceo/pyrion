// Provider router: one function, complete(). Order: the requested model, the primary list, the fallback list.
// Retry once on 429 / 5xx / timeout, then move on. Every answer says which model produced it.

import type { Provider } from "./config.ts";

export class NoModelAvailable extends Error {
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = "NoModelAvailable";
    this.reason = reason;
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

export interface CompleteArgs {
  messages: ChatMessage[];
  tools?: unknown[];
  model?: string;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  /** Let a reasoning model think before answering (OpenRouter). Default false: short structured answers must not be cut off by hidden reasoning. */
  reasoning?: boolean;
  /** Use exactly `model`, with no fallback (health checks and smoke tests). */
  pin?: boolean;
}

export interface Meta {
  provider: Provider["id"];
  model: string;
  latency_ms: number;
  fell_back_from?: string;
}

export interface Completion {
  meta: Meta;
  /** Parsed chat-completion JSON (stream: false). */
  json?: { choices?: { message?: { content?: string | null; tool_calls?: unknown[] }; finish_reason?: string }[] };
  /** Raw SSE body (stream: true). */
  stream?: ReadableStream<Uint8Array>;
}

export interface Deps {
  providers: Provider[];
  fetch?: typeof fetch;
  /** Called before each request to a provider; return false to skip that provider (budget). */
  allow?: (provider: Provider["id"]) => boolean;
  /** Called when a request is actually sent. */
  onRequest?: (provider: Provider["id"]) => void;
  now?: () => number;
}

const timeoutMs = (model: string) => (/mistral-large/i.test(model) ? 60_000 : 30_000);
const retryable = (status: number) => status === 429 || status >= 500;

export function candidates(providers: Provider[], model: string | undefined, pin: boolean | undefined): { provider: Provider; model: string }[] {
  const all = providers.flatMap((p) => p.models.map((m) => ({ provider: p, model: m })));
  if (!model) return all;
  const asked = all.filter((c) => c.model === model);
  if (pin) return asked;
  return [...asked, ...all.filter((c) => c.model !== model)];
}

export async function complete(args: CompleteArgs, deps: Deps): Promise<Completion> {
  const f = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const list = candidates(deps.providers, args.model, args.pin);
  if (list.length === 0) throw new NoModelAvailable("no language-model provider is configured");
  let firstTried: string | undefined;
  const reasons: string[] = [];

  for (const { provider, model } of list) {
    if (deps.allow && !deps.allow(provider.id)) {
      reasons.push(`${provider.id}: daily cap reached`);
      continue;
    }
    firstTried ??= model;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (args.signal?.aborted) throw new DOMException("aborted", "AbortError");
      const t0 = now();
      deps.onRequest?.(provider.id);
      try {
        const res = await f(`${provider.base}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}`, ...provider.headers },
          body: JSON.stringify({
            model,
            messages: args.messages,
            ...(args.tools && args.tools.length ? { tools: args.tools } : {}),
            temperature: args.temperature ?? 0,
            max_tokens: args.maxTokens ?? 800,
            stream: !!args.stream,
            ...(provider.id === "openrouter" && !args.reasoning ? { reasoning: { enabled: false } } : {}),
          }),
          signal: args.signal ? AbortSignal.any([args.signal, AbortSignal.timeout(timeoutMs(model))]) : AbortSignal.timeout(timeoutMs(model)),
          cache: "no-store",
        });
        if (!res.ok) {
          reasons.push(`${model}: HTTP ${res.status}`);
          if (retryable(res.status) && attempt === 0) continue;
          break; // not retryable, or already retried: next model
        }
        const meta: Meta = { provider: provider.id, model, latency_ms: now() - t0, ...(firstTried !== model ? { fell_back_from: firstTried } : {}) };
        if (args.stream) {
          if (!res.body) throw new Error("no stream body");
          return { meta, stream: res.body };
        }
        return { meta, json: (await res.json()) as Completion["json"] };
      } catch (e) {
        if (args.signal?.aborted) throw e;
        reasons.push(`${model}: ${e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network error"}`);
        if (attempt === 0) continue;
      }
    }
  }
  throw new NoModelAvailable(`no model answered (${reasons.slice(-4).join("; ") || "none tried"})`);
}
