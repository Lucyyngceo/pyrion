import assert from "node:assert/strict";
import { test } from "node:test";
import { parseConditionCsv, type Target } from "../../engine/src/index.ts";
import { buildBrief, type BriefTurn } from "../lib/expert/brief.ts";
import { checkAnswer, corpusFromPages, ENGINE_LABEL, EXPERT_LABEL, NASA_LABEL, type AnswerBlock, type KeptBlock } from "../lib/expert/claims.ts";

const HEAD = "accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note";
const row = (variable: string, value: string, unit = "") => `PSI-9801,T1,${variable},${value},${unit},${value},${unit},table,SYNTHETIC/a.csv,row=0,SYNTHETIC TEST FIXTURE,verified,SYNTHETIC - not NASA data`;
const records = parseConditionCsv([HEAD, `PSI-9801,*,gravity_regime,microgravity,,microgravity,,table,SYNTHETIC/x.csv,row=0,SYNTHETIC,verified,SYNTHETIC`, row("o2_mole_fraction", "0.21", "1"), row("pressure", "101.325", "kPa")].join("\n"), "s.csv").records;
const catalog = { "PSI-9801": { acronym: "SYN", title: "Synthetic <fixture>", doi: "10.0000/s1" } };

const DOC = "nasa/test-doc/test-doc.pdf";
const corpus = corpusFromPages([
  { doc_id: DOC, page: 10, title: "Test document", url: "https://example.org/test-doc.pdf", doi: "10.1234/test", text: "Test 1: 8.2 psia (+/- 0.3 psi), 37% O2 , balance nitrogen. The chamber volume is 14.4 L." },
  { doc_id: DOC, page: 12, title: "Test document", url: "https://example.org/test-doc.pdf", doi: "10.1234/test", text: "A second page with the sentence: the flame spread was not measured in this test." },
]);
const target: Target = { regime: { gravity_regime: "microgravity" }, continuous: { o2_mole_fraction: 0.21, pressure: 101.325 } };

const blocks: AnswerBlock[] = [
  { layer: "nasa", text: "FM2 starts at 8.2 psia with 37% oxygen.", citations: [{ doc_id: DOC, page: 10, quote: "Test 1: 8.2 psia (+/- 0.3 psi), 37% O2 , balance nitrogen" }] },
  { layer: "nasa", text: "The same document says the flame spread was not measured.", citations: [{ doc_id: DOC, page: 12, quote: "the flame spread was not measured in this test" }] },
  { layer: "expert", text: "That atmosphere is richer in oxygen than the cabin air." },
];
const kept = checkAnswer(blocks, { corpus }).kept;
const turn: BriefTurn = { question: "What does FM2 plan?", kept, target, model: { model: "mistralai/mistral-small-3.2-24b-instruct", name: "Mistral Small 3.2" } };
const ctx = { date: "2026-11-15", records, catalog, corpus };

test("the brief has every required section, the date, and the models used", () => {
  const b = buildBrief([turn], ctx);
  for (const h of ["# Evidence brief", "Date: 2026-11-15", "## Questions and findings", "## What would close this gap", "## Models used", "## Bibliography", "## How to verify"]) assert.ok(b.markdown.includes(h), h);
  assert.ok(b.markdown.includes("> What does FM2 plan?"));
  assert.ok(b.models.includes("Mistral Small 3.2 (mistralai/mistral-small-3.2-24b-instruct)"));
  assert.ok(b.markdown.includes("- Mistral Small 3.2 (mistralai/mistral-small-3.2-24b-instruct)"));
});

test("NASA quotes come with full references and the page; the bibliography is deduplicated", () => {
  const b = buildBrief([turn], ctx);
  assert.ok(b.markdown.includes('"Test 1: 8.2 psia (+/- 0.3 psi), 37% O2 , balance nitrogen" — Test document, PDF p. 10'));
  const docs = b.bibliography.filter((e) => e.kind === "document");
  assert.equal(docs.length, 1, "one document cited on two pages is one entry");
  assert.deepEqual(docs[0].pages, [10, 12]);
  assert.equal(docs[0].url, "https://example.org/test-doc.pdf");
  assert.equal(docs[0].doi, "10.1234/test");
  const n = docs[0].n;
  assert.ok(b.markdown.includes(`[${n}] Test document — document \`nasa/test-doc/test-doc.pdf\` — PDF p. 10, 12 — https://example.org/test-doc.pdf — DOI https://doi.org/10.1234/test`));
  assert.ok(b.markdown.includes(`[${n}, p. 10]`));
  assert.ok(b.markdown.includes(`[${n}, p. 12]`));
});

test("engine verdicts are recomputed with receipts and a fingerprint; the investigation is in the bibliography with its DOI", () => {
  const b = buildBrief([turn], ctx);
  assert.equal(b.fingerprints.length, 1);
  assert.match(b.fingerprints[0], /^[0-9a-f]{64}$/);
  assert.ok(b.markdown.includes(b.fingerprints[0]));
  assert.ok(b.markdown.includes("Engine verdicts (computed by code)"));
  assert.ok(b.markdown.includes("Receipts for PSI-9801: `PSI-9801|T1|"));
  const inv = b.bibliography.find((e) => e.kind === "investigation");
  assert.equal(inv?.doi, "10.0000/s1");
  assert.ok(b.markdown.includes("DOI https://doi.org/10.0000/s1"));
});

