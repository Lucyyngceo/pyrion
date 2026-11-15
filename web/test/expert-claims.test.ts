import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runCalculator, type ToolResult } from "../lib/expert/calculators.ts";
import {
  EXPERT_LABEL,
  NUMBER_REMOVED,
  checkAnswer,
  citationProblem,
  corpusFromPages,
  numbersFound,
  numbersIn,
  parseCorpusJsonl,
  quoteFound,
  scrubNumbers,
  type AnswerBlock,
  type CheckContext,
} from "../lib/expert/claims.ts";

// A tiny corpus (invented text, not NASA text) with the traps the rules exist for.
const DOC = "nasa/test-doc/test-doc.pdf";
const corpus = corpusFromPages([
  { doc_id: DOC, page: 10, title: "Test document", url: "https://example.org/test-doc.pdf", text: "FM2 Science Requirements\nTest 1: 8.2 psia (+/- 0.3 psi), 37% O2 , balance nitrogen\nThe chamber volume is 14.4 L and\nthe ignition is by hot wire in the bottom of the sample." },
  { doc_id: DOC, page: 11, text: "A different page. The vent pressure is 15 psia and nothing else is stated here." },
  { doc_id: DOC, page: 13, text: "Another page. The limit is 1.5 percent of the burn, as measured." },
  { doc_id: DOC, page: 12, text: "The quality of the evidence is poor: the in-\nstrument had a lamp fail." },
]);
const QUOTE = "Test 1: 8.2 psia (+/- 0.3 psi), 37% O2 , balance nitrogen";
const nasa = (over: Partial<AnswerBlock> = {}): AnswerBlock => ({ layer: "nasa", text: "FM2 starts at 8.2 psia with 37% oxygen.", citations: [{ doc_id: DOC, page: 10, quote: QUOTE }], ...over });

const tools: Record<string, ToolResult> = {
  pp: runCalculator("o2PartialPressure", { o2: "34 %", pressure: "8.2 psia" }),
  bad: runCalculator("o2PartialPressure", { o2: "34 %", pressure: "8.2 psig" }),
};
const engine = {
  answer: { known: [{ sentence: "PSI-23 SYN (doi:10.60555/abcd-1234) is comparable.", citations: [{ accession: "PSI-23" }] }], pressure: { kpa: 70.33, psia: 10.2 }, o2: 0.3 },
};
const ctx: CheckContext = { corpus, engine, tools };

test("quote rules: verbatim up to spacing and punctuation, elisions split the quote, numbers exactly as written", () => {
  assert.ok(quoteFound("Test 1: 8.2 psia (+/- 0.3 psi) 37% O2 balance nitrogen", corpus.get(DOC, 10)!.text));
  assert.ok(quoteFound("Test 1: 8.2 psia [...] balance nitrogen", corpus.get(DOC, 10)!.text));
  assert.ok(!quoteFound("balance nitrogen [...] Test 1: 8.2 psia", corpus.get(DOC, 10)!.text), "fragments must come in order");
  assert.ok(quoteFound("the quality of the evidence is poor: the instrument had a lamp fail", corpus.get(DOC, 12)!.text), "hyphenation at a line break");
  assert.deepEqual(numbersIn("8.2 psia, 15 psi, .15, 14,4 L"), ["8.2", "15", ".15", "14.4"]);
  assert.ok(numbersFound("the limit is 1.5 percent", corpus.get(DOC, 13)!.text));
  assert.ok(!numbersFound("the limit is 15 percent", corpus.get(DOC, 13)!.text));
  assert.ok(numbersFound("The vent pressure is 15 psia", corpus.get(DOC, 11)!.text));
});

test("a correct quote on the right page passes: the block is kept with its verified citation, title and link", () => {
  const r = checkAnswer([nasa()], ctx);
  assert.equal(r.kept.length, 1);
  assert.equal(r.report.dropped.length, 0);
  assert.deepEqual(r.report.verifiedCitations, [{ index: 0, doc_id: DOC, page: 10, title: "Test document", url: "https://example.org/test-doc.pdf" }]);
  assert.equal(r.kept[0].citations[0].url, "https://example.org/test-doc.pdf");
  assert.equal(r.kept[0].text, "FM2 starts at 8.2 psia with 37% oxygen.");
  assert.equal(r.kept[0].flagged, false);
});

