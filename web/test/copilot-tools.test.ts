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
  assert.equal(validateArgs("fm2_balance", { limit_o2: 0.25 }).ok, true);
  assert.match(JSON.stringify(validateArgs("fm2_balance", { limit_o2: 25 })), /mole fraction/);
  assert.equal(validateArgs("find_evidence", { o2_range: [0.3, 0.2] }).ok, false);
  assert.equal(validateArgs("find_evidence", { limit: 99 }).ok, false);
  assert.equal(validateArgs("get_receipt", { accession: "PSI-9001" }).ok, false);
  assert.equal(validateArgs("evaluate_target", { regime: { gravity_regime: "zero" }, continuous: {} }).ok, false);
  assert.equal(validateArgs("evaluate_target", { regime: { gravity_regime: "microgravity" }, continuous: { o2_mole_fraction: 0.21, pressure_kpa: 101.3 } }).ok, true);
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
  const args = { regime: { gravity_regime: "microgravity", fuel_phase: "solid", diluent: "N2", flame_type: null }, continuous: { o2_mole_fraction: 0.21, pressure_kpa: 80 } };
  const a = await runTool(ctx, "evaluate_target", args);
  const b = await runTool(ctx, "evaluate_target", args);
  assert.equal(a.engineHash, b.engineHash);
  assert.ok(a.engineHash);
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
  const f = await runTool(ctx, "fm2_balance", { limit_o2: 0.25, temperature_c: 22 });
  assert.equal((f.result as { tests: unknown[] }).tests.length, 4);
  assert.match(JSON.stringify((await runTool(ctx, "flex_model", { fuel: "heptane" })).result), /not available/);
});
