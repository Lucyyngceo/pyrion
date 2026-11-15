import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {test} from "node:test";
const root=join(import.meta.dirname,"../..");
test("material matches and oxygen ceilings retain their matching test provenance",()=>{
 const m=JSON.parse(readFileSync(join(root,"data/derived/materials.json"),"utf8"));
 for(const material of m.materials) for(const t of material.tests){assert.equal(t.material_source.value,material.name);assert.equal(t.material_source.test_id,t.test_id);for(const c of t.conditions){assert.equal(c.accession,t.accession);assert.equal(c.test_id,t.test_id)}}
 for(const records of Object.values(m.ambient_ceilings) as any[][]) for(const [oxygen,phase] of records){assert.equal(oxygen.variable,"o2_mole_fraction");assert.equal(phase.variable,"fuel_phase");assert.ok(phase.test_id === "*" || oxygen.test_id===phase.test_id);assert.equal(oxygen.accession,phase.accession)}
});
test("additional outcomes preserve literal source cell values",()=>{const rows=JSON.parse(readFileSync(join(root,"data/derived/unified/outcomes_extra.json"),"utf8"));assert.ok(rows.length);for(const r of rows){assert.equal(r.value,r.value_original);assert.equal(r.method,"table");assert.ok(r.source_file && r.source_location)}});
