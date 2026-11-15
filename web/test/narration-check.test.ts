import assert from "node:assert/strict";
import { test } from "node:test";
import { modelText } from "../lib/narration-check.ts";
import { statesGravity, PARTIAL_PRESSURE_MESSAGE, PlainError, buildNarrationInput, isOxygenPartialPressure, parseTargetReply, questionHasOxygenPartialPressure, shapeTarget, supportedByQuestion } from "../lib/ask-core.ts";
import { evaluate, targetFromQuantities } from "../../engine/src/index.ts";

const Q = "Would solid fuel burn differently in a lunar base at 30% oxygen and 10.2 psi?";
const reply = (o: Record<string, unknown>) => JSON.stringify({ gravity: null, o2: null, pressure: null, flow_velocity: null, sample_thickness: null, ambient_temperature: null, gravity_regime: null, fuel_phase: null, diluent: null, flame_type: null, assumptions: [], ...o });

test("the target reply is converted by the engine; the model's text is read as written", () => {
  const ok = parseTargetReply(reply({ gravity: "lunar", o2: "30%", pressure: "10.2 psi", assumptions: ["lunar read as the Moon"] }), Q);
  assert.equal(ok.target.regime.gravity_regime, "partial_gravity");
  assert.ok(Math.abs((ok.target.continuous.pressure ?? 0) - 70.3) < 0.1);
  assert.ok(Math.abs((ok.target.continuous.o2_mole_fraction ?? 0) - 0.3) < 1e-9);
  assert.match(ok.conversions.join(" | "), /psi/);
  assert.ok(ok.unstated.includes("flame_type"));
  assert.throws(() => parseTargetReply(reply({ pressure: "10 psig" }), "at 10 psig"), /pressure/);
  assert.throws(() => parseTargetReply(reply({ pressure: 56.5 }), Q), /text as written/);
  assert.throws(() => parseTargetReply(reply({ gravity_regime: "zero" }), Q));
  assert.throws(() => parseTargetReply("sorry, I cannot", Q), /JSON/);
  assert.equal(parseTargetReply("<think>x</think>```json\n" + reply({ o2: "30%" }) + "\n```", Q).target.continuous.o2_mole_fraction, 0.3);
});

test("copy as written: a pressure the question never gave is dropped; a converted value is rejected", () => {
  const lunar = parseTargetReply(reply({ gravity: "lunar", o2: "30%", pressure: "101.3 kPa" }), "What burns in a lunar base at 30% oxygen?");
  assert.equal(lunar.target.continuous.pressure, undefined);
  assert.ok(lunar.unstated.includes("pressure"));
  assert.match(lunar.warnings.join(" "), /not in the question/);
  const converted = parseTargetReply(reply({ pressure: "56.5 kPa", o2: "21 %" }), "A cabin at 8.2 psia and 21 % oxygen");
  assert.equal(converted.target.continuous.pressure, undefined);
  assert.match(converted.warnings.join(" "), /56\.5 kPa/);
  assert.equal(supportedByQuestion("8.2 psia", "A cabin at 8.2 psia"), true);
  assert.equal(supportedByQuestion("Moon", "a lunar base"), false);
  assert.equal(supportedByQuestion("1/6 g", "gravity of 1/6 g"), true);
});

test("assumptions: long ones, banned phrases and numbers the question lacks are dropped", () => {
  const out = parseTargetReply(reply({ o2: "30%", assumptions: ["x".repeat(151), "this is a world's first result", "assumed 21 percent air", "balance gas not named"] }), Q);
  assert.deepEqual(out.assumptions, ["balance gas not named"]);
});

