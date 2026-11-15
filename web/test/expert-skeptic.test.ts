import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAnswer, corpusFromPages, NUMBER_REMOVED, type AnswerBlock } from "../lib/expert/claims.ts";
import { extractJson, modelFamily, reviewerPreference, type AskModel, type ModelRequest } from "../lib/expert/model.ts";
import { reviewSecondOpinion } from "../lib/expert/skeptic.ts";

const DOC = "nasa/test-doc/test-doc.pdf";
const corpus = corpusFromPages([
  { doc_id: DOC, page: 10, title: "Test document", url: "https://example.org/test-doc.pdf", text: "Test 1: 8.2 psia (+/- 0.3 psi), 37% O2 , balance nitrogen. The chamber volume is 14.4 L." },
  { doc_id: DOC, page: 11, title: "Test document", url: "https://example.org/test-doc.pdf", text: "A different page about ignition by hot wire at the bottom of the sample." },
]);
const QUOTE = "Test 1: 8.2 psia (+/- 0.3 psi), 37% O2 , balance nitrogen";
const blocks: AnswerBlock[] = [
  { layer: "nasa", text: "FM2 starts at 8.2 psia with 37% oxygen.", citations: [{ doc_id: DOC, page: 10, quote: QUOTE }] },
  { layer: "expert", text: "That atmosphere is richer in oxygen than the cabin air." },
];
const checked = checkAnswer(blocks, { corpus }).kept;
const deepFreeze = <T,>(o: T): T => {
  Object.values(o as object).forEach((v) => v && typeof v === "object" && deepFreeze(v));
  return Object.freeze(o);
};

const stub = (text: string, model = "mistralai/mistral-small-3.2-24b-instruct", seen?: ModelRequest[]): AskModel => async (req) => {
  seen?.push(req);
  return { text, model, name: model === "mistralai/mistral-small-3.2-24b-instruct" ? "Mistral Small 3.2" : undefined };
};

test("model families and the reviewer preference: never the family that wrote the answer, Nemotron first otherwise", () => {
  assert.equal(modelFamily("nvidia/nemotron-3-ultra-550b-a55b"), "nemotron");
  assert.equal(modelFamily("mistralai/mistral-small-3.2-24b-instruct"), "mistral");
  assert.equal(modelFamily("openai/gpt-oss-120b"), "gpt-oss");
  assert.equal(modelFamily("acme/foo"), "acme");
  assert.equal(modelFamily(null), "unknown");
  assert.deepEqual(reviewerPreference("openai/gpt-oss-120b")[0], "nvidia/nemotron-3-ultra-550b-a55b");
  assert.ok(!reviewerPreference("openai/gpt-oss-120b").some((m) => modelFamily(m) === "gpt-oss"));
  const fromNemotron = reviewerPreference("nvidia/nemotron-3-ultra-550b-a55b");
  assert.equal(fromNemotron[0], "google/gemma-4-31b-it");
  assert.deepEqual(fromNemotron.slice(0, 2), ["google/gemma-4-31b-it", "mistralai/mistral-small-3.2-24b-instruct"]);
  assert.deepEqual(reviewerPreference("nvidia/nemotron-3-ultra-550b-a55b", ["google/gemma-4-31b-it"]), ["google/gemma-4-31b-it"]);
});

test("extractJson finds the first JSON value in prose and code fences", () => {
  assert.deepEqual(extractJson('Sure! ```json\n{"a":[1,2,{"b":"}"}]}\n``` done'), { a: [1, 2, { b: "}" }] });
  assert.deepEqual(extractJson("[1,2]"), [1, 2]);
  assert.equal(extractJson("no json here"), null);
  assert.equal(extractJson("{broken"), null);
});

test("agree: the reviewer found nothing; the model is named; the answer is untouched", async () => {
  const frozen = deepFreeze(structuredClone(checked));
  const seen: ModelRequest[] = [];
  const r = await reviewSecondOpinion("What does FM2 plan?", frozen, { corpus, answeredBy: "nvidia/nemotron-3-ultra-550b-a55b", askModel: stub('{"verdict":"agree","objections":[]}', "mistralai/mistral-small-3.2-24b-instruct", seen) });
  assert.equal(r.verdict, "agree");
  assert.deepEqual(r.objections, []);
  assert.deepEqual(r.model, { model: "mistralai/mistral-small-3.2-24b-instruct", name: "Mistral Small 3.2", family: "mistral" });
  assert.equal(r.answeredBy, "nvidia/nemotron-3-ultra-550b-a55b");
  assert.deepEqual(checked, structuredClone(frozen), "the answer was not changed");
  // The request asked for another family and listed the preference without Nemotron.
  assert.deepEqual(seen[0].avoidFamilies, ["nemotron"]);
  assert.equal(seen[0].prefer[0], "google/gemma-4-31b-it");
  assert.match(seen[0].messages[1].content, /"blockIndex":0/);
});

