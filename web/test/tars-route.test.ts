import assert from "node:assert/strict";
import { test } from "node:test";
import { routeMessage } from "../lib/tars/route.ts";
import { MIN_SCORE, parseTopic, searchTopics, type Topic } from "../lib/tars/help.ts";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "../content/help");
const topics: Topic[] = readdirSync(dir).filter((n) => n.endsWith(".md")).map((n) => parseTopic(n.replace(/\.md$/, ""), readFileSync(join(dir, n), "utf8")));

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
    assert.ok(t.title && t.link && t.body.length > 40 && t.keywords.length > 0, t.id);
  }
});

test("Support finds the right topic for the site questions", () => {
  const best = (q: string) => {
    const h = searchTopics(topics, q, 1)[0];
    return h && h.score >= MIN_SCORE ? h.topic.id : null;
  };
  assert.equal(best("what is this"), "what-is-pyrion");
  assert.equal(best("how do I add a source"), "add-a-source");
  assert.equal(best("what does extrapolation mean"), "extrapolation-levels");
  assert.equal(best("what does Take me there do"), "navigator-take-me-there");
  assert.equal(best("how do I zoom the chart in full screen"), "full-screen-chart");
  assert.equal(best("can the AI decide the verdict"), "ai-limits");
  assert.equal(best("what is the bridge"), "bridge");
  assert.equal(best("blorfzzt quux"), null);
});

import { resolveMode, threePart, viewFor } from "../lib/tars/answer.ts";
import { evaluate, experimentsNeeded, parseConditionCsv, routesToEvidence, type ConditionRecord, type Target } from "../../engine/src/index.ts";

test("the facts are identical in Easy, Advanced and Auto; only the presentation changes", () => {
  const cdir = join(import.meta.dirname, "../../data/conditions");
  const records: ConditionRecord[] = readdirSync(cdir)
    .filter((n) => /^PSI-\d+\.csv$/.test(n))
    .flatMap((n) => parseConditionCsv(readFileSync(join(cdir, n), "utf8"), n, n.replace(".csv", "")).records);
  const target: Target = { regime: { gravity_regime: "microgravity" }, continuous: { o2_mole_fraction: 0.21, pressure: 101.325 } };
  const a = threePart({
    target,
    evaluation: evaluate(records, target),
    routes: routesToEvidence(records, target),
    experiments: experimentsNeeded(records, target),
    investigations: [],
    fingerprint: "0".repeat(64),
    readBy: "Read by code",
  });
  const facts = (m: "easy" | "advanced" | "auto", route: "condition" | "support") => {
    const v = viewFor(a, resolveMode(m, route));
    return JSON.stringify([v.known.map((f) => [f.id, f.text]), v.unknown.map((f) => [f.id, f.text]), v.next.map((f) => [f.id, f.text])]);
  };
  const base = facts("advanced", "condition");
  for (const m of ["easy", "advanced", "auto"] as const) for (const r of ["condition", "support"] as const) assert.equal(facts(m, r), base, `${m}/${r}`);
  assert.equal(viewFor(a, "easy").showDetail, false);
  assert.equal(viewFor(a, "easy").stepsOpen, false);
  assert.equal(viewFor(a, "advanced").stepsOpen, true);
  assert.equal(resolveMode("auto", "condition"), "advanced");
  assert.equal(resolveMode("auto", "support"), "easy");
  assert.ok(a.known.length > 0 && a.unknown.length > 0 && a.next.length > 0, "three parts, all present");
});
