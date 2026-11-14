// Live check, one tool-calling request per configured model. Prints a table: model, ok, ms. Never prints a key.
// Run from web/:  node --env-file=.env.local scripts/llm-smoke.ts

import { loadProviders } from "../lib/llm/config.ts";
import { complete } from "../lib/llm/router.ts";

const tools = [
  {
    type: "function",
    function: {
      name: "get_counts",
      description: "Return the number of investigations for a verdict.",
      parameters: { type: "object", properties: { verdict: { type: "string", enum: ["APPLICABLE", "REGIME_BARRIER"] } }, required: ["verdict"] },
    },
  },
];
const messages = [{ role: "user" as const, content: "How many investigations are REGIME_BARRIER? Use the tool." }];

const providers = loadProviders();
const rows: { provider: string; model: string; ok: string; ms: number }[] = [];
for (const p of providers) {
  for (const model of p.models) {
    const t0 = Date.now();
    try {
      const r = await complete({ messages, tools, model, pin: true, maxTokens: 200 }, { providers });
      const calls = r.json?.choices?.[0]?.message?.tool_calls ?? [];
      rows.push({ provider: p.id, model, ok: calls.length > 0 ? "tool call" : "answered, no tool call", ms: r.meta.latency_ms });
    } catch (e) {
      rows.push({ provider: p.id, model, ok: `FAILED (${e instanceof Error ? e.message.replace(/\s+/g, " ").slice(0, 60) : "error"})`, ms: Date.now() - t0 });
    }
  }
}
console.table(rows);
