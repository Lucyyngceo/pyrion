import assert from "node:assert/strict";
import { test } from "node:test";
import { createBudget, RateLimited } from "../lib/llm/budget.ts";
import { clientModels, loadProviders, openWeightsLabel, publicConfig } from "../lib/llm/config.ts";
import { cleanModelText } from "../lib/llm/clean.ts";
import { numEnv, visitorId, visitorIsolation } from "../lib/llm/index.ts";
import { candidates, complete, NoModelAvailable } from "../lib/llm/router.ts";
import { checkContent, readVerdict } from "../lib/llm/safety.ts";

const env = {
  OPENROUTER_BASE_URL: "https://or.test/v1/",
  OPENROUTER_API_KEY: "SECRET-OR",
  OPENROUTER_MODELS: "a/one, b/two",
  PYRION_LLM_BASE_URL: "https://nim.test/v1",
  PYRION_LLM_API_KEY: "SECRET-NIM",
  PYRION_LLM_MODELS: "n/one,n/two",
};
const providers = loadProviders(env);
const messages = [{ role: "user" as const, content: "hi" }];
const ok = (text = "x") => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });

/** A fake fetch: answers per (host, model) from a table of statuses; records every call. */
function fake(table: Record<string, number[]>) {
  const calls: string[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const model = JSON.parse(String(init.body)).model as string;
    calls.push(`${new URL(url).host}:${model}`);
    const next = (table[model] ?? [200]).shift() ?? 200;
    if (next === 0) throw new Error("network");
    return next === 200 ? ok(model) : new Response("{}", { status: next });
  }) as unknown as typeof fetch;
  return { f, calls };
}

test("order: requested model, then primary list, then fallback list", () => {
  assert.deepEqual(candidates(providers, "b/two", false).map((c) => c.model), ["b/two", "a/one", "n/one", "n/two"]);
  assert.deepEqual(candidates(providers, undefined, false).map((c) => c.model), ["a/one", "b/two", "n/one", "n/two"]);
  assert.deepEqual(candidates(providers, "n/two", true).map((c) => c.model), ["n/two"]);
});

test("the default model answers, with meta", async () => {
  const { f, calls } = fake({});
  const r = await complete({ messages }, { providers, fetch: f });
  assert.equal(r.meta.model, "a/one");
  assert.equal(r.meta.provider, "openrouter");
  assert.equal(r.meta.fell_back_from, undefined);
  assert.deepEqual(calls, ["or.test:a/one"]);
});

test("retry once on 5xx, then succeed with the same model", async () => {
  const { f, calls } = fake({ "a/one": [503, 200] });
  const r = await complete({ messages }, { providers, fetch: f });
  assert.equal(r.meta.model, "a/one");
  assert.equal(calls.length, 2);
});

test("a 4xx is not retried; the next model answers and fell_back_from names the first", async () => {
  const { f, calls } = fake({ "a/one": [400] });
  const r = await complete({ messages }, { providers, fetch: f });
  assert.equal(r.meta.model, "b/two");
  assert.equal(r.meta.fell_back_from, "a/one");
  assert.equal(calls.length, 2);
});

test("primary exhausted: the fallback provider answers", async () => {
  const { f } = fake({ "a/one": [500, 500], "b/two": [429, 429] });
  const r = await complete({ messages }, { providers, fetch: f });
  assert.equal(r.meta.provider, "nim");
  assert.equal(r.meta.model, "n/one");
  assert.equal(r.meta.fell_back_from, "a/one");
});

test("everything failing throws NoModelAvailable", async () => {
  const f = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
  await assert.rejects(complete({ messages }, { providers, fetch: f }), NoModelAvailable);
  await assert.rejects(complete({ messages }, { providers: [], fetch: f }), NoModelAvailable);
});

