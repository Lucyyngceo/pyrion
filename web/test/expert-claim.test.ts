// centinela:off (false positive: the test feeds the language gate the phrases it must catch)
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseConditionCsv } from "../../engine/src/index.ts";
import { checkClaim, OVERCLAIM_PATTERNS, type ClaimContext } from "../lib/expert/claim.ts";
import { corpusFromPages } from "../lib/expert/claims.ts";
import type { AskModel, ModelRequest } from "../lib/expert/model.ts";

const HEAD = "accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note";
const row = (acc: string, variable: string, value: string, unit = "") => `${acc},T1,${variable},${value},${unit},${value},${unit},table,SYNTHETIC/${acc}.csv,row=0,SYNTHETIC TEST FIXTURE,verified,SYNTHETIC - not NASA data`;
const records = parseConditionCsv(
  [HEAD, `PSI-9801,*,gravity_regime,microgravity,,microgravity,,table,SYNTHETIC/x.csv,row=0,SYNTHETIC,verified,SYNTHETIC`, row("PSI-9801", "o2_mole_fraction", "0.21", "1"), row("PSI-9801", "pressure", "101.325", "kPa")].join("\n"),
  "s.csv",
).records;

const DOC = "nasa/test-doc/test-doc.pdf";
const corpus = corpusFromPages([
  { doc_id: DOC, page: 10, title: "Test document", url: "https://example.org/test-doc.pdf", text: "Test 1: 8.2 psia (+/- 0.3 psi), 37% O2 , balance nitrogen. The chamber volume is 14.4 L. The sample is not ignited by the hot wire in the first test." },
  { doc_id: DOC, page: 11, title: "Test document", url: "https://example.org/test-doc.pdf", text: "A different page about the vent line and the flow of gas." },
]);

interface Script {
  claims?: string[];
  candidates?: { doc_id: string; page: number; quote: string; relation: string }[];
  failSplit?: boolean;
  seen?: ModelRequest[];
}
const ctxFor = (s: Script = {}): ClaimContext => {
  const askModel: AskModel = async (req) => {
    s.seen?.push(req);
    if (req.purpose === "split claims") {
      if (s.failSplit) throw new Error("no model");
      return { text: JSON.stringify({ claims: s.claims ?? [] }), model: "z-ai/glm-5.3", name: "GLM-5.3" };
    }
    return { text: JSON.stringify({ candidates: s.candidates ?? [] }), model: "z-ai/glm-5.3", name: "GLM-5.3" };
  };
  return { corpus, askModel, records, catalog: { "PSI-9801": { acronym: "SYN", title: "Synthetic", doi: "10.0000/s1" } }, search: async () => [{ doc_id: DOC, page_start: 10, title: "Test document", text: "The chamber volume is 14.4 L." }] };
};
const one = async (text: string, s: Script = {}) => (await checkClaim(text, ctxFor({ claims: [text], ...s }))).claims[0];

test("the engine decides a claim about an investigation: the claimed verdict is supported, another one is contradicted, with the fingerprint", async () => {
  const ok = await one("PSI-9801 is applicable at 21 % oxygen and 1 atm in microgravity.");
  assert.equal(ok.class, "supported in PSI");
  assert.equal(ok.engineRefs[0].accession, "PSI-9801");
  assert.equal(ok.engineRefs[0].engineVerdict, "Applicable");
  assert.match(ok.engineRefs[0].fingerprint, /^[0-9a-f]{64}$/);
  assert.equal(ok.engineRefs[0].doi, "10.0000/s1");
  const bad = await one("PSI-9801 is applicable at 34 % oxygen and 8.2 psia on the Moon.");
  assert.equal(bad.class, "contradicted");
  assert.equal(bad.engineRefs[0].engineVerdict, "Not comparable (different regime)");
  assert.match(bad.reason, /The engine gives Not comparable \(different regime\) for PSI-9801 at that condition, not Applicable\./);
});

test("an investigation that is not in the records, or a claim without a condition, is not supported (never 'false')", async () => {
  const missing = await one("PSI-9999 is applicable at 21 % oxygen and 1 atm in microgravity.");
  assert.equal(missing.class, "not supported in PSI");
  assert.match(missing.reason, /not among the investigations extracted from PSI/);
  const nocond = await one("PSI-9801 is applicable.");
  assert.equal(nocond.class, "not supported in PSI");
  assert.match(nocond.reason, /no condition/);
});

test("the condition of the whole pasted text serves the claims that do not repeat it", async () => {
  const text = "At 21 % oxygen and 1 atm in microgravity: PSI-9801 is applicable.";
  const c = await checkClaim(text, ctxFor({ claims: ["PSI-9801 is applicable."] }));
  assert.equal(c.claims[0].class, "supported in PSI");
});

test("overclaims: safe, validated by NASA, first in the world, proves, no data exists, in English and Spanish", async () => {
  for (const t of ["This cabin atmosphere is safe.", "The tool was validated by NASA.", "It is the first in the world to do this.", "The test proves the atmosphere works.", "No data exists for lunar gravity.", "La herramienta fue validada por la NASA.", "Garantiza que es seguro.", "It has perfect accuracy."]) {
    const r = await one(t);
    assert.equal(r.class, "overclaim", t);
    assert.ok(r.overclaimPatterns.length > 0);
    assert.match(r.reason, /overclaims/);
  }
  assert.ok(OVERCLAIM_PATTERNS.length >= 9);
  assert.equal((await one("The chamber holds 14.4 liters.")).class, "not supported in PSI");
});

