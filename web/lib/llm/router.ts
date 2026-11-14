// Provider router: one function, complete(). Order: the requested model, the primary list, the fallback list.
// Limits per call: a total deadline, at most 3 candidates, at most one retry across the whole run (cap re-checked
// before it, backoff on 429). An empty or unusable answer is a failure, not a success: the next model is tried.

import { cleanModelText } from "./clean.ts";
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
  /** The caller's abort signal (for example req.signal): a client that leaves stops the work. */
  signal?: AbortSignal;
  /** Total time for the whole call, all candidates and retries included. Default 25 s. */
  deadlineMs?: number;
  /** At most this many candidates are tried. Default 3. */
  maxCandidates?: number;
  /** Let a reasoning model think before answering (OpenRouter). Default false. */
  reasoning?: boolean;
  /** The answer is usable only if this returns true for the cleaned text (for example: it parses). */
  validate?: (cleanedText: string) => boolean;
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
  json?: { choices?: { message?: { content?: string | null; tool_calls?: unknown[] }; finish_reason?: string }[] };
  stream?: ReadableStream<Uint8Array>;
}

export interface Deps {
  providers: Provider[];
  fetch?: typeof fetch;
  /** Asked before every request, retries included; false skips that provider (budget). */
  allow?: (provider: Provider["id"]) => boolean;
  /** Called when a request is actually sent. */
  onRequest?: (provider: Provider["id"]) => void;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
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

/** The usable text of a non-stream completion ("" when there is none). */
export function textOf(json: Completion["json"]): string {
  const raw = json?.choices?.[0]?.message?.content;
  return typeof raw === "string" ? cleanModelText(raw) : "";
}

export async function complete(args: CompleteArgs, deps: Deps): Promise<Completion> {
  const f = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const list = candidates(deps.providers, args.model, args.pin);
  if (list.length === 0) throw new NoModelAvailable("no language-model provider is configured");
  const deadline = AbortSignal.timeout(args.deadlineMs ?? 25_000);
  const overall = args.signal ? AbortSignal.any([args.signal, deadline]) : deadline;
  const maxCandidates = args.maxCandidates ?? 3;
  let retriesLeft = 1;
  let tried = 0;
  let firstTried: string | undefined;
  const reasons: string[] = [];

  for (const { provider, model } of list) {
    if (tried >= maxCandidates) break;
    if (deps.allow && !deps.allow(provider.id)) {
      reasons.push(`${provider.id}: daily cap reached`);
      continue;
    }
    tried++;
    firstTried ??= model;
    for (;;) {
      if (args.signal?.aborted) throw new DOMException("aborted", "AbortError");
      if (deadline.aborted) throw new NoModelAvailable(`deadline of ${(args.deadlineMs ?? 25_000) / 1000} s reached (${reasons.slice(-3).join("; ") || "no answer yet"})`);
      const t0 = now();
      deps.onRequest?.(provider.id);
      let status = 0;
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
          signal: AbortSignal.any([overall, AbortSignal.timeout(timeoutMs(model))]),
          cache: "no-store",
        });
        status = res.status;
        if (!res.ok) {
          reasons.push(`${model}: HTTP ${res.status}`);
        } else {
          const meta: Meta = { provider: provider.id, model, latency_ms: now() - t0, ...(firstTried !== model ? { fell_back_from: firstTried } : {}) };
          if (args.stream) {
            if (!res.body) throw new Error("no stream body");
            return { meta, stream: res.body };
          }
          const json = (await res.json()) as Completion["json"];
          const text = textOf(json);
          const hasTools = Array.isArray(json?.choices?.[0]?.message?.tool_calls) && (json?.choices?.[0]?.message?.tool_calls?.length ?? 0) > 0;
          if ((text === "" && !hasTools) || (text !== "" && args.validate && !args.validate(text))) {
            reasons.push(`${model}: ${text === "" ? `empty answer (${json?.choices?.[0]?.finish_reason ?? "no finish reason"})` : "unusable answer"}`);
            break; // not retried: another call to the same model gives the same kind of answer
          }
          return { meta, json };
        }
      } catch (e) {
        if (args.signal?.aborted) throw e;
        reasons.push(`${model}: ${e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network error"}`);
        status = 599;
      }
      // Here the request failed. One retry across the whole run, only if the cap still allows this provider.
      if (retryable(status) && retriesLeft > 0 && !deadline.aborted && (!deps.allow || deps.allow(provider.id))) {
        retriesLeft--;
        if (status === 429) await sleep(500);
        continue;
      }
      break; // next candidate
    }
  }
  throw new NoModelAvailable(`no model answered (${reasons.slice(-4).join("; ") || "none tried"})`);
}
