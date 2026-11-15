import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseConditionCsv, type ConditionRecord, type Target } from "../../engine/src/index.ts";
import { corpusFromPages } from "../lib/expert/claims.ts";
import { executeTool, mergeTargets, newState, runAgent, type AgentEnv, type AssistantMsg, type ChatMsg } from "../lib/expert/agent.ts";
import { type Topic } from "../lib/tars/help.ts";
import { loadTopicsSync } from "../lib/tars/topics-sync.ts";

const cdir = join(import.meta.dirname, "../../data/conditions");
const records: ConditionRecord[] = readdirSync(cdir)
  .filter((n) => /^PSI-\d+\.csv$/.test(n))
  .flatMap((n) => parseConditionCsv(readFileSync(join(cdir, n), "utf8"), n, n.replace(".csv", "")).records);
const hdir = join(import.meta.dirname, "../content/help");
const topics: Topic[] = loadTopicsSync();

const PAGE = "FM2 plans four burns of one fabric at 8.2 psia with 37, 33, 29 and 25 % oxygen in a closed chamber.";
const pages = [{ doc_id: "nasa/ntrs-1/x.pdf", page: 3, text: PAGE, title: "FM2 plan", url: "https://ntrs.nasa.gov/x" }];
const library = {
  corpus: corpusFromPages(pages),
  search: async () => [{ doc_id: "nasa/ntrs-1/x.pdf", page_start: 3, page_end: 3, title: "FM2 plan", url: "https://ntrs.nasa.gov/x", text: PAGE }],
  page: (d: string, p: number) => pages.find((x) => x.doc_id === d && x.page === p),
};

const call = (id: string, name: string, args: Record<string, unknown>) => ({ id, function: { name, arguments: JSON.stringify(args) } });

/** A scripted model: each entry is one assistant turn; the tool results it received are recorded. */
function script(turns: ((seen: ChatMsg[]) => AssistantMsg)[]) {
  const seen: ChatMsg[][] = [];
  let i = 0;
  const env: Omit<AgentEnv, "chat"> = { records, investigations: [], library, topics };
  return { env, seen, chat: async (m: ChatMsg[]) => (seen.push([...m]), turns[Math.min(i++, turns.length - 1)](m)) };
}
const toolOut = (m: ChatMsg[], n: number) => JSON.parse(m.filter((x) => x.role === "tool")[n].content as string) as Record<string, unknown>;

test("tool routing: condition -> engine -> calculator; the answer is checked and kept by layer", async () => {
  const s = script([
    () => ({ content: null, tool_calls: [call("1", "set_condition", { text: "34% oxygen at 8.2 psia in microgravity" }), call("2", "evaluate_condition", {}), call("3", "run_calculator", { name: "o2PartialPressure", args: { o2: "34 %", pressure: "8.2 psia" } })] }),
    (m) => {
      const ev = toolOut(m, 1);
      const calc = toolOut(m, 2);
      return {
        content: JSON.stringify([
          { layer: "engine", text: `Of the investigations, ${(ev.counts as Record<string, number>).APPLICABLE} are applicable here.`, toolRefs: [ev.ref] },
          { layer: "expert", text: `The oxygen partial pressure is ${(calc.result as string).match(/2\.788 psia/)?.[0]}. Higher oxygen at low pressure can still burn hotter.`, toolRefs: [calc.ref] },
        ]),
      };
    },
  ]);
  const r = await runAgent({ ...s.env, chat: s.chat }, { message: "What about 34% oxygen at 8.2 psia?" });
  assert.deepEqual(r.steps.map((x) => x.tool), ["set_condition", "evaluate_condition", "run_calculator"]);
  assert.equal(r.kept.length, 2, JSON.stringify(r.report));
  assert.deepEqual(r.kept.map((b) => b.layer), ["engine", "expert"]);
  assert.match(r.kept[1].text, /2\.788/, "the number came from the calculator");
  assert.equal(r.report.dropped.length, 0);
  assert.ok(r.target && r.target.continuous.o2_mole_fraction === 0.34);
});

