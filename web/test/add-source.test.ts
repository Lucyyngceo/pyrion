import assert from "node:assert/strict";
import { test } from "node:test";
import { NASA_ONLY_SENTENCE, checkSourceFile, checkSourceUrl } from "../lib/add-source.ts";

test("only https links on NASA hosts are accepted", () => {
  for (const ok of ["https://ntrs.nasa.gov/citations/20250010653", "https://www.nasa.gov/glenn/x/", "https://psi.nasa.gov/", "https://nasa.gov/a"]) assert.deepEqual(checkSourceUrl(ok), { ok: true }, ok);
  for (const bad of ["http://ntrs.nasa.gov/x", "https://evil.com/ntrs.nasa.gov", "https://nasa.gov.evil.com/", "https://notnasa.gov/", "https://user:pw@ntrs.nasa.gov/", "ftp://nasa.gov/x", "https://doi.org/10.1/x"]) {
    const r = checkSourceUrl(bad);
    assert.equal(r.ok, false, bad);
  }
  const r = checkSourceUrl("https://example.com/");
  assert.equal(r.ok === false && r.reason, NASA_ONLY_SENTENCE);
});

test("files: pdf, csv or xlsx, at most 20 MB", () => {
  assert.equal(checkSourceFile({ name: "a.PDF", size: 1000 }).ok, true);
  assert.equal(checkSourceFile({ name: "a.xlsx", size: 1000 }).ok, true);
  assert.equal(checkSourceFile({ name: "a.exe", size: 1000 }).ok, false);
  assert.equal(checkSourceFile({ name: "a.csv", size: 21 * 1024 * 1024 }).ok, false);
  assert.equal(checkSourceFile({ name: "a.csv", size: 0 }).ok, false);
});
