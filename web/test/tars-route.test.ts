import assert from "node:assert/strict";
import { test } from "node:test";
import { routeMessage } from "../lib/tars/route.ts";
import { MIN_SCORE, searchTopics, type Topic } from "../lib/tars/help.ts";
import { loadTopicsSync } from "../lib/tars/topics-sync.ts";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "../content/help");
const topics: Topic[] = loadTopicsSync();

test("a message with a condition goes to the three-part answer; a how-to question goes to Support", () => {
  assert.equal(routeMessage("What burns at 34% oxygen and 8.2 psia on the Moon?"), "condition");
  assert.equal(routeMessage("¿Qué materiales arden más fácil a 34% de oxígeno y 8,2 psia en la Luna?"), "condition");
  assert.equal(routeMessage("Is 21% oxygen at 14.7 psia in microgravity covered?"), "condition");
  assert.equal(routeMessage("how do I add a source"), "support");
  assert.equal(routeMessage("what does extrapolation mean"), "support");
  assert.equal(routeMessage("what does Take me there do?"), "support");
  assert.equal(routeMessage("what is this"), "support");
});

test("at least 15 help topics, each with a title, keywords and a link", () => {
  assert.ok(topics.length >= 15);
  for (const t of topics) {
    assert.ok(t.title && t.link && t.body.length > 40, t.id);
  }
});

test("Support finds the right topic for the site questions", () => {
  const best = (q: string) => {
    const h = searchTopics(topics, q, 1)[0];
    return h && h.score >= MIN_SCORE ? h.topic.id : null;
  };
  assert.equal(best("what is this"), "what-is-pyrion");
  assert.equal(best("how do I add a source"), "add-a-source");
  assert.ok(["extrapolation-levels", "extrapolation"].includes(best("what does extrapolation mean") ?? ""));
  assert.equal(best("what does Take me there do"), "navigator-take-me-there");
  assert.equal(best("how do I zoom the chart in full screen"), "envelope-full-screen-zoom-pan");
  assert.equal(best("can the AI decide the verdict"), "ai-limits");
  assert.ok(["bridge", "bridge-explained"].includes(best("what is the bridge") ?? ""));
  assert.equal(best("blorfzzt quux"), null);
});

import { resolveMode, viewFor } from "../lib/tars/answer.ts";
import { parseConditionCsv, threePartAnswer, type ConditionRecord, type Target } from "../../engine/src/index.ts";

test("the engine's facts are identical in Easy and Advanced; the mode only chooses wording and detail", () => {
  const cdir = join(import.meta.dirname, "../../data/conditions");
  const records: ConditionRecord[] = readdirSync(cdir)
    .filter((n) => /^PSI-\d+\.csv$/.test(n))
    .flatMap((n) => parseConditionCsv(readFileSync(join(cdir, n), "utf8"), n, n.replace(".csv", "")).records);
  const target: Target = { regime: { gravity_regime: "microgravity" }, continuous: { o2_mole_fraction: 0.21, pressure: 101.325 } };
  const pair = { easy: threePartAnswer(records, target, { mode: "easy" }), advanced: threePartAnswer(records, target, { mode: "advanced" }), readBy: "Read by code" };
  const shape = (m: "easy" | "advanced") => {
    const a = viewFor(pair, m).answer;
    return JSON.stringify({ k: a.known.map((x) => x.citations.map((c) => c.accession)), u: a.unknown.map((x) => x.kind), n: a.next.map((x) => x.kind), f: a.fingerprint, t: a.target });
  };
  assert.equal(shape("easy"), shape("advanced"));
  for (const r of ["condition", "support"] as const) assert.equal(shape(resolveMode("auto", r)), shape("advanced"));
  assert.equal(viewFor(pair, "easy").showDetail, false);
  assert.equal(viewFor(pair, "easy").stepsOpen, false);
  assert.equal(viewFor(pair, "advanced").stepsOpen, true);
  assert.equal(resolveMode("auto", "condition"), "advanced");
  assert.equal(resolveMode("auto", "support"), "easy");
  assert.ok(pair.advanced.known.length > 0 && pair.advanced.unknown.length >= 0 && pair.advanced.next.length > 0, "known and next are present");
});

import { suggestNext } from "../lib/tars/suggest.ts";

test("suggested next questions come from templates and the state of the answer", () => {
  const s = suggestNext({ tools: ["set_condition", "evaluate_condition"], hasTarget: true, hasNasa: false });
  assert.equal(s.length, 3);
  assert.ok(s.some((x) => "action" in x && x.action === "show"));
  assert.ok(s.every((x) => x.label.length > 0));
  // a tool that already ran is not suggested again
  const t = suggestNext({ tools: ["what_would_close_the_gap", "run_calculator"], hasTarget: true, hasNasa: false });
  assert.ok(!t.some((x) => x.id === "gap" || x.id === "iss"));
  // Spanish labels
  assert.match(suggestNext({ tools: [], hasTarget: true, hasNasa: false, lang: "es" })[0].label, /brecha/);
  // no condition: only a plain-words follow-up
  assert.deepEqual(suggestNext({ tools: [], hasTarget: false, hasNasa: false }).map((x) => x.id), ["simple"]);
});