test("daily cap on the primary routes traffic to the fallback; both over: NoModelAvailable", async () => {
  const { f, calls } = fake({});
  const r = await complete({ messages }, { providers, fetch: f, allow: (id) => id !== "openrouter" });
  assert.equal(r.meta.provider, "nim");
  assert.ok(calls.every((c) => c.startsWith("nim.test")));
  await assert.rejects(complete({ messages }, { providers, fetch: f, allow: () => false }), NoModelAvailable);
});

test("pin uses exactly the model asked for", async () => {
  const { f } = fake({ "n/two": [500, 500] });
  await assert.rejects(complete({ messages, model: "n/two", pin: true }, { providers, fetch: f }), NoModelAvailable);
});

test("budget: daily cap and its reset; visitor hourly limit", () => {
  let t = Date.parse("2026-11-14T10:00:00Z");
  const b = createBudget({ perVisitorPerHour: 2, perVisitorPrimaryPerHour: 5, dailyCap: 2, now: () => t });
  assert.equal(b.primaryAllowed(), true);
  b.recordPrimary();
  b.recordPrimary();
  assert.equal(b.primaryAllowed(), false);
  assert.equal(b.remaining().remaining_today, 0);
  t += 86_400_000;
  assert.equal(b.primaryAllowed(), true);
  b.visitor("v");
  b.visitor("v");
  assert.throws(() => b.visitor("v"), RateLimited);
  b.visitor("other");
  t += 3_600_001;
  b.visitor("v");
});

test("the public configuration carries no key and no URL", () => {
  const text = JSON.stringify(publicConfig(providers));
  assert.ok(!text.includes("SECRET") && !text.includes("test/v1"));
});

