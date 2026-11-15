import assert from "node:assert/strict";
import { test } from "node:test";
import { createBudget, RateLimited } from "../lib/llm/budget.ts";
import { deviceCookie, deviceKey, newDeviceId, readDeviceId } from "../lib/llm/device.ts";
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
  // first flags, second cannot answer even after a retry: not refused as harmful; the caller says "could not finish" (503)
  const stuck = await run("unsafe", "down");
  assert.deepEqual(stuck.r, { flagged: false, checked: true, unresolved: true, detail: "second_unavailable_after_flag" });
  assert.equal(stuck.calls, 3, "first guard once, second guard twice");
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
  const ps = loadProviders({ ...env, OPENROUTER_MODELS: "nvidia/nemotron-3-ultra-550b-a55b,google/gemma-4-31b-it,mistralai/mistral-small-3.2-24b-instruct,openai/gpt-oss-120b" });
  assert.deepEqual(clientModels(ps, {}), ["nvidia/nemotron-3-ultra-550b-a55b", "google/gemma-4-31b-it", "mistralai/mistral-small-3.2-24b-instruct"]);
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
  const q = openWeightsLabel("openai/gpt-oss-120b");
  assert.equal(q?.license, "Apache-2.0");
  assert.match(q?.source ?? "", /huggingface\.co\/openai/);
  assert.match(openWeightsLabel("nvidia/nemotron-3-ultra-550b-a55b")?.license ?? "", /OpenMDW/);
  assert.equal(openWeightsLabel("mistralai/mistral-small-3.2-24b-instruct")?.license, "Apache-2.0");
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