test("a regime axis the question does not state is a suggestion, never part of the target", () => {
  const rod = parseTargetReply(reply({ o2: "30%", fuel_phase: "solid" }), "A PMMA rod at 30% oxygen");
  assert.equal(rod.target.regime.fuel_phase, undefined);
  assert.deepEqual(rod.suggestions.map((x) => [x.axis, x.value]), [["fuel_phase", "solid"]]);
  assert.ok(rod.unstated.includes("fuel_phase"));
  const stated = parseTargetReply(reply({ o2: "30%", fuel_phase: "solid" }), "A solid fuel at 30% oxygen");
  assert.equal(stated.target.regime.fuel_phase, "solid");
  assert.deepEqual(stated.suggestions, []);
});

test("the two candle questions give identical targets whatever the model infers", () => {
  const a = parseTargetReply(reply({ gravity: "0 g", o2: "21%", pressure: "1 atm", fuel_phase: "solid" }), "A candle at 0 g, 21% oxygen and 1 atm");
  const b = parseTargetReply(reply({ gravity: "microgravity", o2: "21%", pressure: "1 atm", fuel_phase: "liquid", flame_type: "normal", gravity_regime: "microgravity" }), "A candle in microgravity at 21% oxygen and 1 atm");
  // what the engine compares is identical (the stated 0 g is only shown, as informational)
  assert.deepEqual({ regime: a.target.regime, continuous: a.target.continuous }, { regime: b.target.regime, continuous: b.target.continuous });
  assert.equal(a.target.regime.fuel_phase, undefined);
  assert.equal(b.target.regime.flame_type, undefined);
  assert.equal(a.target.regime.gravity_regime, "microgravity");
  assert.equal(b.suggestions.length, 2);
  // a model that names no axis at all gives the same target again
  assert.deepEqual(a.target, parseTargetReply(reply({ gravity: "0 g", o2: "21%", pressure: "1 atm" }), "A candle at 0 g, 21% oxygen and 1 atm").target);
});

test("a gravity regime the question does not state is a suggestion too", () => {
  const r = parseTargetReply(reply({ o2: "21%", gravity_regime: "microgravity" }), "A candle at 21% oxygen");
  assert.equal(r.target.regime.gravity_regime, undefined);
  assert.equal(r.suggestions[0].axis, "gravity_regime");
});

test("an oxygen partial pressure in the question is refused before any model is called, in plain words", () => {
  for (const q of ["A cabin with an oxygen partial pressure of 21 kPa", "PMMA at 21 kPa O2", "ppO2 21 kPa in the habitat", "pO2 of 21 kPa"]) assert.equal(questionHasOxygenPartialPressure(q), true, q);
  assert.equal(questionHasOxygenPartialPressure("ppO2 21 kPa, total 70 kPa"), false);
  assert.equal(questionHasOxygenPartialPressure("A cabin at 8.2 psia and 34% oxygen"), false);
  assert.match(PARTIAL_PRESSURE_MESSAGE, /^Oxygen partial pressure is not total pressure/);
  assert.throws(() => parseTargetReply(reply({ pressure: "21 kPa" }), "PMMA at 21 kPa O2"), (e: Error) => e instanceof PlainError && !e.message.includes("model text"));
});

test("N3: the model's unit must be the one the question wrote, and a number feeds only one quantity", () => {
  const kpa = parseTargetReply(reply({ pressure: "8.2 psia", o2: "21 %" }), "A cabin at 8.2 kPa and 21 % oxygen");
  assert.equal(kpa.target.continuous.pressure, undefined);
  assert.match(kpa.warnings.join(" "), /not in the question/);
  const o2 = parseTargetReply(reply({ o2: "21 %", pressure: "21 psia" }), "Air with 21% O2");
  assert.equal(o2.target.continuous.o2_mole_fraction, 0.21);
  assert.equal(o2.target.continuous.pressure, undefined);
  assert.equal(parseTargetReply(reply({ pressure: "8.2 psia" }), "A cabin at 8.2 psia").target.continuous.pressure !== undefined, true);
  assert.equal(parseTargetReply(reply({ pressure: "8.2 psi" }), "A cabin at 8.2 psia").target.continuous.pressure !== undefined, true);
  assert.equal(supportedByQuestion("1/6 g", "gravity of 1/6 g"), true);
});