test("checkAnswer integration: a fake quote hides the whole block; a number from nowhere is replaced", async () => {
  const s = script([
    () => ({
      content: JSON.stringify([
        { layer: "nasa", text: "FM2 burns a fabric at 99 psia.", citations: [{ doc_id: "nasa/ntrs-1/x.pdf", page: 3, quote: "FM2 plans four burns of one fabric at 99 psia with 37 percent oxygen" }] },
        { layer: "nasa", text: "FM2 plans four burns of one fabric.", citations: [{ doc_id: "nasa/ntrs-1/x.pdf", page: 3, quote: "FM2 plans four burns of one fabric at 8.2 psia" }] },
        { layer: "expert", text: "That chamber probably holds 14 litres, a guess." },
      ]),
    }),
  ]);
  const r = await runAgent({ ...s.env, chat: s.chat }, { message: "Tell me about FM2" });
  assert.equal(r.kept.filter((b) => b.layer === "nasa").length, 1, "the block with the fake quote is gone");
  assert.ok(!r.kept.some((b) => b.text.includes("99 psia")), "nothing of the dropped block is shown");
  assert.ok(r.report.dropped.length >= 1);
  const expert = r.kept.find((b) => b.layer === "expert");
  assert.ok(expert && expert.flagged && expert.text.includes("[number removed: not from a source]"));
});

test("the engine layer cannot restate a number the engine did not give", async () => {
  const s = script([
    () => ({ content: null, tool_calls: [call("1", "set_condition", { text: "21% oxygen at 14.7 psia in microgravity" }), call("2", "evaluate_condition", {})] }),
    (m) => ({ content: JSON.stringify([{ layer: "engine", text: "Exactly 77 investigations are applicable.", toolRefs: [toolOut(m, 1).ref] }]) }),
  ]);
  const r = await runAgent({ ...s.env, chat: s.chat }, { message: "21% at 14.7 psia" });
  assert.equal(r.kept.length, 0);
  assert.equal(r.report.dropped[0].reason, "number_not_in_engine_output");
});

test("UI-context question: describe_ui returns the page context and the help topic, and a highlight action is offered", async () => {
  const s = script([
    () => ({ content: null, tool_calls: [call("1", "describe_ui", { topic: "where the evidence is" }), call("2", "highlight", { element: "evidence_list" })] }),
    (m) => ({ content: JSON.stringify([{ layer: "expert", text: `That is the ${(toolOut(m, 0).topics as { title: string }[])[0].title} panel.` }]) }),
  ]);
  const r = await runAgent({ ...s.env, chat: s.chat }, { message: "what is that thing on the right?", ui: { route: "/", panels: ["strip", "evidence_list", "chart"] } });
  const first = toolOut(s.seen[1], 0) as { page: { route: string }; topics: { id: string; title: string }[] };
  assert.equal(first.page.route, "/");
  assert.ok(first.topics.some((t) => ["navigator-take-me-there", "evidence-panel", "navigator-overview"].includes(t.id)), JSON.stringify(first.topics.map((t) => t.id)));
  assert.deepEqual(r.actions, [{ type: "highlight", selector: ".nav-evidence", label: "Where the evidence is" }]);
});

test("follow-up: 'and at 25 %?' changes only the oxygen of the previous target", async () => {
  const prev: Target = { regime: { gravity_regime: "partial_gravity" }, continuous: { o2_mole_fraction: 0.34, pressure: 56.54 }, informational: { gravity_level: 0.165 } };
  const st = newState(prev);
  const out = await executeTool("set_condition", { text: "and at 25 %?", based_on_previous: true }, { records, investigations: [], library: null, topics, chat: async () => ({ content: "" }) }, st);
  assert.equal(out.error, undefined, JSON.stringify(out));
  assert.equal(st.target?.continuous.o2_mole_fraction, 0.25);
  assert.equal(st.target?.continuous.pressure, 56.54);
  assert.equal(st.target?.regime.gravity_regime, "partial_gravity");
  assert.equal(mergeTargets(prev, { regime: {}, continuous: { pressure: 100 } }).continuous.o2_mole_fraction, 0.34);
});

