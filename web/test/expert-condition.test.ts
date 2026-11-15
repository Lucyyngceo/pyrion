import assert from "node:assert/strict";
import { test } from "node:test";
import { conditionFromMessage, ensureTarget, isCompleteTarget, mergeTargets } from "../lib/expert/condition.ts";

const moon = { regime: { gravity_regime: "partial_gravity" }, continuous: { o2_mole_fraction: 0.34, pressure: 56.5370074 }, informational: { gravity_level: 0.165 } } as const;
const close = (a: number | undefined, b: number, tol = 1e-6) => assert.ok(a !== undefined && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} vs ${b}`);

test("a full condition in a message is read by code and converted by the engine's table", () => {
  const r = conditionFromMessage("34 % O₂ at 8.2 psia on the Moon");
  assert.equal(r.source, "question");
  close(r.target?.continuous.o2_mole_fraction, 0.34);
  close(r.target?.continuous.pressure, 8.2 * 6.894757, 1e-9);
  assert.equal(r.target?.regime.gravity_regime, "partial_gravity");
  assert.equal(r.target?.informational?.gravity_level, 0.165);
  assert.ok(r.conversions.includes("8.2 psia → 56.54 kPa (×6.894757)"));
  assert.deepEqual([...r.stated].sort(), ["gravity", "o2", "pressure"]);
});

test("Spanish, decimal comma, and an ISS question", () => {
  close(conditionFromMessage("34 % de oxígeno a 8,2 psia en la Luna").target?.continuous.pressure, 56.537, 1e-4);
  const iss = conditionFromMessage("A flame on the ISS at 21 % oxygen and 1 atm").target;
  assert.equal(iss?.regime.gravity_regime, "microgravity");
  close(iss?.continuous.pressure, 101.325, 1e-9);
  assert.ok(isCompleteTarget(iss!));
});

test("a follow-up changes only the stated axis: 'and at 25 %?' keeps pressure and gravity", () => {
  const r = conditionFromMessage("and at 25 %?", { lastTarget: moon as never });
  assert.equal(r.source, "follow_up");
  close(r.target?.continuous.o2_mole_fraction, 0.25);
  close(r.target?.continuous.pressure, 56.5370074);
  assert.deepEqual(r.target?.regime, moon.regime);
  assert.equal(r.target?.informational?.gravity_level, 0.165);
  const es = conditionFromMessage("¿y al 25 %?", { lastTarget: moon as never });
  close(es.target?.continuous.o2_mole_fraction, 0.25);
  assert.equal(es.source, "follow_up");
});

test("a follow-up that changes the gravity regime drops the stale gravity level", () => {
  const r = conditionFromMessage("and in microgravity?", { lastTarget: moon as never });
  assert.equal(r.target?.regime.gravity_regime, "microgravity");
  assert.equal(r.target?.informational?.gravity_level, undefined);
  close(r.target?.continuous.o2_mole_fraction, 0.34);
  const merged = mergeTargets(moon as never, { regime: { gravity_regime: "partial_gravity" }, continuous: {}, informational: { gravity_level: 0.38 } });
  assert.equal(merged.informational?.gravity_level, 0.38);
});

test("a message with no condition keeps the previous target, or has none", () => {
  const p = conditionFromMessage("What experiment would close the gap?", { lastTarget: moon as never });
  assert.equal(p.source, "previous");
  assert.deepEqual(p.target, moon);
  const n = conditionFromMessage("What is MOC in NASA-STD-6001?");
  assert.equal(n.source, "none");
  assert.equal(n.target, null);
});

test("errors are issues, never a guess: gauge pressure and impossible values give no target", () => {
  const g = conditionFromMessage("34 % O2 at 8.2 psig on the Moon");
  assert.equal(g.target, null);
  assert.match(g.issues.join(" "), /gauge pressure/);
  const bad = conditionFromMessage("A flame at 200% oxygen and -5 atm in microgravity", { lastTarget: moon as never });
  assert.equal(bad.target, null, "it does not fall back to the previous target when the new condition is wrong");
  assert.ok(bad.issues.length >= 2);
});

test("a partial pressure is not used as the total pressure", () => {
  const r = conditionFromMessage("A cabin with a ppO2 of 21 kPa");
  assert.equal(r.target, null);
  assert.match(r.issues.join(" "), /partial pressure/);
  assert.deepEqual(r.leftover, ["21 kPa"]);
});

test("ensureTarget sets the agent's state so result.target is never null after a condition", () => {
  const state = { target: null as ReturnType<typeof conditionFromMessage>["target"] };
  ensureTarget(state, "30 % oxygen at 10.2 psia in microgravity");
  assert.equal(state.target?.regime.gravity_regime, "microgravity");
  ensureTarget(state, "and at 25 %?");
  close(state.target?.continuous.o2_mole_fraction, 0.25);
  close(state.target?.continuous.pressure, 10.2 * 6.894757, 1e-9);
  ensureTarget(state, "Why do flames spread differently?");
  close(state.target?.continuous.o2_mole_fraction, 0.25);
});