test("N6: model text in the dropped-value warning is short and labelled", () => {
  const w = parseTargetReply(reply({ pressure: "9".repeat(300) + " kPa", o2: "21 %" }), "A cabin with 21 % oxygen").warnings.join(" ");
  assert.match(w, /model text \(not used\)/);
  assert.ok(w.length < 300);
});

test("quoted model text is short and labelled", () => {
  const t = modelText("x".repeat(200));
  assert.match(t, /model text \(not used\)/);
  assert.ok(t.length < 130);
});

test("B: an oxygen partial pressure is never the total pressure", () => {
  for (const q of ["Oxygen partial pressure of 21 kPa in a cabin", "ppO2 21 kPa, total 70 kPa", "PMMA at 21 kPa O2", "pO2 of 21 kPa"]) {
    assert.throws(() => parseTargetReply(reply({ pressure: "21 kPa" }), q), /partial pressure is not total pressure/, q);
  }
  // the total pressure given beside a partial pressure is still usable
  assert.equal(parseTargetReply(reply({ pressure: "70 kPa" }), "ppO2 21 kPa, total 70 kPa").target.continuous.pressure, 70);
  assert.equal(isOxygenPartialPressure("8.2 psia", "A cabin at 8.2 psia and 34% oxygen"), false);
});

test("m7: the unit must match exactly, including no unit", () => {
  assert.throws(() => parseTargetReply(reply({ o2: "2" }), "A 2 mm PMMA rod in 21 % oxygen"), /No combustion condition/); // "2" is dropped, nothing else stated
  const o = parseTargetReply(reply({ o2: "2", pressure: "1 atm" }), "A 2 mm PMMA rod in 21 % oxygen at 1 atm");
  assert.equal(o.target.continuous.o2_mole_fraction, undefined);
  assert.match(o.warnings.join(" "), /not in the question/);
});

test("gravity level is informational in the target: parse, shape and narration input read it from there", () => {
  const lunar = parseTargetReply(reply({ gravity: "lunar", o2: "30%" }), "a lunar base at 30% oxygen");
  assert.equal(lunar.target.informational?.gravity_level, 0.165);
  assert.equal(lunar.target.continuous.gravity_level, undefined);
  // narrate accepts the informational block and still rejects unknown fields
  assert.equal(shapeTarget(lunar.target).ok, true);
  assert.equal(shapeTarget({ ...lunar.target, extra: 1 }).ok, false);
  assert.equal(shapeTarget({ regime: {}, continuous: {}, informational: { gravity_level: 0.165, other: 1 } }).ok, false);
  assert.equal(shapeTarget({ regime: {}, continuous: {}, informational: { gravity_level: "x" } }).ok, false);
  // the number is still available to the context from the informational block
  const t = targetFromQuantities({ gravity: "lunar", o2: "30 %" });
  if (!t.ok) throw new Error("target");
  const { input } = buildNarrationInput(evaluate([], t.target), [], t.target);
  assert.equal(input.target.gravity_level_g, 0.165);
  // above the normal band the engine's note travels with the target
  const high = targetFromQuantities({ gravity: "2 g" });
  if (!high.ok) throw new Error("target");
  assert.ok(high.target.informational?.gravity_not_covered);
  assert.equal(shapeTarget(high.target).ok, true);
});