test("no more than six rounds: the last one has no tools and the agent still answers", async () => {
  let sawTools = 0;
  const s = script([() => ({ content: null, tool_calls: [call("x", "describe_ui", {})] })]);
  const chat = async (m: ChatMsg[], tools: unknown) => {
    if (tools) sawTools++;
    return tools ? { content: null, tool_calls: [call(String(sawTools), "describe_ui", {})] } : { content: JSON.stringify([{ layer: "expert", text: "Done." }]) };
  };
  const r = await runAgent({ ...s.env, chat }, { message: "loop" });
  assert.equal(sawTools, 5);
  assert.equal(r.rounds, 6);
  assert.equal(r.kept[0].text, "Done.");
});

test("what-if: a hypothetical test is labelled, changes the counts in memory only, and is never added to the records", async () => {
  const before = records.length;
  const st = newState({ regime: { gravity_regime: "partial_gravity" }, continuous: { o2_mole_fraction: 0.34, pressure: 56.54 } });
  const env = { records, investigations: [], library: null, topics, chat: async () => ({ content: "" }) };
  const out = (await executeTool("what_if_experiment", { label: "PMMA rod, lunar gravity", gravity_regime: "partial_gravity", fuel_phase: "solid", o2: "34 %", pressure: "8.2 psia" }, env, st)) as {
    hypothetical: boolean; label: string; before: Record<string, number>; after: Record<string, number>; error?: string;
  };
  assert.equal(out.error, undefined, JSON.stringify(out));
  assert.equal(out.hypothetical, true);
  assert.match(out.label, /^HYPOTHETICAL: .*Not a measurement; never saved/);
  assert.equal(out.before.APPLICABLE, 0, "PSI has no partial-gravity test");
  assert.ok(out.after.APPLICABLE > out.before.APPLICABLE, "the hypothetical test would make one investigation applicable");
  assert.ok(out.after.mapCellsWithApplicableEvidence > out.before.mapCellsWithApplicableEvidence, "the map would grow");
  assert.equal(records.length, before, "the records are untouched");
  assert.ok(Object.keys(st.engine).length === 1, "the result is an engine output the answer may cite");
});

import { isExplanatory, plainify } from "../lib/expert/agent.ts";

test("no verdict code or snake_case name reaches the reader, from any layer", async () => {
  assert.equal(plainify("PSI-26 is REGIME_BARRIER at 'partial_gravity' and o2_mole_fraction is 21 %"), "PSI-26 is not comparable (different regime) at 'partial gravity' and oxygen is 21 %");
  const s = script([
    () => ({ content: null, tool_calls: [call("1", "set_condition", { text: "21% oxygen at 14.7 psia in microgravity" }), call("2", "evaluate_condition", {})] }),
    (m) => ({
      content: JSON.stringify([
        { layer: "engine", text: "The engine reports 3 REGIME_BARRIER investigations for gravity_regime partial_gravity.", toolRefs: [toolOut(m, 1).ref] },
        { layer: "expert", text: "In INSUFFICIENT_EVIDENCE cases the fuel_phase is missing." },
      ]),
    }),
  ]);
  const r = await runAgent({ ...s.env, chat: s.chat }, { message: "21% at 14.7 psia" });
  assert.ok(r.kept.length >= 1);
  for (const b of r.kept) {
    assert.ok(!/\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b/.test(b.text), b.text);
    assert.ok(!/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/.test(b.text), b.text);
  }
  // the engine tool itself speaks plain words
  const ev = JSON.stringify(toolOut(s.seen[1], 1));
  assert.ok(!/APPLICABLE|REGIME_BARRIER|EXTRAPOLATION|INSUFFICIENT_EVIDENCE/.test(ev), "tool output carries plain verdict names");
});

