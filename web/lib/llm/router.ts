// Provider router: one function, complete(). Order: the requested model, the primary list, the fallback list.
// Limits per call: a total deadline, at most 2 models per provider (6 in all by default), at most one retry across the run (cap re-checked
// before it, backoff on 429). An empty or unusable answer is a failure, not a success: the next model is tried.

import { cleanModelText } from "./clean.ts";
import { modelInfo, type Provider } from "./config.ts";

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
  /** Per-provider override of maxTokens (a reasoning model on one provider needs more room than a paid model on another). */
  maxTokensByProvider?: Partial<Record<Provider["id"], number>>;
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
  /** Providers known to be down (bad key, no credit), with the time until which they are skipped. Shared across calls. */
  down?: Map<string, number>;
}

/** How long a provider that failed as a whole (401, 402, 403, key or credit errors) is left alone. */
export const PROVIDER_DOWN_MS = 5 * 60_000;
const sharedDown = new Map<string, number>();
/** At most this many models are tried per provider, so the fallback provider is always reached. */
const PER_PROVIDER = 2;

/**
 * A failure of the provider as a whole, not of one model or one request: a bad key (401), no payment (402), or a 4xx
 * body that names credit, balance or billing. A 403 is that model only (access to one model, not the account).
 */
export function providerLevelFailure(status: number, body: string): boolean {
  if (status === 401 || status === 402) return true;
  return status >= 400 && status < 500 && status !== 403 && status !== 404 && status !== 429 && /credit|balance|billing/i.test(body);
}

/** Is this provider marked down right now (for health reporting)? */
export function providerIsDown(id: string, now: number = Date.now(), down: Map<string, number> = sharedDown): boolean {
  return (down.get(id) ?? 0) > now;
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
  const maxCandidates = args.maxCandidates ?? 6;
  const down = deps.down ?? sharedDown;
  const triedBy = new Map<string, number>();
  let retriesLeft = 1;
  let tried = 0;
  let firstTried: string | undefined;
  const reasons: string[] = [];

  for (const { provider, model } of list) {
    if (tried >= maxCandidates) break;
    if ((down.get(provider.id) ?? 0) > now()) {
      reasons.push(`${provider.id}: marked down`);
      continue;
    }
    if ((triedBy.get(provider.id) ?? 0) >= PER_PROVIDER) continue;
    if (deps.allow && !deps.allow(provider.id)) {
      reasons.push(`${provider.id}: daily cap reached`);
      continue;
    }
    tried++;
    triedBy.set(provider.id, (triedBy.get(provider.id) ?? 0) + 1);
    firstTried ??= model;
    for (;;) {
      if (args.signal?.aborted) throw new DOMException("aborted", "AbortError");
      if (deadline.aborted) throw new NoModelAvailable(`deadline of ${(args.deadlineMs ?? 25_000) / 1000} s reached (${reasons.slice(-3).join("; ") || "no answer yet"})`);
      // The cap is asked again right before the request is counted and sent (no await in between): concurrent
      // retries cannot all slip past a cap that was open when they started waiting.
      if (deps.allow && !deps.allow(provider.id)) {
        reasons.push(`${provider.id}: daily cap reached`);
        break;
      }
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
            max_tokens: args.maxTokensByProvider?.[provider.id] ?? args.maxTokens ?? 800,
            stream: !!args.stream,
            ...(provider.id === "openrouter" && !args.reasoning ? { reasoning: { enabled: false } } : {}),
            // NIM: a model configured with thinking: false answers in a second or two instead of thinking first.
            ...(provider.id === "nim" && !args.reasoning && modelInfo(model)?.thinking === false ? { chat_template_kwargs: { enable_thinking: false } } : {}),
          }),
          signal: AbortSignal.any([overall, AbortSignal.timeout(timeoutMs(model))]),
          cache: "no-store",
        });
        status = res.status;
        if (!res.ok) {
          reasons.push(`${model}: HTTP ${res.status}`);
          const text = res.status >= 400 && res.status < 500 ? await res.text().catch(() => "") : "";
          if (providerLevelFailure(res.status, text)) {
            down.set(provider.id, now() + PROVIDER_DOWN_MS); // skip the rest of this provider's models, now and for 5 minutes
            reasons.push(`${provider.id}: marked down for 5 minutes`);
            break;
          }
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