test("a verified NASA quote that contains every number of the claim supports it", async () => {
  const r = await one("The chamber volume is 14.4 L.", { candidates: [{ doc_id: DOC, page: 10, quote: "The chamber volume is 14.4 L", relation: "supports" }] });
  assert.equal(r.class, "supported in PSI");
  assert.equal(r.citations[0].page, 10);
  assert.equal(r.citations[0].url, "https://example.org/test-doc.pdf");
});

test("a supporting quote that lacks the claim's number does not support it", async () => {
  const c = await checkClaim("The chamber volume is 12 L.", ctxFor({ claims: ["The chamber volume is 12 L."], candidates: [{ doc_id: DOC, page: 10, quote: "The chamber volume is 14.4 L", relation: "supports" }] }));
  assert.equal(c.claims[0].class, "not supported in PSI");
  assert.ok(c.dropped.some((d) => /does not contain every number/.test(d)));
});

test("a verified quote with a different number contradicts a numeric claim; a negation contradicts a plain one", async () => {
  const num = await one("The chamber volume is 12 L.", { candidates: [{ doc_id: DOC, page: 10, quote: "The chamber volume is 14.4 L", relation: "contradicts" }] });
  assert.equal(num.class, "contradicted");
  assert.equal(num.citations[0].quote, "The chamber volume is 14.4 L");
  const neg = await one("The sample is ignited by the hot wire in the first test.", { candidates: [{ doc_id: DOC, page: 10, quote: "The sample is not ignited by the hot wire in the first test", relation: "contradicts" }] });
  assert.equal(neg.class, "contradicted");
  assert.match(neg.reason, /says the opposite/);
});

test("a 'contradicts' that the code cannot see (same numbers, no negation) is not a contradiction", async () => {
  const r = await one("The chamber volume is 14.4 L.", { candidates: [{ doc_id: DOC, page: 10, quote: "The chamber volume is 14.4 L", relation: "contradicts" }] });
  assert.equal(r.class, "not supported in PSI");
});

test("unverified candidates are dropped: wrong page, invented words, changed number", async () => {
  const r = await checkClaim("The chamber volume is 14.4 L.", ctxFor({ claims: ["The chamber volume is 14.4 L."], candidates: [
    { doc_id: DOC, page: 11, quote: "The chamber volume is 14.4 L", relation: "supports" },
    { doc_id: DOC, page: 10, quote: "NASA says the chamber volume is huge and safe", relation: "supports" },
    { doc_id: DOC, page: 10, quote: "The chamber volume is 1.4 L", relation: "supports" },
  ] }));
  assert.equal(r.claims[0].class, "not supported in PSI");
  assert.equal(r.claims[0].citations.length, 0);
  assert.equal(r.dropped.filter((d) => /not verified/.test(d)).length, 3);
});

test("a candidate that shares too few words with the claim is ignored", async () => {
  const r = await one("Oxygen limits differ at lunar gravity.", { candidates: [{ doc_id: DOC, page: 10, quote: "The chamber volume is 14.4 L", relation: "supports" }] });
  assert.equal(r.class, "not supported in PSI");
});

test("overclaim wording outranks a supporting quote, but a contradiction outranks the wording", async () => {
  const sup = await one("The chamber volume is 14.4 L and it is safe.", { candidates: [{ doc_id: DOC, page: 10, quote: "The chamber volume is 14.4 L", relation: "supports" }] });
  assert.equal(sup.class, "overclaim");
  const bad = await one("PSI-9801 is applicable and safe at 34 % oxygen and 8.2 psia on the Moon.");
  assert.equal(bad.class, "contradicted");
  assert.deepEqual(bad.overclaimPatterns, ["safe"]);
});

test("the model only proposes: claims that are not in the pasted text are dropped; if it fails the code splits the text", async () => {
  const text = "The chamber volume is 14.4 L. The vent line is short.";
  const a = await checkClaim(text, ctxFor({ claims: ["The chamber volume is 14.4 L.", "NASA completely approved the whole mission design."] }));
  assert.deepEqual(a.claims.map((c) => c.text), ["The chamber volume is 14.4 L."]);
  assert.ok(a.dropped.some((d) => /not in the pasted text/.test(d)));
  assert.deepEqual(a.models, ["GLM-5.3"]);
  const b = await checkClaim(text, ctxFor({ failSplit: true }));
  assert.deepEqual(b.claims.map((c) => c.text), ["The chamber volume is 14.4 L.", "The vent line is short."]);
  assert.ok(!b.dropped.some((d) => /not in the pasted text/.test(d)));
});

test("counts add up; every class carries a reason; at most 12 claims", async () => {
  const text = Array.from({ length: 15 }, (_, i) => `Statement number ${i} about the vent line is short.`).join(" ");
  const c = await checkClaim(text, ctxFor({ failSplit: true }));
  assert.equal(c.claims.length, 12);
  assert.equal(Object.values(c.counts).reduce((a, b) => a + b, 0), 12);
  assert.ok(c.claims.every((x) => x.reason.length > 10));
});