test("an explanatory question must end with an expert block and a NASA quote: one repair round asks for what is missing", async () => {
  assert.ok(isExplanatory("What would happen if we burned PMMA on the Moon?"));
  assert.ok(isExplanatory("Why is the flame round in microgravity?"));
  assert.ok(!isExplanatory("What is 34% oxygen at 8.2 psia?"));
  const asks: string[] = [];
  const s = script([
    // first answer: engine facts only
    () => ({ content: null, tool_calls: [call("1", "run_calculator", { name: "o2PartialPressure", args: { o2: "34 %", pressure: "8.2 psia" } })] }),
    (m) => ({ content: JSON.stringify([{ layer: "engine", text: "The oxygen partial pressure is 19.22 kPa (2.788 psia).", toolRefs: [toolOut(m, 1).ref] }]) }),
    // after the repair request: the explanation and a verified quote
    (m) => {
      asks.push(String(m[m.length - 1].content));
      return {
        content: JSON.stringify([
          { layer: "nasa", text: "FM2 plans four burns of one fabric.", citations: [{ doc_id: "nasa/ntrs-1/x.pdf", page: 3, quote: "FM2 plans four burns of one fabric at 8.2 psia" }] },
          { layer: "expert", text: "With less total pressure but more oxygen, and no buoyancy to carry the flame away, the burn can behave differently from the same fuel on Earth." },
        ]),
      };
    },
  ]);
  const r = await runAgent({ ...s.env, chat: s.chat }, { message: "What would happen if we burned a PMMA sheet at 34% oxygen and 8.2 psia on the Moon?" });
  assert.match(asks[0], /no expert block/);
  assert.match(asks[0], /no nasa block/);
  assert.deepEqual(r.kept.map((b) => b.layer).sort(), ["expert", "nasa"]);
  assert.ok(s.seen[0].some((m) => m.role === "tool" && m.tool_call_id === "pre-search"), "the library was searched before the first model turn");
});

import { detectLang, languageInstruction, labelsFor } from "../lib/tars/lang.ts";

test("language: Spanish questions are detected by code, the model is told to answer in Spanish, labels follow", async () => {
  assert.equal(detectLang("¿Qué materiales arden más fácil a 34% de oxígeno y 8,2 psia en la Luna?"), "es");
  assert.equal(detectLang("Cuál es la presión parcial de oxígeno"), "es");
  assert.equal(detectLang("What is the oxygen partial pressure at 34% and 8.2 psia?"), "en");
  assert.equal(detectLang("PSI-26 BASS"), "en");
  assert.match(languageInstruction("es"), /Spanish/);
  assert.match(languageInstruction("es"), /verbatim/);
  assert.equal(languageInstruction("en"), "");
  assert.equal(labelsFor("es").nasa, "NASA lo dijo");
  const s = script([() => ({ content: JSON.stringify([{ layer: "expert", text: "Hola." }]) })]);
  const r = await runAgent({ ...s.env, chat: s.chat }, { message: "¿Por qué la llama es redonda sin gravedad?" });
  assert.equal(r.lang, "es");
  assert.match(String(s.seen[0][0].content), /Write every explanation in Spanish/);
});

test("the target is set whenever the message carries a complete condition, even if the model never calls set_condition", async () => {
  const s = script([() => ({ content: JSON.stringify([{ layer: "expert", text: "A short note." }]) })]);
  const r = await runAgent({ ...s.env, chat: s.chat }, { message: "What about 34% oxygen at 8.2 psia in microgravity?" });
  assert.ok(r.target);
  assert.equal(r.target?.continuous.o2_mole_fraction, 0.34);
});
