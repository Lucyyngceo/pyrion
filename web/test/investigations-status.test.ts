import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const root=join(import.meta.dirname,"../..");
const profiles=JSON.parse(readFileSync(join(root,"data/derived/investigation_profiles.json"),"utf8"));
const materials=JSON.parse(readFileSync(join(root,"data/derived/materials.json"),"utf8"));
test("flagged observations do not enter profiles or material ceilings",()=>{
 const p25=profiles.find((p:{accession:string})=>p.accession==="PSI-25");
 assert.equal(p25.variables.some((v:{variable:string})=>v.variable==="flow_velocity"),false);
 const p69=profiles.find((p:{accession:string})=>p.accession==="PSI-69");
 assert.equal(p69.variables.some((v:{variable:string})=>v.variable==="outcome:burning_rate"),false);
 assert.ok(p69.variables.filter((v:{variable:string})=>v.variable==="pressure").every((v:{min:number|null})=>v.min===null||v.min>0));
 for(const [phase,expected] of [["gas",0.4],["liquid",0.34],["solid",0.22721982701616103]] as const){const [oxygen]=materials.ambient_ceilings[phase][0];assert.equal(Number(oxygen.value),expected);assert.equal(oxygen.status,"extracted")}
});