test("A2: words that state a gravity count as stating it (Earth, 1 g, free fall, Spanish)", () => {
  for (const q of ["Flames on Earth at 34% oxygen and 1 atm", "A fire at 1 g", "ground-based test at normal gravity", "in free fall", "Luna", "en microgravedad", "caída libre", "gravedad cero", "en la Tierra", "weightless", "in orbit", "on Mars"]) {
    assert.equal(statesGravity(q), true, q);
  }
  for (const q of ["A candle at 21% oxygen", "34% oxygen and 8.2 psia", "10 g of PMMA"]) assert.equal(statesGravity(q), false, q);
  // a gravity regime the model returns is stated when the question says it with these words: it enters the target
  const earth = parseTargetReply(reply({ o2: "34%", pressure: "1 atm", gravity_regime: "normal_gravity" }), "Flames on Earth at 34% oxygen and 1 atm");
  assert.equal(earth.target.regime.gravity_regime, "normal_gravity");
  assert.deepEqual(earth.suggestions, []);
  const luna = parseTargetReply(reply({ o2: "34%", gravity_regime: "partial_gravity" }), "¿Qué arde más a 34% de oxígeno en la Luna?");
  assert.equal(luna.target.regime.gravity_regime, "partial_gravity");
  const orbit = parseTargetReply(reply({ o2: "21%", gravity_regime: "microgravity" }), "A flame in free fall at 21% oxygen");
  assert.equal(orbit.target.regime.gravity_regime, "microgravity");
});

test("A3: a question that states nothing about a condition gives no target", () => {
  assert.throws(() => parseTargetReply(reply({}), "What is the capital of France?"), (e: Error) => e instanceof PlainError && /No combustion condition found in the question/.test(e.message));
  // only a suggestion is not enough either
  assert.throws(() => parseTargetReply(reply({ fuel_phase: "solid" }), "A candle"), /No combustion condition/);
  assert.equal(parseTargetReply(reply({ o2: "21%" }), "air at 21% oxygen").target.continuous.o2_mole_fraction, 0.21);
});

test("A4: the parse prompt asks to copy quantities as written in any language and never to translate", async () => {
  const { PARSE_SYSTEM } = await import("../lib/prompts.ts");
  assert.match(PARSE_SYSTEM, /any language/);
  assert.match(PARSE_SYSTEM, /8,2 psia/);
  assert.match(PARSE_SYSTEM, /Never translate/);
  // a decimal comma is copied as written and still counts as in the question
  const es = parseTargetReply(reply({ pressure: "8,2 psia", o2: "34 %" }), "¿Qué arde a 34 % de oxígeno y 8,2 psia en la Luna?");
  assert.ok(es.warnings.every((w) => !/not in the question/.test(w)));
});

test("deterministic first: the code reads plain questions with no model, repeatably; issues and free-form go elsewhere", async () => {
  const { readByCode } = await import("../lib/ask-core.ts");
  const q = "Would solid fuel burn differently in a lunar base at 30% oxygen and 10.2 psi?";
  const a = readByCode(q);
  assert.equal(a.kind, "code");
  if (a.kind !== "code") return;
  assert.ok(Math.abs((a.parsed.target.continuous.pressure ?? 0) - 70.33) < 0.05);
  assert.equal(a.parsed.target.continuous.o2_mole_fraction, 0.3);
  assert.deepEqual(a.parsed.suggestions, []);
  for (let i = 0; i < 5; i++) assert.deepEqual(readByCode(q), a); // identical on every call
  // an issue is answered in plain words, no model
  const gauge = readByCode("A cabin at 10 psig and 21 % oxygen");
  assert.equal(gauge.kind, "issue");
  assert.equal(readByCode("An oxygen partial pressure of 21 kPa").kind, "issue");
  // free-form with numbers it cannot assign goes to the model
  assert.equal(readByCode("how does a lunar base with a third of air's oxygen and 2 hours of burn behave").kind, "model");
  assert.equal(readByCode("What is the capital of France?").kind, "model");
});

test("when the model and the extractor both give a quantity and differ, the extractor wins with a warning", () => {
  const r = parseTargetReply(reply({ o2: "21 %", pressure: "101 kPa" }), "air at 21% oxygen and 1 atm", { o2: "21%", pressure: "1 atm" });
  assert.equal(Math.round(r.target.continuous.pressure ?? 0), 101);
  assert.match(r.warnings.join(" "), /differently from the code|not in the question/);
});
