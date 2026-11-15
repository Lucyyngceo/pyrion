import assert from "node:assert/strict";
import { test } from "node:test";
import { CALCULATOR_SPECS, CALCULATORS, compareAtmospheres, convertPressure, convertTemperature, gravityValue, o2PartialPressure, runCalculator, type ToolOk } from "../lib/expert/calculators.ts";

const ok = (r: ReturnType<typeof o2PartialPressure>): ToolOk => {
  assert.ok(r.ok, JSON.stringify(r));
  return r;
};
const close = (a: number | null, b: number, tol = 1e-9) => assert.ok(a !== null && Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("oxygen partial pressure: the two numbers the models got wrong", () => {
  const a = ok(o2PartialPressure("34 %", "8.2 psia"));
  close(a.also.pO2_psia.value, 0.34 * 8.2, 1e-9); // 2.788 psia, not 2.79 from a model's guess at the wrong formula
  close(a.value, 0.34 * 8.2 * 6.894757, 1e-9);
  assert.equal(a.unit, "kPa");
  assert.match(a.display, /^Oxygen partial pressure = 34 % x 56\.54 kPa \(8\.2 psia\) = 19\.22 kPa \(2\.788 psia\)\.$/);
  const b = ok(o2PartialPressure("21 %", "14.7 psia"));
  close(b.also.pO2_psia.value, 0.21 * 14.7, 1e-9);
  assert.match(b.display, /= 21\.28 kPa \(3\.087 psia\)\.$/);
});

test("every result says it was computed by code and lists the numbers a sentence may quote", () => {
  const r = ok(o2PartialPressure(0.3, { value: 10.2, unit: "psia" }));
  assert.match(r.provenance, /^computed by code/);
  assert.ok(r.numbers.includes(30) && r.numbers.includes(10.2) && r.numbers.includes(3.06));
});

test("oxygen and pressure are parsed by the engine: bare numbers follow its rule, gauge pressure and a missing unit are refused", () => {
  close(ok(o2PartialPressure(34, "100 kPa")).value, 34, 1e-9);
  close(ok(o2PartialPressure(0.34, "100 kPa")).value, 34, 1e-9);
  const gauge = o2PartialPressure("21 %", "10 psig");
  assert.ok(!gauge.ok && gauge.code === "gauge_pressure");
  const nounit = o2PartialPressure("21 %", "10");
  assert.ok(!nounit.ok && nounit.code === "missing_unit");
  const bad = o2PartialPressure("200 %", "1 atm");
  assert.ok(!bad.ok);
});

test("pressure conversion uses the engine's table", () => {
  close(ok(convertPressure(8.2, "psia", "kPa")).value, 8.2 * 6.894757, 1e-9);
  close(ok(convertPressure(1, "atm", "kPa")).value, 101.325, 1e-9);
  close(ok(convertPressure(760, "mmHg", "kPa")).value, 760 * 0.1333224, 1e-9);
  close(ok(convertPressure(101.325, "kPa", "psia")).value, 101.325 / 6.894757, 1e-9);
  close(ok(convertPressure(1, "bar", "mbar")).value, 1000, 1e-9);
  const r = ok(convertPressure(8.2, "psia", "kPa"));
  assert.equal(r.display, "8.2 psia = 56.54 kPa (56.54 kPa).");
  assert.ok(!convertPressure(10, "psig", "kPa").ok);
  assert.ok(!convertPressure(10, "kPa", "furlongs").ok);
  assert.ok(!convertPressure(Number.NaN, "kPa", "atm").ok);
});

test("temperature conversion: K, C, F", () => {
  close(ok(convertTemperature(22, "C", "K")).value, 295.15, 1e-9);
  close(ok(convertTemperature(295.15, "K", "°C")).value, 22, 1e-9);
  close(ok(convertTemperature(212, "F", "C")).value, 100, 1e-9);
  close(ok(convertTemperature(0, "°C", "°F")).value, 32, 1e-9);
  close(ok(convertTemperature(-40, "C", "F")).value, -40, 1e-9);
  const below = convertTemperature(-300, "C", "K");
  assert.ok(!below.ok && below.code === "below_absolute_zero");
  assert.ok(!convertTemperature(1, "rankine", "K").ok);
});

test("compareAtmospheres: the Moon base cabin against sea-level air", () => {
  const r = ok(compareAtmospheres({ name: "Moon cabin", o2: "34 %", pressure: "8.2 psia" }, { name: "Air", o2: "21 %", pressure: "14.7 psia" }));
  close(r.also.pO2_a_psia.value, 2.788, 1e-9);
  close(r.also.pO2_b_psia.value, 3.087, 1e-9);
  close(r.also.pO2_relative_difference_percent.value, ((0.21 * 14.7 - 0.34 * 8.2) / (0.34 * 8.2)) * 100, 1e-9);
  close(r.also.total_relative_difference_percent.value, ((14.7 - 8.2) / 8.2) * 100, 1e-9);
  close(r.also.o2_relative_difference_percent.value, ((21 - 34) / 34) * 100, 1e-9);
  assert.equal(r.display, "Moon cabin: 34 % oxygen at 56.54 kPa gives an oxygen partial pressure of 19.22 kPa (2.788 psia). Air: 21 % at 101.4 kPa gives 21.28 kPa (3.087 psia). Air relative to Moon cabin: oxygen partial pressure +10.72 %, total pressure +79.27 %, oxygen fraction -38.24 %.");
  const bad = compareAtmospheres({ o2: "21 %", pressure: "1 atm" }, { o2: "21 %", pressure: "5 psig" });
  assert.ok(!bad.ok && /^B: /.test(bad.message));
});

test("gravity: Moon 0.16 and 0.165 g with their sources, Mars 0.38 g (NSSDC), Earth 1 g, microgravity is a regime", () => {
  const moon = ok(gravityValue("Moon"));
  assert.equal(moon.value, 0.165);
  assert.equal(moon.also.lunar_presentation_g.value, 0.16);
  assert.deepEqual(moon.sources.map((s) => s.quote), ["glunar = 0.16 gearth", "Lunar-g = 0.165 gE"]);
  assert.match(moon.display, /0\.16 g is the figure of the lunar-gravity presentation, 0\.165 g that of the FM2 centrifuge/);
  const mars = ok(gravityValue("Mars"));
  assert.equal(mars.value, 0.38);
  assert.match(mars.sources[0].url ?? "", /nssdc\.gsfc\.nasa\.gov/);
  assert.equal(ok(gravityValue("Earth")).value, 1);
  const micro = ok(gravityValue("microgravity"));
  assert.equal(micro.value, null);
  assert.deepEqual(micro.numbers, []);
  assert.match(micro.display, /a regime; the engine asserts no level/);
  assert.ok(!gravityValue("Jupiter").ok);
});

test("runCalculator dispatches by name; unknown tools and bad arguments are typed errors, never exceptions", () => {
  assert.deepEqual(Object.keys(CALCULATORS).sort(), Object.keys(CALCULATOR_SPECS).sort());
  const r = runCalculator("o2PartialPressure", { o2: "34 %", pressure: "8.2 psia" });
  assert.ok(r.ok && Math.abs((r.also.pO2_psia.value) - 2.788) < 1e-9);
  const unknown = runCalculator("doMath", {});
  assert.ok(!unknown.ok && unknown.code === "unknown_tool");
  const bad = runCalculator("compareAtmospheres", { a: null, b: 7 });
  assert.ok(!bad.ok && bad.code === "bad_arguments");
});
