import assert from "node:assert/strict";
import { test } from "node:test";
import { checkNarration, numbersIn } from "../lib/narration-check.ts";
import { parseTargetReply } from "../lib/ask-core.ts";

const facts = {
  ids: ["PSI-69", "PSI-25"],
  dois: ["10.60555/mbq8-0451"],
  source: JSON.stringify({ target: { o2_percent: 21, pressure_kpa: 101.3, pressure_psia: 14.7 }, counts: { APPLICABLE: 1, REGIME_BARRIER: 17 }, top: [{ distance: 0.132 }] }),
};

test("a faithful narration passes", () => {
  const r = checkNarration("At 21 % O2 and 101.3 kPa (14.7 psia), 1 investigation is applicable and 17 are not comparable. PSI-69 (doi 10.60555/mbq8-0451) is the nearest.", facts);
  assert.deepEqual(r.failures, []);
  assert.equal(r.ok, true);
});

test("a number that is not in the output fails", () => {
  const r = checkNarration("At 30 % O2, 1 investigation is applicable.", facts);
  assert.equal(r.ok, false);
  assert.match(r.failures.join(" "), /number 30/);
});

test("a rounded number written with fewer decimals matches; a wrong rounding does not", () => {
  assert.equal(checkNarration("The distance is 0.13.", facts).ok, true);
  assert.equal(checkNarration("The distance is 0.14.", facts).ok, false);
});

test("an investigation id or DOI that is not in the output fails", () => {
  assert.match(checkNarration("PSI-70 is applicable.", facts).failures.join(" "), /PSI-70/);
  assert.match(checkNarration("See 10.60555/zzzz-0000.", facts).failures.join(" "), /DOI/);
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

test("the target reply is validated: nulls stay unstated, bad values are rejected", () => {
  const ok = parseTargetReply('```json\n{"regime":{"gravity_regime":"partial_gravity","fuel_phase":null,"diluent":null,"flame_type":null},"continuous":{"o2_mole_fraction":0.3,"pressure_kpa":70.3,"gravity_level_g":0.165},"assumptions":["lunar gravity read as 0.165 g"]}\n```');
  assert.equal(ok.target.regime.gravity_regime, "partial_gravity");
  assert.equal(ok.target.regime.fuel_phase, undefined);
  assert.equal(ok.target.continuous.pressure, 70.3);
  assert.deepEqual(ok.unstated.sort(), ["diluent", "flame_type", "fuel_phase"]);
  assert.throws(() => parseTargetReply('{"regime":{"gravity_regime":"zero"},"continuous":{}}'), /not an allowed value/);
  assert.throws(() => parseTargetReply('{"regime":{},"continuous":{"o2_mole_fraction":30}}'));
  assert.throws(() => parseTargetReply("sorry, I cannot"), /JSON/);
});
