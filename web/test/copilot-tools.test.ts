import assert from "node:assert/strict";
import { test } from "node:test";
import { TOOL_DEFS, runTool, truncateResult, validateArgs, type ToolContext } from "../lib/copilot-tools.ts";
import { parseConditionCsv } from "../../engine/src/index.ts";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../../engine/test/fixtures/synthetic/", import.meta.url);
const records = readdirSync(dir)
  .filter((f) => f.endsWith(".csv"))
  .flatMap((f) => parseConditionCsv(readFileSync(new URL(f, dir), "utf8"), f, f.replace(".csv", "")).records);
const ctx: ToolContext = {
  records,
  investigations: [{ accession: "PSI-9001", acronym: "Synthetic", title: "Synthetic fixture", doi: "", license: "", version: "0" }],
  presets: [],
  bassCsv: null,
  sha256: async (t) => `len:${t.length}`,
};

test("every tool has a definition and unknown tools are rejected", () => {
  assert.equal(TOOL_DEFS.length, 8);
  assert.equal(validateArgs("rm_rf", {}).ok, false);
});

test("argument validation accepts good arguments and names the problem in bad ones", () => {
  assert.equal(validateArgs("transfer_hypothesis", { gravity: "moon" }).ok, true);
  assert.equal(validateArgs("transfer_hypothesis", { gravity: "venus" }).ok, false);
  assert.equal(validateArgs("fm2_balance", { limit_o2: "25 %" }).ok, true);
  assert.equal(validateArgs("fm2_balance", { limit_o2: "60 %" }).ok, false);
  assert.equal(validateArgs("fm2_balance", { limit_o2: 0.25 }).ok, false);
  assert.equal(validateArgs("find_evidence", { o2_range: ["30 %", "20 %"] }).ok, false);
  assert.equal(validateArgs("find_evidence", { o2_range: ["20 %", "30 %"], pressure_range: ["50 kPa", "10 psia"] }).ok, true);
  assert.equal(validateArgs("find_evidence", { limit: 99 }).ok, false);
  assert.equal(validateArgs("get_receipt", { accession: "PSI-9001" }).ok, false);
  assert.equal(validateArgs("evaluate_target", { gravity_regime: "zero" }).ok, false);
  assert.match(JSON.stringify(validateArgs("evaluate_target", { pressure: "10 psig" })), /gauge|psig/i);
  assert.equal(validateArgs("evaluate_target", { gravity: "microgravity", o2: "21 %", pressure: "1 atm" }).ok, true);
});

test("truncation keeps the result under the cap and says so", () => {
  const big = { items: Array.from({ length: 500 }, (_, i) => ({ id: i, text: "x".repeat(40) })) };
  const t = truncateResult(big, 2000);
  assert.equal(t.truncated, true);
  assert.ok(t.text.length <= 2000);
  assert.equal(JSON.parse(t.text)._truncated, true);
  assert.equal(truncateResult({ a: 1 }).truncated, false);
});

test("evaluate_target is deterministic: same target, same hash", async () => {
  const args = { gravity: "microgravity", fuel_phase: "solid", diluent: "N2", o2: "21 %", pressure: "8.2 psia" };
  const a = await runTool(ctx, "evaluate_target", args);
  const b = await runTool(ctx, "evaluate_target", args);
  assert.equal(a.engineHash, b.engineHash);
  assert.ok(a.engineHash);
  const conv = (a.result as { conversions: string[] }).conversions.join(" | ");
  assert.match(conv, /kPa/);
  assert.match(conv, /psia/);
});

test("get_receipt and find_evidence answer from the records, and say so when nothing matches", async () => {
  const r = await runTool(ctx, "get_receipt", { accession: "PSI-9001", test_id: "T1", variable: "o2_mole_fraction" });
  assert.equal((r.result as { found: boolean }).found, true);
  const none = await runTool(ctx, "get_receipt", { accession: "PSI-1", test_id: "x", variable: "pressure" });
  assert.match(JSON.stringify(none.result), /insufficient/);
  const f = await runTool(ctx, "find_evidence", { limit: 3 });
  assert.ok((f.result as { count_returned: number }).count_returned <= 3);
});

test("fm2_balance and flex tools", async () => {
  const v = validateArgs("fm2_balance", { limit_o2: "25 %", temperature: "22 C" });
  assert.equal(v.ok, true);
  const f = await runTool(ctx, "fm2_balance", v.ok ? v.value : {});
  assert.equal((f.result as { tests: unknown[] }).tests.length, 4);
  assert.ok((f.result as { conversions: string[] }).conversions.length === 2);
  assert.match(JSON.stringify((await runTool(ctx, "flex_model", { fuel: "heptane" })).result), /not available/);
});