test("A1: content safety policy, every branch (first guard, then the second only if the first flags)", async () => {
  assert.equal(readVerdict("User Safety: unsafe"), true);
  assert.equal(readVerdict('{"User Safety": "safe"}'), false);
  // a stub that answers per guard: "safe", "unsafe" or "down"
  const guards = (first: "safe" | "unsafe" | "down", second: "safe" | "unsafe" | "down") => {
    const calls: string[] = [];
    const f = (async (_u: string, init: RequestInit) => {
      const model = JSON.parse(String(init.body)).model as string;
      calls.push(model);
      const v = model.startsWith("nvidia/") ? first : second;
      if (v === "down") return new Response("{}", { status: 500 });
      return new Response(JSON.stringify({ choices: [{ message: { content: v } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    return { f, calls };
  };
  const run = async (a: "safe" | "unsafe" | "down", b: "safe" | "unsafe" | "down") => {
    const g = guards(a, b);
    return { r: await checkContent("x", providers, g.f, () => {}), calls: g.calls.length };
  };
  // first says safe: passes, the second is not even asked
  assert.deepEqual(await run("safe", "unsafe"), { r: { flagged: false, checked: true, detail: "first_safe" }, calls: 1 });
  // first flags, second clears: a false positive of the first guard
  assert.deepEqual((await run("unsafe", "safe")).r, { flagged: false, checked: true, detail: "second_cleared" });
  // both flag: refused
  assert.deepEqual((await run("unsafe", "unsafe")).r, { flagged: true, checked: true, detail: "both_flagged" });
  // first flags, second cannot answer: refused (fail closed once something flagged)
  assert.deepEqual((await run("unsafe", "down")).r, { flagged: true, checked: true, detail: "second_unavailable_after_flag" });
  // first cannot answer: the second decides alone
  assert.deepEqual((await run("down", "safe")).r, { flagged: false, checked: true, detail: "first_unavailable_second_safe" });
  assert.deepEqual((await run("down", "unsafe")).r, { flagged: true, checked: true, detail: "first_unavailable_second_flagged" });
  // neither can answer: it goes through, visibly unchecked
  assert.deepEqual((await run("down", "down")).r, { flagged: false, checked: false, detail: "both_unavailable" });
  // no NIM provider at all
  assert.deepEqual(await checkContent("x", [], undefined, () => {}), { flagged: false, checked: false, detail: "both_unavailable" });
});

const chat = (content: string | null, finish = "stop") => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: finish }] }), { status: 200 });

test("an empty answer, or one cut off by length with nothing in it, is a failure: the next model answers", async () => {
  const seq: Record<string, Response[]> = { "a/one": [chat("", "length")], "b/two": [chat("   ")], "n/one": [chat("good")] };
  const f = (async (_u: string, init: RequestInit) => seq[JSON.parse(String(init.body)).model].shift()) as unknown as typeof fetch;
  const r = await complete({ messages }, { providers, fetch: f });
  assert.equal(r.meta.model, "n/one");
  assert.equal(r.meta.fell_back_from, "a/one");
});

test("an answer that does not validate is a failure; <think> blocks and fences are stripped first", async () => {
  assert.equal(cleanModelText('<think>hmm</think>\n```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(cleanModelText("<think>never closed"), "");
  const seq: Record<string, Response[]> = { "a/one": [chat("not json")], "b/two": [chat('<think>x</think>{"ok":true}')] };
  const f = (async (_u: string, init: RequestInit) => seq[JSON.parse(String(init.body)).model].shift()) as unknown as typeof fetch;
  const r = await complete({ messages, validate: (t) => t.startsWith("{") }, { providers, fetch: f }).catch((e) => e);
  assert.equal(r.meta.model, "b/two");
});

test("at most two models are tried per provider, so the fallback is always reached", async () => {
  const { f, calls } = fake({ "a/one": [400], "b/two": [400], "n/one": [400], "n/two": [400] });
  await assert.rejects(complete({ messages }, { providers, fetch: f, down: new Map() }), NoModelAvailable);
  assert.deepEqual(calls, ["or.test:a/one", "or.test:b/two", "nim.test:n/one", "nim.test:n/two"]);
});

const status = (n: number, body = "{}") => new Response(body, { status: n });
function seqFetch(table: Record<string, Response[]>) {
  const calls: string[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const model = JSON.parse(String(init.body)).model as string;
    calls.push(`${new URL(url).host}:${model}`);
    return table[model]?.shift() ?? ok(model);
  }) as unknown as typeof fetch;
  return { f, calls };
}

test("primary 401: the whole provider is skipped and the fallback answers", async () => {
  const down = new Map<string, number>();
  const { f, calls } = seqFetch({ "a/one": [status(401)], "b/two": [status(401)] });
  const r = await complete({ messages }, { providers, fetch: f, down });
  assert.equal(r.meta.provider, "nim");
  assert.deepEqual(calls, ["or.test:a/one", "nim.test:n/one"]); // b/two never tried
  // and for the next 5 minutes, without trying it at all
  const again = await complete({ messages }, { providers, fetch: seqFetch({}).f, down });
  assert.equal(again.meta.provider, "nim");
});

test("primary 402 (no credit), or a 4xx that says so: the fallback answers", async () => {
  const { f } = seqFetch({ "a/one": [status(402)] });
  assert.equal((await complete({ messages }, { providers, fetch: f, down: new Map() })).meta.provider, "nim");
  const { f: f2 } = seqFetch({ "a/one": [status(400, '{"error":"Insufficient credits"}')] });
  assert.equal((await complete({ messages }, { providers, fetch: f2, down: new Map() })).meta.provider, "nim");
});

test("primary 429 twice: the fallback answers", async () => {
  const { f } = seqFetch({ "a/one": [status(429), status(429)], "b/two": [status(429)] });
  const r = await complete({ messages }, { providers, fetch: f, down: new Map(), sleep: async () => {} });
  assert.equal(r.meta.provider, "nim");
});

test("everything down: NoModelAvailable (structured mode)", async () => {
  const f = (async () => status(401)) as unknown as typeof fetch;
  await assert.rejects(complete({ messages }, { providers, fetch: f, down: new Map() }), NoModelAvailable);
});

test("one retry across the whole run, with a backoff on 429", async () => {
  const slept: number[] = [];
  const { f, calls } = fake({ "a/one": [429, 429], "b/two": [500, 200] });
  const r = await complete({ messages }, { providers, fetch: f, sleep: async (ms) => void slept.push(ms) });
  // a/one: 429, one retry 429 (the run's only retry), next b/two: 500 is not retried, next n/one answers.
  assert.equal(r.meta.model, "n/one");
  assert.equal(calls.length, 4);
  assert.deepEqual(slept, [500]);
});

test("the cap is re-checked before the retry", async () => {
  let open = true;
  const { f, calls } = fake({ "a/one": [500, 200] });
  const r = await complete({ messages }, { providers, fetch: f, allow: (id) => (id === "openrouter" ? open : true), onRequest: () => { open = false; } });
  assert.equal(r.meta.provider, "nim");
  assert.equal(calls.filter((c) => c.startsWith("or.test")).length, 1);
});

test("the total deadline stops the run", async () => {
  const slow = ((_u: string, init: RequestInit) => new Promise((_res, rej) => (init.signal as AbortSignal).addEventListener("abort", () => rej(new DOMException("t", "TimeoutError"))))) as unknown as typeof fetch;
  await assert.rejects(complete({ messages, deadlineMs: 50 }, { providers, fetch: slow }), /deadline|no model answered/);
});

test("a caller that leaves aborts the work", async () => {
  const ac = new AbortController();
  const f = ((_u: string, init: RequestInit) => new Promise((_res, rej) => (init.signal as AbortSignal).addEventListener("abort", () => rej(new DOMException("a", "AbortError"))))) as unknown as typeof fetch;
  const p = complete({ messages, signal: ac.signal }, { providers, fetch: f });
  ac.abort();
  await assert.rejects(p, (e: Error) => e.name === "AbortError");
});

test("budget: zero means zero, the daily counter persists, a visitor's primary quota, and the visitor map is capped", () => {
  const t = Date.parse("2026-11-14T10:00:00Z");
  let saved: { day: number; used: number; safety: number } | null = null;
  const store = { load: () => saved, save: (s: { day: number; used: number; safety: number }) => void (saved = { ...s }) };
  const b = createBudget({ perVisitorPerHour: 5, perVisitorPrimaryPerHour: 2, dailyCap: 0, now: () => t, store });
  assert.equal(b.primaryAllowed("v"), false);
  const b2 = createBudget({ perVisitorPerHour: 5, perVisitorPrimaryPerHour: 2, dailyCap: 3, now: () => t, store });
  b2.recordPrimary("v");
  b2.recordPrimary("v");
  assert.equal(b2.primaryAllowed("v"), false); // personal quota
  assert.equal(b2.primaryAllowed("w"), true);
  const b3 = createBudget({ perVisitorPerHour: 5, perVisitorPrimaryPerHour: 2, dailyCap: 3, now: () => t, store });
  assert.equal(b3.remaining().used_today, 2); // survived a "restart"
  const small = createBudget({ perVisitorPerHour: 5, perVisitorPrimaryPerHour: 2, dailyCap: 3, maxVisitors: 3, now: () => t });
  for (let i = 0; i < 50; i++) small.visitor(`spoof-${i}`);
  assert.ok(small.size() <= 3);
});

test("environment numbers: 0 is 0; clients get only the cheap models", () => {
  process.env.PYRION_DAILY_REQUEST_CAP = "0";
  assert.equal(numEnv("PYRION_DAILY_REQUEST_CAP", 300), 0);
  delete process.env.PYRION_DAILY_REQUEST_CAP;
  assert.equal(numEnv("PYRION_DAILY_REQUEST_CAP", 300), 300);
  const ps = loadProviders({ ...env, OPENROUTER_MODELS: "qwen/qwen3.8-27b,moonshotai/kimi-k2.6,qwen/qwen3.8-max-0902" });
  assert.deepEqual(clientModels(ps, {}), ["qwen/qwen3.8-27b", "moonshotai/kimi-k2.6"]);
});

test("m6: X-Real-IP is believed only with PYRION_TRUST_PROXY=1 and the proxy's secret", () => {
  const req = (h: Record<string, string>) => new Request("http://x", { headers: h });
  delete process.env.PYRION_TRUST_PROXY;
  delete process.env.PYRION_PROXY_SECRET;
  assert.equal(visitorId(req({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" })), "shared");
  process.env.PYRION_TRUST_PROXY = "1";
  assert.equal(visitorId(req({ "x-real-ip": "5.6.7.8" })), "shared"); // trusted proxy but no secret configured
  assert.equal(visitorIsolation(), false);
  process.env.PYRION_PROXY_SECRET = "s3cret";
  assert.equal(visitorIsolation(), true);
  assert.equal(visitorId(req({ "x-real-ip": "5.6.7.8" })), "shared"); // forged: no secret header
  assert.equal(visitorId(req({ "x-real-ip": "5.6.7.8", "x-pyrion-proxy": "wrong" })), "shared");
  const a = visitorId(req({ "x-real-ip": "5.6.7.8", "x-pyrion-proxy": "s3cret", "x-forwarded-for": "9.9.9.9" }));
  assert.notEqual(a, "shared");
  assert.equal(a, visitorId(req({ "x-real-ip": "5.6.7.8", "x-pyrion-proxy": "s3cret", "x-forwarded-for": "8.8.8.8" })));
  delete process.env.PYRION_TRUST_PROXY;
  delete process.env.PYRION_PROXY_SECRET;
});

test("thinking: false sends enable_thinking false to NIM for that model only, and only when reasoning is not asked for", async () => {
  const bodies: Record<string, unknown>[] = [];
  const f = (async (_u: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return ok("x");
  }) as unknown as typeof fetch;
  const nim = loadProviders({ PYRION_LLM_BASE_URL: "https://nim.test/v1", PYRION_LLM_API_KEY: "k", PYRION_LLM_MODELS: "nvidia/nemotron-3-ultra-550b-a55b,google/gemma-4-31b-it,other/unknown" });
  for (const model of ["nvidia/nemotron-3-ultra-550b-a55b", "google/gemma-4-31b-it", "other/unknown"]) await complete({ messages, model, pin: true }, { providers: nim, fetch: f, down: new Map() });
  await complete({ messages, model: "nvidia/nemotron-3-ultra-550b-a55b", pin: true, reasoning: true }, { providers: nim, fetch: f, down: new Map() });
  assert.deepEqual(bodies[0].chat_template_kwargs, { enable_thinking: false });
  assert.equal(bodies[1].chat_template_kwargs, undefined);
  assert.equal(bodies[2].chat_template_kwargs, undefined);
  assert.equal(bodies[3].chat_template_kwargs, undefined);
});

test("open weights: a verified table entry carries license and source; any other model carries no label", () => {
  const q = openWeightsLabel("qwen/qwen3.8-27b");
  assert.equal(q?.license, "Apache-2.0");
  assert.match(q?.source ?? "", /huggingface\.co\/Qwen/);
  assert.match(openWeightsLabel("nvidia/nemotron-3-ultra-550b-a55b")?.license ?? "", /OpenMDW/);
  assert.equal(openWeightsLabel("moonshotai/kimi-k2.6")?.license, "Modified MIT");
  assert.equal(openWeightsLabel("nvidia/llama-3.1-nemotron-safety-guard-8b-v3"), null);
  assert.equal(openWeightsLabel("some/other-model"), null);
});

test("N4: the content check stops with the caller's signal and never exceeds its own total time", async () => {
  const hang = ((_u: string, init: RequestInit) => new Promise((_r, rej) => (init.signal as AbortSignal).addEventListener("abort", () => rej(new DOMException("a", "AbortError"))))) as unknown as typeof fetch;
  const ac = new AbortController();
  const t0 = Date.now();
  const p = checkContent("x", providers, hang, () => {}, ac.signal);
  setTimeout(() => ac.abort(), 30);
  assert.deepEqual(await p, { flagged: false, checked: false, detail: "both_unavailable" });
  assert.ok(Date.now() - t0 < 1000);
});

test("m1: a 403 is that model only; 401, 402 and credit or balance bodies are provider-wide", async () => {
  const { providerLevelFailure } = await import("../lib/llm/router.ts");
  assert.equal(providerLevelFailure(403, "{}"), false);
  assert.equal(providerLevelFailure(403, "insufficient credit"), false);
  assert.equal(providerLevelFailure(400, "Insufficient permissions for this model"), false);
  assert.equal(providerLevelFailure(401, ""), true);
  assert.equal(providerLevelFailure(402, ""), true);
  assert.equal(providerLevelFailure(400, '{"error":"Out of credits"}'), true);
  assert.equal(providerLevelFailure(400, "Account balance too low"), true);
  const down = new Map<string, number>();
  const { f, calls } = seqFetch({ "a/one": [status(403)] });
  const r = await complete({ messages }, { providers, fetch: f, down });
  assert.equal(r.meta.model, "b/two"); // the next model of the same provider still answers
  assert.equal(down.size, 0);
  assert.deepEqual(calls, ["or.test:a/one", "or.test:b/two"]);
});

test("m3: concurrent 429 retries cannot slip past the cap: it is asked again right before each request", async () => {
  let budget = 5;
  const allow = () => budget > 0;
  const onRequest = () => void budget--;
  const f = (async () => status(429)) as unknown as typeof fetch;
  const runs = Array.from({ length: 4 }, () => complete({ messages }, { providers: loadProviders({ OPENROUTER_BASE_URL: "https://or.test/v1", OPENROUTER_API_KEY: "k", OPENROUTER_MODELS: "a/one,b/two" }), fetch: f, allow, onRequest, down: new Map(), sleep: async () => {} }).catch(() => null));
  await Promise.all(runs);
  assert.ok(budget >= 0, `the cap went negative: ${budget}`);
});

test("m8: max_tokens can differ per provider", async () => {
  const bodies: Record<string, number>[] = [];
  const f = (async (u: string, init: RequestInit) => {
    bodies.push({ [new URL(u).host]: JSON.parse(String(init.body)).max_tokens });
    return u.includes("or.test") ? status(500) : ok("x");
  }) as unknown as typeof fetch;
  await complete({ messages, maxTokens: 400, maxTokensByProvider: { nim: 2000 } }, { providers, fetch: f, down: new Map(), sleep: async () => {} });
  assert.equal(bodies[0]["or.test"], 400);
  assert.equal(bodies.at(-1)!["nim.test"], 2000);
});

test("m4: a damaged budget file closes the primary provider; writes go through a temp file", async () => {
  const { createFileStore } = await import("../lib/llm/index.ts");
  const { mkdtempSync, writeFileSync, readdirSync, readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const dir = mkdtempSync(path.join(tmpdir(), "pyrion-budget-"));
  const file = path.join(dir, "budget.json");
  const logs: string[] = [];
  const store = createFileStore(file, (m) => logs.push(m));
  assert.equal(store.load(), null); // no file: a fresh counter
  const today = Math.floor(Date.now() / 86_400_000);
  store.save({ day: today, used: 7, safety: 1 });
  assert.equal(JSON.parse(readFileSync(file, "utf8")).used, 7);
  assert.deepEqual(readdirSync(dir), ["budget.json"]); // no temp file left behind
  writeFileSync(file, '{"day":'); // truncated by a crash
  const b = createBudget({ perVisitorPerHour: 5, perVisitorPrimaryPerHour: 5, dailyCap: 300, store });
  assert.equal(b.primaryAllowed(), false); // fails closed, not "0 used"
  assert.match(logs.join(" "), /damaged/);
});