test("object: an objection that points to a block, with a NASA quote verified on its page", async () => {
  const reply = JSON.stringify({ verdict: "object", objections: [{ blockIndex: 0, reason: "The quote gives 8.2 psia but says nothing about a limit.", citation: { doc_id: DOC, page: 10, quote: "The chamber volume is 14.4 L" } }] });
  const r = await reviewSecondOpinion("q", checked, { corpus, answeredBy: "openai/gpt-oss-120b", askModel: stub(reply, "nvidia/nemotron-3-ultra-550b-a55b") });
  assert.equal(r.verdict, "object");
  assert.equal(r.objections.length, 1);
  assert.equal(r.objections[0].blockIndex, 0);
  assert.equal(r.objections[0].citation?.url, "https://example.org/test-doc.pdf");
  assert.equal(r.objections[0].citation?.page, 10);
  assert.equal(r.model?.family, "nemotron");
});

test("an objection must point to a block: a missing or out-of-range index is dropped", async () => {
  const reply = JSON.stringify({ verdict: "object", objections: [{ reason: "no index" }, { blockIndex: 7, reason: "no such block" }, { blockIndex: -1, reason: "negative" }, { blockIndex: 1, reason: "The expert block is vague." }] });
  const r = await reviewSecondOpinion("q", checked, { corpus, askModel: stub(reply) });
  assert.deepEqual(r.objections.map((o) => o.blockIndex), [1]);
  assert.equal(r.dropped.filter((d) => d.kind === "objection").length, 3);
});

test("an unverified objection citation is dropped; the objection stays without it", async () => {
  const reply = JSON.stringify({
    verdict: "object",
    objections: [
      { blockIndex: 0, reason: "Wrong page.", citation: { doc_id: DOC, page: 11, quote: "The chamber volume is 14.4 L" } },
      { blockIndex: 0, reason: "Invented words.", citation: { doc_id: DOC, page: 10, quote: "NASA says this cabin atmosphere is completely safe for crews" } },
      { blockIndex: 1, reason: "Number differs.", citation: { doc_id: DOC, page: 10, quote: "The chamber volume is 1.4 L" } },
    ],
  });
  const r = await reviewSecondOpinion("q", checked, { corpus, askModel: stub(reply) });
  assert.equal(r.verdict, "object");
  assert.equal(r.objections.length, 3);
  assert.ok(r.objections.every((o) => o.citation === undefined));
  assert.deepEqual(r.dropped.map((d) => d.kind), ["citation", "citation", "citation"]);
  assert.match(r.dropped[2].reason, /not_found/);
});

test("the reviewer's wording is scrubbed: numbers that are not in the answer are removed, codes become words", async () => {
  const reply = JSON.stringify({ verdict: "object", objections: [{ blockIndex: 0, reason: "It says 8.2 psia but NASA used 9 psia, and the verdict is REGIME_BARRIER for o2_mole_fraction." }] });
  const r = await reviewSecondOpinion("q", checked, { corpus, askModel: stub(reply) });
  assert.equal(r.objections[0].reason, `It says 8.2 psia but NASA used ${NUMBER_REMOVED} psia, and the verdict is regime barrier for o2 mole fraction.`);
});

test("it said object but nothing could be shown: unavailable, never a silent agree", async () => {
  const r = await reviewSecondOpinion("q", checked, { corpus, askModel: stub('{"verdict":"object","objections":[{"blockIndex":9,"reason":"x"}]}') });
  assert.equal(r.verdict, "unavailable");
  assert.match(r.note ?? "", /none of its objections could be checked/);
});

test("the reviewer must be of another family, also after the app's own fallback", async () => {
  const r = await reviewSecondOpinion("q", checked, { corpus, answeredBy: "nvidia/nemotron-3-ultra-550b-a55b", askModel: stub('{"verdict":"agree","objections":[]}', "nvidia/nemotron-3-ultra-550b-a55b") });
  assert.equal(r.verdict, "unavailable");
  assert.match(r.note ?? "", /same family/);
  assert.equal(r.model?.family, "nemotron");
});

test("unavailable when the model fails, returns text that is not JSON, there is no answer, or no other family is available", async () => {
  const boom: AskModel = async () => {
    throw new Error("no model");
  };
  assert.equal((await reviewSecondOpinion("q", checked, { corpus, askModel: boom })).verdict, "unavailable");
  const bad = await reviewSecondOpinion("q", checked, { corpus, askModel: stub("I think it is fine.") });
  assert.equal(bad.verdict, "unavailable");
  assert.equal(bad.model?.family, "mistral");
  assert.equal((await reviewSecondOpinion("q", [], { corpus, askModel: stub("{}") })).verdict, "unavailable");
  const none = await reviewSecondOpinion("q", checked, { corpus, answeredBy: "openai/gpt-oss-120b", available: ["openai/gpt-oss-120b"], askModel: stub("{}") });
  assert.equal(none.verdict, "unavailable");
  assert.match(none.note ?? "", /another family/);
});