test("the same quote on the wrong page fails: the block is dropped and its text is not in the output", () => {
  const r = checkAnswer([nasa({ citations: [{ doc_id: DOC, page: 11, quote: QUOTE }], text: "SECRET WORDS 8.2 psia" })], ctx);
  assert.equal(r.kept.length, 0);
  assert.deepEqual(r.report.dropped, [{ index: 0, layer: "nasa", reason: "citation_quote_not_found" }]);
  assert.ok(!JSON.stringify(r).includes("SECRET WORDS"));
  assert.equal(citationProblem({ doc_id: DOC, page: 99, quote: QUOTE }, corpus), "page_not_found");
  assert.equal(citationProblem({ doc_id: "nasa/other/other.pdf", page: 10, quote: QUOTE }, corpus), "document_not_found");
  assert.equal(citationProblem({ doc_id: DOC, page: 10, quote: "psia" }, corpus), "quote_too_short");
  assert.equal(citationProblem({ doc_id: DOC, page: 0, quote: QUOTE }, corpus), "malformed");
  assert.equal(citationProblem({ doc_id: DOC, page: 10 }, corpus), "malformed");
});

test("1.5 against 15 fails: the letters match, the numbers as written do not", () => {
  // Page 11 says "15 psia"; a model quotes "1.5 psia".
  assert.ok(quoteFound("The vent pressure is 1.5 psia", corpus.get(DOC, 11)!.text), "the letters alone would pass");
  assert.equal(citationProblem({ doc_id: DOC, page: 11, quote: "The vent pressure is 1.5 psia" }, corpus), "numbers_not_found");
  const r = checkAnswer([nasa({ citations: [{ doc_id: DOC, page: 11, quote: "The vent pressure is 1.5 psia" }], text: "The vent pressure is 1.5 psia." })], ctx);
  assert.equal(r.kept.length, 0);
  assert.equal(r.report.dropped[0].reason, "citation_numbers_not_found");
  // And the other way: page 13 says 1.5 percent, the quote says 15 percent.
  assert.equal(citationProblem({ doc_id: DOC, page: 13, quote: "The limit is 15 percent of the burn" }, corpus), "numbers_not_found");
  assert.equal(citationProblem({ doc_id: DOC, page: 13, quote: "The limit is 1.5 percent of the burn" }, corpus), null);
});

test("one unverified citation drops the block even when another citation is good; a nasa block needs a citation", () => {
  const r = checkAnswer([nasa({ citations: [{ doc_id: DOC, page: 10, quote: QUOTE }, { doc_id: DOC, page: 11, quote: QUOTE }] }), nasa({ citations: [] }), nasa({ citations: undefined })], ctx);
  assert.equal(r.kept.length, 0);
  assert.deepEqual(r.report.dropped.map((d) => d.reason), ["citation_quote_not_found", "no_citation", "no_citation"]);
});

test("a number in a nasa block's own text that is not in its verified quote is removed by code", () => {
  const r = checkAnswer([nasa({ text: "FM2 starts at 8.2 psia, 37% oxygen and 99 minutes." })], ctx);
  assert.equal(r.kept[0].text, `FM2 starts at 8.2 psia, 37% oxygen and ${NUMBER_REMOVED} minutes.`);
  assert.equal(r.kept[0].flagged, true);
  assert.deepEqual(r.report.flaggedNumbers.map((f) => [f.index, f.layer, f.number]), [[0, "nasa", "99"]]);
});

test("expert: an untraced number is replaced by code and logged; the block is always labelled", () => {
  const r = checkAnswer([{ layer: "expert", text: "Burning is usually about 25 times faster at that oxygen level." }], ctx);
  assert.equal(r.kept.length, 1);
  assert.equal(r.kept[0].label, EXPERT_LABEL);
  assert.equal(r.kept[0].text, `Burning is usually about ${NUMBER_REMOVED} times faster at that oxygen level.`);
  assert.equal(r.kept[0].flagged, true);
  assert.deepEqual(r.report.flaggedNumbers, [{ index: 0, layer: "expert", number: "25", reason: "not from a tool result or a verified quote" }]);
});

test("expert: a number backed by a tool result it references passes; the same number without the reference does not", () => {
  const text = "At that cabin the oxygen partial pressure is about 2.79 psia (19.2 kPa).";
  const withRef = checkAnswer([{ layer: "expert", text, toolRefs: ["pp"] }], ctx);
  assert.equal(withRef.kept[0].text, text);
  assert.equal(withRef.kept[0].flagged, false);
  assert.match(withRef.kept[0].provenance[0], /computed by code/);
  const without = checkAnswer([{ layer: "expert", text }], ctx);
  assert.equal(without.kept[0].flagged, true);
  assert.deepEqual(without.report.flaggedNumbers.map((f) => f.number), ["2.79", "19.2"]);
  // A wrong number next to a right one: only the wrong one goes.
  const mixed = checkAnswer([{ layer: "expert", text: "The partial pressure is 2.79 psia, or 3.09 psia.", toolRefs: ["pp"] }], ctx);
  assert.equal(mixed.kept[0].text, `The partial pressure is 2.79 psia, or ${NUMBER_REMOVED} psia.`);
});

