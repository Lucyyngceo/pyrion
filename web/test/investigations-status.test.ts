import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";
const root=join(import.meta.dirname,"../..");
const profiles=JSON.parse(readFileSync(join(root,"data/derived/investigation_profiles.json"),"utf8"));
const materials=JSON.parse(readFileSync(join(root,"data/derived/materials.json"),"utf8"));
test("flagged observations do not enter profiles or material ceilings",()=>{
 // PSI-25 flow velocity was once flagged; since c41e1c7 it is extracted per test (BASS-II report Tables 7.1 and 5.1) and only those located values enter the profile.
 const p25=profiles.find((p:{accession:string})=>p.accession==="PSI-25");
 const flow=p25.variables.find((v:{variable:string})=>v.variable==="flow_velocity");
 assert.equal(flow.source,"data/conditions/PSI-25.csv");
 assert.equal(flow.unit,"cm/s");
 assert.equal(flow.test_count,44);
 const p69=profiles.find((p:{accession:string})=>p.accession==="PSI-69");
 assert.equal(p69.variables.some((v:{variable:string})=>v.variable==="outcome:burning_rate"),false);
 assert.ok(p69.variables.filter((v:{variable:string})=>v.variable==="pressure").every((v:{min:number|null})=>v.min===null||v.min>0));
 for(const [phase,expected] of [["gas",0.4],["liquid",0.34],["solid",0.22721982701616103]] as const){const [oxygen]=materials.ambient_ceilings[phase][0];assert.equal(Number(oxygen.value),expected);assert.equal(oxygen.status,"extracted")}
});
