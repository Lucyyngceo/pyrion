import assert from "node:assert/strict";
import { test } from "node:test";
import { checkContext, sentenceProblem, type ContextTarget } from "../lib/context-check.ts";

// The lunar target of the audit: partial gravity, 34 % O2, 8.2 psia (56.54 kPa), 0.165 g; three axes left open.
const lunar: ContextTarget = {
  regime: { gravity_regime: "partial_gravity" },
  o2_percent: 34,
  pressure_kpa: 56.54,
  pressure_psia: 8.2,
  gravity_level_g: 0.165,
  open_axes: ["fuel_phase", "diluent", "flame_type"],
};

/** Sentences the audit used to attack the old blacklist check: every one of them must be rejected. */
const ATTACKS: string[] = [
  "Higher oxygen makes flames spread slower, so 34 % oxygen at 8.2 psia reduces fire risk.",
  "Lowering pressure to 8.2 psia makes materials less flammable regardless of oxygen.",
  "Microgravity flames are always smaller and cooler than flames at 0.165 g.",
  "Flames at 0.165 g behave like flames on Earth.",
  "Lunar gravity is the least flammable condition for any material.",
  "The oxygen partial pressure is 34 kPa.",
  "The oxygen level is 56.54 kPa.",
  "The oxygen concentration is 8.2 psia at 0.165 g.",
  "The pressure is 34 here.",
  "The gravity level of 0.34 is partial.",
  "The total pressure is 0.165 g.",
  "PSI-26 (doi:10.60555/vb93-3y72) studied this oxygen range.",
  "PSI-26 and PSI-39 have doi 10.60555/vb93-3y72.",
  "Results from the BASS experiment and the Spacecraft Fire Experiment suggest similar behaviour.",
  "Apollo 1 burned in pure oxygen at higher pressure.",
  "The CIR and MDCA hardware on the ISS ran similar flames.",
  "The Skylab and Mir fires are relevant here.",
  "This condition was tested on the Space Shuttle in the Glovebox.",
  "NASA confirms that this atmosphere is acceptable for crews.",
  "The 8.2 psia, 34 % O2 atmosphere is the NESC Exploration Atmosphere and is approved for use.",
  "Fire risk doubles at 34 % oxygen.",
  "Flame spread is twice as fast at 34 % oxygen as at 21 % oxygen.",
  "Flammability peaks near 0.165 g.",
  "The fuel phase, diluent and flame type were left out, which makes this condition nonflammable.",
  "This atmosphere is low-risk for flame spread.",
  "At 34 % oxygen materials will certainly ignite.",
  "The target sits at 3 times the oxygen of air.",
  "The flame would extinguish at 0.165 g.",
  "PSI-106 shows the target is outside what was measured, so flames will be larger.",
  "PSI-26 proves flames spread faster at 0.165 g.",
  "PSI-10 demonstrates that the lunar habitat is protected.",
  "The oxygen fraction of 0.34 is far above Earth's 21 %.",
  "PSI-26 and PSI-106 share doi 10.60555/pm12-rg61.",
  "PSI-26 (SLICE, doi:10.60555/pm12-rg61) left fuel phase open.",
  "SLICE is the BASS investigation, PSI-39.",
  "PSI-106 is about droplet combustion of methanol.",
  "The target sits at 34 % oxygen, which ACME and FLEX also used.",
  "Saffire-IV and the Spacecraft Fire Safety Demonstration ran at similar oxygen.",
  "FM2 on the lunar surface will test this.",
  "The Flammability of Materials on the Moon experiment will test this."
];

test(`all ${ATTACKS.length} attack sentences are rejected`, () => {
  for (const s of ATTACKS) assert.notEqual(sentenceProblem(s, lunar), null, `survived: ${s}`);
});

test("sentences that only restate the target survive", () => {
  for (const s of [
    "The target is a partial gravity condition at 34 % oxygen and 8.2 psia.",
    "Oxygen is 34 % and pressure is 8.2 psia; the fuel phase, diluent and flame type were left open.",
    "Gravity is 0.165 g, in the partial gravity regime.",
    "The target is a partial_gravity condition at 34 % oxygen and 56.54 kPa.",
  ]) assert.equal(sentenceProblem(s, lunar), null, s);
});

test("a number must be a target value, with the unit of the quantity named beside it", () => {
  assert.notEqual(sentenceProblem("Oxygen is 35 %.", lunar), null);
  assert.notEqual(sentenceProblem("Oxygen is 8.2 psia.", lunar), null);
  assert.notEqual(sentenceProblem("The total pressure is 0.165 g.", lunar), null);
  assert.notEqual(sentenceProblem("The oxygen level is 56.54 kPa.", lunar), null);
  assert.notEqual(sentenceProblem("The pressure is 34 here.", lunar), null);
  assert.notEqual(sentenceProblem("The oxygen partial pressure is 56.54 kPa.", lunar), null);
  assert.equal(sentenceProblem("Pressure is 8.2 psia.", lunar), null);
});

test("an axis may be called open only if the target leaves it open", () => {
  const solid: ContextTarget = { ...lunar, regime: { gravity_regime: "partial_gravity", fuel_phase: "solid" }, open_axes: ["diluent", "flame_type"] };
  assert.notEqual(sentenceProblem("The fuel phase was left open.", solid), null);
  assert.equal(sentenceProblem("The diluent and flame type were left open.", solid), null);
  assert.equal(sentenceProblem("The fuel phase is solid.", solid), null);
  assert.notEqual(sentenceProblem("The fuel phase is solid.", lunar), null);
});

test("failing sentences are dropped one by one; nothing surviving gives null; model text is never returned", () => {
  const mixed = "Gravity is 0.165 g, in the partial gravity regime. PSI-26 proves flames spread faster. Oxygen is 34 %.";
  const r = checkContext(mixed, lunar);
  assert.equal(r.kept, "Gravity is 0.165 g, in the partial gravity regime. Oxygen is 34 %.");
  assert.equal(r.dropped, 1);
  const none = checkContext("NASA confirms that this atmosphere is acceptable for crews.", lunar);
  assert.equal(none.kept, null);
  assert.equal(none.dropped, 1);
});

test("the context is capped at 60 words", () => {
  const long = Array(30).fill("Oxygen is 34 %.").join(" ");
  const r = checkContext(long, lunar);
  assert.ok((r.kept ?? "").split(/\s+/).length <= 60);
});
