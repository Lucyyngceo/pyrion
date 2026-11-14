import assert from "node:assert/strict";
import { test } from "node:test";
import { createBudget, RateLimited } from "../lib/llm/budget.ts";
import { loadProviders, publicConfig } from "../lib/llm/config.ts";
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
  const b = createBudget({ perVisitorPerHour: 2, dailyCap: 2, now: () => t });
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