test("A1b: a second guard that times out once is retried; twice is 'unresolved', never 'harmful'", async () => {
  const mk = (secondFails: number, secondSays: "safe" | "unsafe") => {
    let secondCalls = 0;
    const f = (async (_u: string, init: RequestInit) => {
      const model = JSON.parse(String(init.body)).model as string;
      if (model.startsWith("nvidia/")) return new Response(JSON.stringify({ choices: [{ message: { content: "unsafe" } }] }), { status: 200 });
      secondCalls++;
      if (secondCalls <= secondFails) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      return new Response(JSON.stringify({ choices: [{ message: { content: secondSays } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    return { f, calls: () => secondCalls };
  };
  const q = "¿Qué materiales arden más fácil a 34% de oxígeno y 8,2 psia en la Luna?";
  // one timeout, then the retry clears it: the benign question is answered
  const a = mk(1, "safe");
  assert.deepEqual(await checkContent(q, providers, a.f, () => {}), { flagged: false, checked: true, detail: "second_cleared" });
  assert.equal(a.calls(), 2);
  // one timeout, then the retry confirms: a truly harmful question is still refused
  const b = mk(1, "unsafe");
  assert.deepEqual(await checkContent("harmful", providers, b.f, () => {}), { flagged: true, checked: true, detail: "both_flagged" });
  // two timeouts: unresolved, not flagged
  const c = mk(2, "safe");
  const r = await checkContent(q, providers, c.f, () => {});
  assert.equal(r.flagged, false);
  assert.equal(r.unresolved, true);
});

test("gpt-oss-120b (reasoning required): effort instead of enabled:false, room to think, reasoning hidden; 402 still falls back to NIM", async () => {
  const reasonEnv = { ...env, OPENROUTER_MODELS: "openai/gpt-oss-120b,mistralai/mistral-small-3.2-24b-instruct" };
  const reasonProviders = loadProviders(reasonEnv);
  const bodies: Record<string, unknown>[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const b = JSON.parse(String(init.body)) as Record<string, unknown>;
    bodies.push({ host: new URL(url).host, ...b });
    return ok("answer");
  }) as unknown as typeof fetch;
  await complete({ messages, effort: "medium", maxTokens: 400 }, { providers: reasonProviders, fetch: f, down: new Map() });
  assert.deepEqual(bodies[0].reasoning, { effort: "medium", exclude: true });
  assert.ok((bodies[0].max_tokens as number) >= 1500, "a reasoning model gets room to think");
  bodies.length = 0;
  await complete({ messages, model: "mistralai/mistral-small-3.2-24b-instruct" }, { providers: reasonProviders, fetch: f, down: new Map() });
  assert.deepEqual(bodies[0].reasoning, { enabled: false }, "other models stay switched off");
  // OpenRouter has no credit (402): the whole provider is skipped and NIM answers
  const g = (async (url: string, init: RequestInit) => {
    const host = new URL(url).host;
    return host === "or.test" ? new Response("{}", { status: 402 }) : ok("from nim");
  }) as unknown as typeof fetch;
  const r = await complete({ messages }, { providers: reasonProviders, fetch: g, down: new Map() });
  assert.equal(r.meta.provider, "nim");
  assert.deepEqual(openWeightsLabel("openai/gpt-oss-120b"), { license: "Apache-2.0", source: "https://huggingface.co/openai/gpt-oss-120b" });
});

test("device id: a random 128-bit number in an HttpOnly SameSite=Lax cookie; bad or missing cookies are not accepted", () => {
  const id = newDeviceId();
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.notEqual(id, newDeviceId());
  const c = deviceCookie(id, true);
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Lax/);
  assert.match(c, /Secure/);
  assert.match(c, /Max-Age=31536000/);
  assert.ok(!deviceCookie(id, false).includes("Secure"));
  assert.equal(readDeviceId(`a=1; pyrion_device=${id}; b=2`), id);
  assert.equal(readDeviceId("pyrion_device=short"), null);
  assert.equal(readDeviceId("pyrion_device=" + "z".repeat(32)), null);
  assert.equal(readDeviceId(null), null);
  assert.notEqual(deviceKey(id), id, "limits see a hash, not the id");
});

test("rate limits per device and per network: two devices on one IP have separate buckets; the network cap holds across devices; no cookie is still limited", () => {
  const t = 1_000_000;
  const b = createBudget({ perVisitorPerHour: 3, perVisitorPrimaryPerHour: 2, perNetworkPerHour: 5, perNetworkPrimaryPerHour: 3, dailyCap: 100, now: () => t });
  const A = { device: "devA", network: "wifi" };
  const B = { device: "devB", network: "wifi" };
  for (let i = 0; i < 3; i++) b.visitor(A);
  assert.throws(() => b.visitor(A), RateLimited, "device A is out");
  b.visitor(B); // device B on the same Wi-Fi still has its own allowance
  b.visitor(B);
  // the network has now seen 5 questions: the cap holds across devices
  assert.throws(() => b.visitor({ device: "devC", network: "wifi" }), RateLimited, "the network cap applies to a new device");
  // clearing the cookie (a fresh device id) does not bypass the network cap
  assert.throws(() => b.visitor({ device: "freshAfterClearing", network: "wifi" }), RateLimited);
  // another network is untouched
  b.visitor({ device: "devA2", network: "cafe" });
  // no cookie: a caller without one is limited too (by the network's own no-cookie bucket)
  const c = createBudget({ perVisitorPerHour: 2, perVisitorPrimaryPerHour: 2, perNetworkPerHour: 50, perNetworkPrimaryPerHour: 50, dailyCap: 100, now: () => t });
  const N = { device: null, network: "wifi" };
  c.visitor(N);
  c.visitor(N);
  assert.throws(() => c.visitor(N), RateLimited);
  // the primary provider: a device's quota is 2 here, the network's 3
  const d = createBudget({ perVisitorPerHour: 9, perVisitorPrimaryPerHour: 2, perNetworkPerHour: 50, perNetworkPrimaryPerHour: 3, dailyCap: 100, now: () => t });
  d.recordPrimary(A);
  d.recordPrimary(A);
  assert.equal(d.primaryAllowed(A), false);
  assert.equal(d.primaryAllowed(B), true);
  d.recordPrimary(B);
  assert.equal(d.primaryAllowed({ device: "devC", network: "wifi" }), false, "the network's primary quota is used up");
  // plain string visitors behave as before
  const e = createBudget({ perVisitorPerHour: 1, perVisitorPrimaryPerHour: 1, dailyCap: 5, now: () => t });
  e.visitor("x");
  assert.throws(() => e.visitor("x"), RateLimited);
});
