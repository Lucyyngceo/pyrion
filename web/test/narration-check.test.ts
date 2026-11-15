import assert from "node:assert/strict";
import { test } from "node:test";
import { modelText } from "../lib/narration-check.ts";
import { isOxygenPartialPressure, parseTargetReply, supportedByQuestion } from "../lib/ask-core.ts";

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
  const converted = parseTargetReply(reply({ pressure: "56.5 kPa" }), "A cabin at 8.2 psia");
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

test("a regime axis the model filled in without the question stating it is listed as an assumption", () => {
  const withRod = parseTargetReply(reply({ o2: "30%", fuel_phase: "solid" }), "A PMMA rod at 30% oxygen");
  assert.match(withRod.assumptions.join(" "), /fuel phase "solid" was inferred/);
  const stated = parseTargetReply(reply({ o2: "30%", fuel_phase: "solid" }), "A solid fuel at 30% oxygen");
  assert.ok(!stated.assumptions.join(" ").includes("inferred"));
  const lunar = parseTargetReply(reply({ gravity: "lunar", gravity_regime: "partial_gravity" }), "a lunar base");
  assert.ok(!lunar.assumptions.join(" ").includes("gravity regime"));
});

test("N3: the model's unit must be the one the question wrote, and a number feeds only one quantity", () => {
  const kpa = parseTargetReply(reply({ pressure: "8.2 psia" }), "A cabin at 8.2 kPa");
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
  const w = parseTargetReply(reply({ pressure: "9".repeat(300) + " kPa" }), "A cabin").warnings.join(" ");
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
  const o = parseTargetReply(reply({ o2: "2" }), "A 2 mm PMMA rod in 21 % oxygen");
  assert.equal(o.target.continuous.o2_mole_fraction, undefined);
  assert.match(o.warnings.join(" "), /not in the question/);
});