test("expert: a tool that failed backs nothing; an unknown reference drops the block", () => {
  const failed = checkAnswer([{ layer: "expert", text: "It is 19.2 kPa.", toolRefs: ["bad"] }], ctx);
  assert.equal(failed.kept[0].flagged, true);
  const unknown = checkAnswer([{ layer: "expert", text: "It is 19.2 kPa.", toolRefs: ["nope"] }], ctx);
  assert.equal(unknown.kept.length, 0);
  assert.equal(unknown.report.dropped[0].reason, "unknown_reference");
});

test("expert: a number may come from a verified nasa quote of the same answer, as written; identifiers and labels are not numbers", () => {
  const r = checkAnswer(
    [nasa(), { layer: "expert", text: "FM2 plans a chamber at 8.2 psia, the way PSI-25 and NASA-STD-6001B Test 1 do, and at 8.3 psia it would differ." }],
    ctx,
  );
  assert.equal(r.kept.length, 2);
  assert.equal(r.kept[1].text, `FM2 plans a chamber at 8.2 psia, the way PSI-25 and NASA-STD-6001B Test 1 do, and at ${NUMBER_REMOVED} psia it would differ.`);
  assert.deepEqual(r.report.flaggedNumbers.map((f) => f.number), ["8.3"]);
  // If the nasa block was dropped, its numbers back nothing.
  const dropped = checkAnswer([nasa({ citations: [{ doc_id: DOC, page: 11, quote: QUOTE }] }), { layer: "expert", text: "FM2 plans 8.2 psia." }], ctx);
  assert.deepEqual(dropped.report.flaggedNumbers.map((f) => f.number), ["8.2"]);
});

test("engine: only numbers and ids found in the referenced engine output; anything else drops the block", () => {
  const good: AnswerBlock = { layer: "engine", text: "PSI-23 is comparable at 70.3 kPa (10.2 psia), with 30 % oxygen.", toolRefs: ["answer"] };
  const r = checkAnswer([good], ctx);
  assert.equal(r.kept.length, 1, JSON.stringify(r.report));
  assert.equal(r.kept[0].label, EXPERT_LABEL);
  assert.equal(r.kept[0].layer, "expert");
  const wrongNumber = checkAnswer([{ ...good, text: "PSI-23 is comparable at 70.3 kPa, 12 psia." }], ctx);
  assert.deepEqual(wrongNumber.report.dropped, [{ index: 0, layer: "engine", reason: "number_not_in_engine_output", detail: "12" }]);
  const wrongId = checkAnswer([{ ...good, text: "PSI-24 is comparable." }], ctx);
  assert.equal(wrongId.report.dropped[0].reason, "id_not_in_engine_output");
  const wrongDoi = checkAnswer([{ ...good, text: "See doi:10.60555/zzzz-9999." }], ctx);
  assert.equal(wrongDoi.report.dropped[0].reason, "id_not_in_engine_output");
  assert.equal(checkAnswer([{ ...good, text: "See doi:10.60555/abcd-1234." }], ctx).kept.length, 1);
  assert.equal(checkAnswer([{ layer: "engine", text: "All fine." }], ctx).report.dropped[0].reason, "engine_block_without_reference");
  assert.equal(checkAnswer([{ ...good, toolRefs: ["missing"] }], ctx).report.dropped[0].reason, "unknown_engine_reference");
});

test("contradictory model prose never receives the computed-by-code label", () => {
  const result = checkAnswer([{ layer: "engine", text: "This condition is applicable and safe.", toolRefs: ["t1"] }], {
    corpus,
    engine: { t1: { verdict: "REGIME_BARRIER" } },
  });
  assert.equal(result.kept.length, 1);
  assert.equal(result.kept[0].layer, "expert");
  assert.equal(result.kept[0].label, EXPERT_LABEL);
});

test("1.5 against 15 in an engine or expert sentence: the written number must match, not the digits", () => {
  const out = checkAnswer([{ layer: "expert", text: "The vent is at 15 psia.", toolRefs: ["pp"] }], { ...ctx, tools: { pp: runCalculator("convertPressure", { value: 1.5, from: "psia", to: "psia" }) } });
  assert.equal(out.kept[0].flagged, true);
  assert.deepEqual(out.report.flaggedNumbers.map((f) => f.number), ["15"]);
});

test("malformed answers are refused without throwing", () => {
  assert.deepEqual(checkAnswer("just text", ctx).report.dropped, [{ index: -1, layer: "answer", reason: "malformed", detail: "the answer is not a list of blocks" }]);
  const r = checkAnswer([null, { layer: "wizard", text: "x" }, { layer: "expert", text: "" }, { layer: "expert" }, 7], ctx);
  assert.equal(r.kept.length, 0);
  assert.equal(r.report.dropped.length, 5);
  assert.ok(r.report.dropped.every((d) => d.reason === "malformed"));
});

