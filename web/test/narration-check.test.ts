import assert from "node:assert/strict";
import { test } from "node:test";
import { checkNarration, numbersIn, type Facts } from "../lib/narration-check.ts";
import { parseTargetReply, supportedByQuestion } from "../lib/ask-core.ts";

const facts: Facts = {
  top: [
    { accession: "PSI-69", acronym: "FLEX", doi: "10.60555/mbq8-0451", verdict: "EXTRAPOLATION" },
    { accession: "PSI-25", acronym: "BASS-II", doi: "10.60555/4qc4-de67", verdict: "REGIME_BARRIER" },
  ],
  all: [
    { accession: "PSI-69", acronym: "FLEX", title: "Flame Extinguishment Experiment" },
    { accession: "PSI-25", acronym: "BASS-II", title: "Burning and Suppression of Solids - II" },
    { accession: "PSI-98", acronym: "SAFFIRE-I", title: "Spacecraft Fire Safety Experiment-I" },
  ],
  numbers: [
    { value: 21, cls: "%" },
    { value: 101.3, cls: "kPa" },
    { value: 14.7, cls: "psia" },
    { value: 1, cls: "count" },
    { value: 17, cls: "count" },
    { value: 0.132, cls: "" },
  ],
  source: "FLEX BASS-II 21 101.3 14.7",
};

test("a faithful narration passes", () => {
  const r = checkNarration("At 21 % O2 and 101.3 kPa (14.7 psia), 1 investigation was found. PSI-69 (doi 10.60555/mbq8-0451) is an extrapolation.", facts);
  assert.deepEqual(r.failures, []);
});

test("integers must match exactly; decimals may be a rounding", () => {
  assert.equal(checkNarration("The distance is 0.13.", facts).ok, true);
  assert.equal(checkNarration("The distance is 0.14.", facts).ok, false);
  assert.match(checkNarration("There are 18 investigations.", facts).failures.join(" "), /18/);
  assert.equal(checkNarration("There are 17 investigations.", facts).ok, true);
});

test("the unit word must match the fact: 14.7 kPa and 21 psia fail, a swapped count fails", () => {
  assert.match(checkNarration("The pressure is 14.7 kPa.", facts).failures.join(" "), /wrong unit/);
  assert.match(checkNarration("Oxygen is 21 psia.", facts).failures.join(" "), /wrong unit/);
  assert.match(checkNarration("The pressure is 101 kPa.", facts).failures.join(" "), /not in the engine output/);
});

test("a verdict word beside an id must be that id's verdict", () => {
  assert.match(checkNarration("PSI-69 is applicable.", facts).failures.join(" "), /PSI-69 is EXTRAPOLATION/);
  assert.equal(checkNarration("PSI-69 needs extrapolation.", facts).ok, true);
  assert.match(checkNarration("PSI-25 is not applicable here.", facts).failures.join(" "), /not applicable/);
  assert.match(checkNarration("PSI-25 shows insufficient evidence.", facts).failures.join(" "), /PSI-25/);
});

test("a DOI must be the one paired with the id in its sentence", () => {
  assert.match(checkNarration("PSI-69 has doi 10.60555/4qc4-de67.", facts).failures.join(" "), /belongs to PSI-25/);
  assert.match(checkNarration("See doi 10.60555/mbq8-0451.", facts).failures.join(" "), /without the investigation/);
  assert.match(checkNarration("PSI-69 has doi 10.60555/zzzz-0000.", facts).failures.join(" "), /not in the engine output/);
});

test("ids and acronyms of investigations that are not in the output are rejected, so are non-PSI names", () => {
  assert.match(checkNarration("PSI-70 is relevant.", facts).failures.join(" "), /PSI-70/);
  assert.match(checkNarration("SAFFIRE-I burned a large fabric.", facts).failures.join(" "), /SAFFIRE-I/);
  assert.match(checkNarration("The LUCI experiment is related.", facts).failures.join(" "), /LUCI/);
  assert.match(checkNarration("Compare with Spacecraft Fire Safety Experiment results.", facts).failures.join(" "), /PSI-98/);
  assert.equal(checkNarration("Read this as FLEX context.", facts).ok, true);
});

test("spelled-out numbers are rejected", () => {
  assert.match(checkNarration("Seventeen investigations are listed.", facts).failures.join(" "), /spelled-out/);
});

test("digits of ids and DOIs are not read as quantities", () => {
  assert.deepEqual(numbersIn("PSI-69 doi 10.60555/mbq8-0451 has 3 tests").map((n) => n.value), [3]);
});

test("banned phrases fail", () => {
  assert.match(checkNarration("This is a world's first result, validated by NASA.", facts).failures.join(" "), /banned/);
});

test("more than 120 words fails", () => {
  assert.match(checkNarration(Array(130).fill("word").join(" "), facts).failures.join(" "), /too long/);
});

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
