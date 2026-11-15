import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "../..");
const profiles = JSON.parse(readFileSync(join(root,"data/derived/investigation_profiles.json"),"utf8"));
const rows = JSON.parse(readFileSync(join(root,"data/derived/unified/pyrion_psi_combustion.json"),"utf8"));
test("profiles and unified rows retain their source and DOI fields", () => {
 assert.equal(new Set(profiles.map((p: {accession:string})=>p.accession)).size, profiles.length);
 assert.ok(rows.length > 0);
 for (const row of rows) { assert.ok("source_file" in row && "source_location" in row && "quote" in row && "doi" in row); }
 for (const profile of profiles) {
  assert.equal(profile.value_count, rows.filter((r: {accession:string,status:string})=>r.accession===profile.accession && r.status==="extracted").length);
  for (const field of Object.values(profile.fields) as {source:{file:string,key:string}}[]) assert.ok(field.source.file && field.source.key);
 }
});
test("dictionary includes every extracted variable and units", () => {
 const dictionary=readFileSync(join(root,"data/derived/unified/data_dictionary.md"),"utf8");
 for (const variable of new Set(rows.map((r: {variable:string})=>r.variable))) assert.ok(dictionary.includes(`\u0060${variable}\u0060`));
});