test("the report carries dropped, flagged numbers and verified citations for the UI; kept blocks keep their order", () => {
  const r = checkAnswer(
    [nasa(), { layer: "expert", text: "That is 7 times." }, nasa({ citations: [{ doc_id: DOC, page: 12, quote: "wrong words that are not on the page at all" }] }), { layer: "engine", text: "Cabin at 30 %.", toolRefs: ["answer"] }],
    ctx,
  );
  assert.deepEqual(r.kept.map((k) => k.layer), ["nasa", "expert", "expert"]);
  assert.equal(r.report.dropped.length, 1);
  assert.equal(r.report.dropped[0].index, 2);
  assert.equal(r.report.flaggedNumbers.length, 1);
  assert.equal(r.report.verifiedCitations.length, 1);
});

test("corpus loading: jsonl lines are parsed, malformed lines are counted; ids resolve with or without the nasa/ prefix", () => {
  const { pages, skipped } = parseCorpusJsonl(`{"doc_id":"nasa/x/x.pdf","page":1,"text":"hello world, a long enough sentence"}\nnot json\n{"doc_id":"y"}\n\n`);
  assert.equal(pages.length, 1);
  assert.equal(skipped, 2);
  const c = corpusFromPages(pages);
  assert.ok(c.get("x/x.pdf", 1) && c.get("nasa/x/x.pdf", 1));
  assert.ok(c.hasDocument("x/x.pdf"));
});

// The strongest check, against the real corpus when the extraction session has built it.
const corpusFile = join(import.meta.dirname, "..", ".data", "corpus", "pages.jsonl");
test("real corpus: the FM2 chamber quote is verified on its page and fails one page earlier", { skip: !existsSync(corpusFile) }, () => {
  const { pages } = parseCorpusJsonl(readFileSync(corpusFile, "utf8"));
  const real = corpusFromPages(pages);
  const doc = pages.find((p) => p.doc_id.includes("ntrs-20260001966") && p.text.includes("Test 1: 8.2 psia"));
  assert.ok(doc, "the FM2 conditions page is in the corpus");
  const quote = "Test 1: 8.2 psia (+/- 0.3 psi), 37% O2 , balance nitrogen";
  assert.equal(citationProblem({ doc_id: doc.doc_id, page: doc.page, quote }, real), null);
  assert.equal(citationProblem({ doc_id: doc.doc_id, page: doc.page - 1, quote }, real), "quote_not_found");
  assert.equal(citationProblem({ doc_id: doc.doc_id, page: doc.page, quote: "Test 1: 82 psia (+/- 0.3 psi), 37% O2 , balance nitrogen" }, real), "numbers_not_found");
});

test("engine blocks carry provenance: arithmetic is recognised as computed by code", () => {
  const calc = runCalculator("o2PartialPressure", { o2: "34 %", pressure: "8.2 psia" });
  assert.ok(calc.ok);
  // Calculator result registered in ctx.tools (the full ToolResult) ...
  const a = checkAnswer([{ layer: "engine", text: "Oxygen partial pressure = 34 % x 56.54 kPa (8.2 psia) = 19.22 kPa (2.788 psia).", toolRefs: ["pp"] }], { corpus, engine: { pp: { numbers: calc.numbers, display: calc.display } }, tools: { pp: calc } });
  assert.equal(a.kept.length, 1);
  assert.match(a.kept[0].provenance[0], /computed by code/);
  assert.match(a.kept[0].provenance[0], /19\.22 kPa \(2\.788 psia\)/);
  // ... or only as the engine dictionary entry the agent writes ({display, value, unit, also, numbers}), and for plain engine outputs.
  const b = checkAnswer([{ layer: "engine", text: "Oxygen partial pressure = 34 % x 56.54 kPa (8.2 psia) = 19.22 kPa (2.788 psia).", toolRefs: ["t1"] }], { corpus, engine: { t1: { display: calc.display, value: calc.value, unit: calc.unit, also: calc.also, numbers: calc.numbers } } });
  assert.match(b.kept[0].provenance[0], /computed by code \(calculator result "t1"\)/);
  const c = checkAnswer([{ layer: "engine", text: "Cabin at 30 %.", toolRefs: ["answer"] }], ctx);
  assert.match(c.kept[0].provenance[0], /computed by code \(PYRION engine\)/);
});

test("scrubNumbers replaces what is not from a source and keeps what is", () => {
  const r = scrubNumbers("It is 8.2 psia, not 9 psia.", [8.2]);
  assert.equal(r.text, `It is 8.2 psia, not ${NUMBER_REMOVED} psia.`);
  assert.deepEqual(r.removed, ["9"]);
});