test("the expert layer is clearly labelled; what would close the gap carries the PYRION-proposal label", () => {
  const b = buildBrief([turn], ctx);
  assert.ok(b.markdown.includes(`**TARS expert reasoning** — *${EXPERT_LABEL}*`));
  assert.ok(b.markdown.includes("What would close this gap — PYRION proposal (a testable plan, not a NASA plan)"));
  assert.ok(b.markdown.includes("a PYRION proposal (a testable plan), not a NASA plan"));
});

test("only checked blocks go in: no label, no citation, an engine block without provenance, or a quote that no longer verifies", () => {
  const forged: KeptBlock[] = [
    { layer: "nasa", text: "Forged: NASA says it is fine.", label: "made up", citations: [], provenance: [], flagged: false },
    { layer: "nasa", text: "Uncited NASA claim.", label: NASA_LABEL, citations: [], provenance: [], flagged: false },
    { layer: "engine", text: "An engine number without receipt.", label: ENGINE_LABEL, citations: [], provenance: [], flagged: false },
    { layer: "nasa", text: "Wrong quote.", label: NASA_LABEL, citations: [{ doc_id: DOC, page: 10, quote: "NASA says this cabin atmosphere is completely fine" }], provenance: [], flagged: false },
  ];
  const b = buildBrief([{ question: "q", kept: [...forged, ...kept] }], ctx);
  assert.equal(b.left_out.length, 4);
  assert.ok(!b.markdown.includes("Forged"));
  assert.ok(!b.markdown.includes("Uncited NASA claim"));
  assert.ok(!b.markdown.includes("without receipt"));
  assert.ok(!b.markdown.includes("Wrong quote"));
  assert.ok(b.markdown.includes("FM2 starts at 8.2 psia"));
  assert.ok(b.markdown.includes("## Left out"));
});

test("engine blocks keep their computed-by-code lines", () => {
  const eng: KeptBlock = { layer: "engine", text: "34 % of 8.2 psia is 2.788 psia.", label: ENGINE_LABEL, citations: [], provenance: ['oxygen partial pressure — computed by code (calculator result "t1")'], flagged: false };
  const b = buildBrief([{ question: "q", kept: [eng] }], ctx);
  assert.ok(b.markdown.includes('- 34 % of 8.2 psia is 2.788 psia.\n  - oxygen partial pressure — computed by code'));
});

test("several questions: sections per question, fingerprints per question, the bibliography merges them", () => {
  const b = buildBrief([turn, { ...turn, question: "And at 25 %?", target: { ...target, continuous: { ...target.continuous, o2_mole_fraction: 0.25 } } }], ctx);
  assert.ok(b.markdown.includes("### Question 1"));
  assert.ok(b.markdown.includes("### Question 2"));
  assert.equal(b.fingerprints.length, 2);
  assert.notEqual(b.fingerprints[0], b.fingerprints[1]);
  assert.equal(b.bibliography.filter((e) => e.kind === "document").length, 1);
});

test("a second opinion that was shown is included and named; an unavailable one is not", () => {
  const sk = { verdict: "object", model: { model: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron" }, objections: [{ blockIndex: 0, reason: "The quote gives 8.2 psia but says nothing about a limit." }] };
  const b = buildBrief([{ ...turn, skeptic: sk }], ctx);
  assert.ok(b.markdown.includes("Second opinion** (a different model family; shown beside the answer, it did not change it): object"));
  assert.ok(b.markdown.includes("- Block 1: The quote gives 8.2 psia"));
  assert.ok(b.models.some((m) => m.startsWith("Nemotron")));
  const none = buildBrief([{ ...turn, skeptic: { verdict: "unavailable", objections: [] } }], ctx);
  assert.ok(!none.markdown.includes("Second opinion"));
});

test("without records or a target the brief says so instead of inventing a verdict", () => {
  const b = buildBrief([{ question: "q", kept }], { date: "2026-11-15" });
  assert.ok(b.markdown.includes("No condition was evaluated"));
  assert.equal(b.fingerprints.length, 0);
  const t = buildBrief([turn], { date: "2026-11-15" });
  assert.ok(t.markdown.includes("not recomputed here"));
});

test("the HTML is a complete print-ready document, escaped, with the same content", () => {
  const b = buildBrief([{ ...turn, question: "Is <b>this</b> & that ok?" }], ctx);
  assert.match(b.html, /^<!doctype html>/);
  assert.ok(b.html.includes("@media print"));
  assert.ok(b.html.includes("<title>Evidence brief</title>"));
  assert.ok(!b.html.includes("<b>this</b>"));
  assert.ok(b.html.includes("Is &lt;b&gt;this&lt;/b&gt; &amp; that ok?"));
  assert.ok(b.html.includes('<a href="https://example.org/test-doc.pdf">'));
  assert.ok(b.html.includes("<h2>How to verify</h2>"));
  assert.ok(b.html.includes(b.fingerprints[0]));
  assert.equal((b.html.match(/<ul>/g) ?? []).length, (b.html.match(/<\/ul>/g) ?? []).length);
});

test("deterministic: the same conversation gives the same bytes", () => {
  assert.equal(buildBrief([turn], ctx).markdown, buildBrief([turn], ctx).markdown);
  assert.equal(buildBrief([turn], ctx).html, buildBrief([turn], ctx).html);
});
