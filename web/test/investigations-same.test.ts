import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {test} from "node:test";
const root=join(import.meta.dirname,"../..");
const read=(p:string)=>JSON.parse(readFileSync(join(root,p),"utf8"));
test("SAME smoke records retain sheet-local identifiers and provenance",()=>{const records=read("data/derived/unified/outcomes_extra.json").filter((r:{variable:string})=>r.variable.startsWith("outcome:smoke_"));assert.ok(records.length>0);for(const r of records){assert.match(r.test_id,/^Reduced data sheet row \d+$/);assert.match(r.source_location,/^sheet=Reduced data sheet;cell=/);assert.match(r.note,/not linked to experimental-table test IDs/);assert.equal(r.value,r.value_original)}});
test("flight-ground comparison identifies spreadsheet cells",()=>{const pairs=read("data/derived/unified/same_pairs.json");assert.ok(pairs.length>0);for(const p of pairs){assert.match(p.flight,/^F/);assert.match(p.ground,/^G/);assert.ok(p.measurements.length);for(const m of p.measurements){assert.ok(m.flight_cell&&m.ground_cell&&m.pair_cell)}}});
test("material family labels preserve the original descriptions",()=>{const data=read("data/derived/materials.json");for(const m of data.materials){assert.ok(m.name&&m.families.length&&m.geometry.length);for(const t of m.tests)assert.equal(t.material_source.value,m.name)}});
