import assert from "node:assert/strict";
import { test } from "node:test";
import { NASA_ONLY_SENTENCE, checkNtrsInput, checkSourceFile } from "../lib/add-source.ts";

test("an NTRS number is digits only; a pasted ntrs.nasa.gov link yields only its digits", () => {
  assert.deepEqual(checkNtrsInput("20250010653"), { ok: true, id: "20250010653" });
  assert.deepEqual(checkNtrsInput("  20250010653 "), { ok: true, id: "20250010653" });
  assert.deepEqual(checkNtrsInput("https://ntrs.nasa.gov/citations/20250010653"), { ok: true, id: "20250010653" });
  assert.deepEqual(checkNtrsInput("https://ntrs.nasa.gov/api/citations/20260001966/downloads/x.pdf"), { ok: true, id: "20260001966" });
  for (const bad of [
    "http://ntrs.nasa.gov/citations/20250010653",
    "https://evil.com/citations/20250010653",
    "https://ntrs.nasa.gov.evil.com/citations/20250010653",
    "https://user:pw@ntrs.nasa.gov/citations/20250010653",
    "https://www.nasa.gov/glenn/x/",
    "https://doi.org/10.1/x",
    "https://ntrs.nasa.gov/search?q=1",
    "2025001065x",
    "123",
    "20250010653; rm -rf",
    "file:///etc/passwd",
  ]) {
    const r = checkNtrsInput(bad);
    assert.equal(r.ok, false, bad);
  }
  const r = checkNtrsInput("https://example.com/");
  assert.equal(r.ok === false && r.reason, NASA_ONLY_SENTENCE);
});

test("files: csv or xlsx, at most 20 MB", () => {
  assert.equal(checkSourceFile({ name: "a.CSV", size: 1000 }).ok, true);
  assert.equal(checkSourceFile({ name: "a.xlsx", size: 1000 }).ok, true);
  assert.equal(checkSourceFile({ name: "a.pdf", size: 1000 }).ok, false);
  assert.equal(checkSourceFile({ name: "a.exe", size: 1000 }).ok, false);
  assert.equal(checkSourceFile({ name: "a.csv", size: 21 * 1024 * 1024 }).ok, false);
  assert.equal(checkSourceFile({ name: "a.csv", size: 0 }).ok, false);
});
