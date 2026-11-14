import assert from "node:assert/strict";
import { test } from "node:test";
import { createBudget, RateLimited } from "../lib/llm/budget.ts";
import { clientModels, loadProviders, openWeightsModels, publicConfig } from "../lib/llm/config.ts";
import { cleanModelText } from "../lib/llm/clean.ts";
import { numEnv, visitorId } from "../lib/llm/index.ts";
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

test("content safety: flagged, clear, and a failing safety model does not block", async () => {
  assert.equal(readVerdict("User Safety: unsafe"), true);
  assert.equal(readVerdict('{"User Safety": "safe"}'), false);
  const reply = (c: string) => (async () => new Response(JSON.stringify({ choices: [{ message: { content: c } }] }), { status: 200 })) as unknown as typeof fetch;
  assert.deepEqual(await checkContent("x", providers, reply("unsafe")), { flagged: true, checked: true });
  assert.deepEqual(await checkContent("x", providers, reply("safe")), { flagged: false, checked: true });
  const down = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
  assert.deepEqual(await checkContent("x", providers, down, () => {}), { flagged: false, checked: false });
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

test("at most three candidates are tried", async () => {
  const { f, calls } = fake({ "a/one": [400], "b/two": [400], "n/one": [400], "n/two": [200] });
  await assert.rejects(complete({ messages }, { providers, fetch: f }), NoModelAvailable);
  assert.equal(calls.length, 3);
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

test("environment numbers: 0 is 0; the visitor id trusts only our proxy; clients get only the cheap models", () => {
  process.env.PYRION_DAILY_REQUEST_CAP = "0";
  assert.equal(numEnv("PYRION_DAILY_REQUEST_CAP", 300), 0);
  delete process.env.PYRION_DAILY_REQUEST_CAP;
  assert.equal(numEnv("PYRION_DAILY_REQUEST_CAP", 300), 300);
  const req = (h: Record<string, string>) => new Request("http://x", { headers: h });
  delete process.env.PYRION_TRUST_PROXY;
  assert.equal(visitorId(req({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" })), "shared");
  process.env.PYRION_TRUST_PROXY = "1";
  const a = visitorId(req({ "x-real-ip": "5.6.7.8", "x-forwarded-for": "9.9.9.9" }));
  assert.notEqual(a, "shared");
  assert.equal(a, visitorId(req({ "x-real-ip": "5.6.7.8", "x-forwarded-for": "8.8.8.8" })));
  delete process.env.PYRION_TRUST_PROXY;
  const ps = loadProviders({ ...env, OPENROUTER_MODELS: "qwen/qwen3.8-27b,moonshotai/kimi-k2.6,qwen/qwen3.8-max-0902" });
  assert.deepEqual(clientModels(ps, {}), ["qwen/qwen3.8-27b", "moonshotai/kimi-k2.6"]);
  assert.deepEqual(openWeightsModels({}), []);
});
