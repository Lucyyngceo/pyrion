import assert from "node:assert/strict";
import { test } from "node:test";
import { parseConditionCsv, PRESETS } from "../../engine/src/index.ts";
import { compareConditionSet, RANKING_RULE } from "../lib/expert/compare.ts";
import { o2PartialPressure } from "../lib/expert/calculators.ts";

const HEAD = "accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note";
const row = (acc: string, variable: string, value: string, unit = "") => `${acc},T1,${variable},${value},${unit},${value},${unit},table,SYNTHETIC/${acc}.csv,row=0,SYNTHETIC TEST FIXTURE,verified,SYNTHETIC - not NASA data`;
const inv = (acc: string, o2: string, kpa: string) => [`${acc},*,gravity_regime,microgravity,,microgravity,,table,SYNTHETIC/x.csv,row=0,SYNTHETIC,verified,SYNTHETIC`, row(acc, "o2_mole_fraction", o2, "1"), row(acc, "pressure", kpa, "kPa")];
const records = parseConditionCsv([HEAD, ...inv("PSI-9801", "0.21", "101.325"), ...inv("PSI-9802", "0.30", "50")].join("\n"), "s.csv").records;
const catalog = { "PSI-9801": { acronym: "SYN1", title: "Synthetic one", doi: "10.0000/s1" }, "PSI-9802": { acronym: "SYN2", title: "Synthetic two", doi: "10.0000/s2" } };
const ctx = { records, catalog };

const A = { name: "Air, microgravity", o2: "21 %", pressure: "1 atm", gravity_regime: "microgravity" };
const B = { name: "Rich, low pressure", o2: "30 %", pressure: "50 kPa", gravity_regime: "microgravity" };
const C = { name: "Far from tests", o2: "60 %", pressure: "20 kPa", gravity_regime: "microgravity" };

test("every number in a row equals the calculators' output for the same figures", () => {
  const r = compareConditionSet([A, B, C], ctx);
  for (const [i, c] of [A, B, C].entries()) {
    const row = r.rows[i];
    assert.equal(row.ok, true);
    const calc = o2PartialPressure(c.o2, c.pressure);
    assert.ok(calc.ok);
    assert.equal(row.pO2_kpa, calc.value);
    assert.equal(row.pO2_psia, calc.also.pO2_psia.value);
    assert.equal(row.total_kpa, calc.also.total_kpa.value);
    assert.equal(row.total_psia, calc.also.total_psia.value);
    assert.equal(row.o2_percent, calc.also.o2_percent.value);
    assert.equal(row.pO2_display, calc.display);
    assert.match(row.pO2_provenance ?? "", /computed by code/);
  }
  // 21 % of 101.325 kPa, by hand: 21.28 kPa.
  assert.equal(Number((r.rows[0].pO2_kpa as number).toFixed(2)), 21.28);
});

test("verdict counts, solid-fuel status and nearest evidence come from the engine", () => {
  const r = compareConditionSet([A, B, C], ctx);
  assert.equal(r.rows[0].counts?.APPLICABLE, 1);
  assert.equal(r.rows[0].nearest?.accession, "PSI-9801");
  assert.equal(r.rows[0].nearest?.doi, "10.0000/s1");
  assert.equal(r.rows[1].nearest?.accession, "PSI-9802");
  assert.ok(r.rows[2].counts);
  assert.match(r.rows[0].fingerprint ?? "", /^[0-9a-f]{64}$/);
  assert.notEqual(r.rows[0].fingerprint, r.rows[1].fingerprint);
  assert.equal(typeof r.rows[0].solid_fuel?.best, "string");
});

test("the ranking states its rule and puts the condition with applicable evidence first", () => {
  const r = compareConditionSet([C, A, B], ctx);
  assert.equal(r.rule, RANKING_RULE);
  assert.ok(r.markdown.includes(RANKING_RULE));
  assert.match(RANKING_RULE, /does not say which atmosphere is safer or better/);
  assert.deepEqual(r.ranking.map((x) => x.name).slice(0, 2).sort(), ["Air, microgravity", "Rich, low pressure"]);
  assert.equal(r.ranking[r.ranking.length - 1].name, "Far from tests");
  assert.ok(r.ranking.every((x, i) => x.rank >= 1 && (i === 0 || x.rank >= r.ranking[i - 1].rank)));
});

test("equal on every key means tied: the same condition twice shares a rank", () => {
  const r = compareConditionSet([A, { ...A, name: "Air again" }], ctx);
  assert.deepEqual(r.ranking.map((x) => x.rank), [1, 1]);
});

test("presets work by id and carry their gravity; a preset the engine does not know is an error row, not a guess", () => {
  const id = PRESETS[0].id;
  const r = compareConditionSet([id, "no-such-preset"], ctx);
  assert.equal(r.rows[0].ok, true);
  assert.ok(r.rows[0].gravity.regime);
  assert.equal(r.rows[1].ok, false);
  assert.match(r.rows[1].error ?? "", /not a preset id/);
  assert.deepEqual(r.ranking.map((x) => x.index), [0]);
  assert.ok(r.markdown.includes("not computed:"));
});

test("wrong input is refused by the parser, never repaired: gauge pressure, impossible oxygen, missing pressure", () => {
  const r = compareConditionSet([{ name: "gauge", o2: "21 %", pressure: "14 psig" }, { name: "impossible", o2: "200 %", pressure: "1 atm" }, { name: "no pressure", o2: "21 %" }], ctx);
  assert.deepEqual(r.rows.map((x) => x.ok), [false, false, false]);
  assert.equal(r.ranking.length, 0);
  assert.ok(r.markdown.includes("No condition could be ranked."));
});

test("a gravity regime left out stays open and the table says so", () => {
  const r = compareConditionSet([{ name: "open", o2: "21 %", pressure: "1 atm" }], ctx);
  assert.equal(r.rows[0].ok, true);
  assert.equal(r.rows[0].gravity.regime, null);
  assert.ok(r.markdown.includes("not stated (open)"));
});

test("the table has one line per condition and the numbers shown are the row's numbers; deterministic", () => {
  const r = compareConditionSet([A, B], ctx);
  const lines = r.markdown.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| Condition"));
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes("21 | 101.3 kPa (14.7 psia) | 21.28 kPa (3.086 psia)"));
  assert.equal(compareConditionSet([A, B], ctx).markdown, r.markdown);
});
