import assert from "node:assert/strict";
import { test } from "node:test";
import { createBusyGate, createTarsStream, splitLines, type ReviewStatus } from "../lib/tars/stream.ts";

const line = (o: unknown) => JSON.stringify(o);

test("the conversation is released when the primary answer arrives, before the second opinion", () => {
  const log: string[] = [];
  const s = createTarsStream<{ blocks: unknown[] }, { verdict: string }>({
    onStatus: (t) => log.push(`status:${t}`),
    onResult: () => log.push("result (conversation free)"),
    onReview: (r, sk) => log.push(`review:${r}${sk ? `:${sk.verdict}` : ""}`),
  });
  s.push(line({ type: "status", text: "Checking the engine…" }));
  s.push(line({ type: "result", blocks: [] }));
  assert.equal(s.primaryDone, true);
  // While the review runs, the answer is already shown and the visitor may ask again.
  s.push(line({ type: "status", text: "Asking for a second opinion…" }));
  assert.equal(s.review, "pending");
  s.push(line({ type: "skeptic", skeptic: { verdict: "agree", objections: [] } }));
  s.end();
  assert.deepEqual(log, ["status:Checking the engine…", "result (conversation free)", "review:pending", "review:done:agree"]);
});

test("status lines after the answer never replace the global status (they belong to the review)", () => {
  const statuses: (string | null)[] = [];
  const s = createTarsStream({ onStatus: (t) => statuses.push(t), onResult: () => {} });
  s.push(line({ type: "result", blocks: [] }));
  s.push(line({ type: "status", text: "Asking for a second opinion…" }));
  assert.deepEqual(statuses, []);
});

test("a review announced but never delivered ends as unavailable, not as agreement", () => {
  const reviews: ReviewStatus[] = [];
  const s = createTarsStream({ onResult: () => {}, onReview: (r) => reviews.push(r) });
  s.push(line({ type: "result", blocks: [] }));
  s.push(line({ type: "status", text: "Asking for a second opinion…" }));
  s.end();
  assert.deepEqual(reviews, ["pending", "unavailable"]);
});

test("an unavailable second opinion from the server is reported as unavailable", () => {
  const reviews: ReviewStatus[] = [];
  const s = createTarsStream({ onResult: () => {}, onReview: (r) => reviews.push(r) });
  s.push(line({ type: "result", blocks: [] }));
  s.push(line({ type: "skeptic", skeptic: { verdict: "unavailable", objections: [] } }));
  assert.deepEqual(reviews, ["unavailable"]);
});

test("without a second opinion there is no review state, and malformed lines are ignored", () => {
  const reviews: ReviewStatus[] = [];
  let results = 0;
  const s = createTarsStream({ onResult: () => results++, onReview: (r) => reviews.push(r) });
  s.push("not json");
  s.push("");
  s.push(line({ type: "result", blocks: [] }));
  s.end();
  assert.equal(results, 1);
  assert.deepEqual(reviews, []);
  assert.equal(s.review, "none");
});

test("a skeptic event before any answer is ignored", () => {
  const reviews: ReviewStatus[] = [];
  const s = createTarsStream({ onResult: () => {}, onReview: (r) => reviews.push(r) });
  s.push(line({ type: "skeptic", skeptic: { verdict: "object", objections: [] } }));
  assert.deepEqual(reviews, []);
});

test("splitLines keeps an unfinished line for the next chunk", () => {
  assert.deepEqual(splitLines('{"a":1}\n{"b"'), { lines: ['{"a":1}'], rest: '{"b"' });
  assert.deepEqual(splitLines('{"a":1}\n'), { lines: ['{"a":1}'], rest: "" });
});

test("busy gate: an earlier request finishing later does not unlock a newer one", () => {
  const states: boolean[] = [];
  const gate = createBusyGate((b) => states.push(b));
  const first = gate.begin();
  assert.equal(gate.release(first), true); // primary answer of question 1 arrived: free
  const second = gate.begin(); // question 2 sent while question 1's review is still streaming
  assert.equal(gate.release(first), false); // question 1's stream ends: must not unlock question 2
  assert.equal(states.at(-1), true);
  assert.equal(gate.release(second), true);
  assert.deepEqual(states, [true, false, true, false]);
});

test("busy gate: the same request releases only once (answer, then end of stream)", () => {
  const states: boolean[] = [];
  const gate = createBusyGate((b) => states.push(b));
  const t = gate.begin();
  assert.equal(gate.release(t), true);
  assert.equal(gate.release(t), false);
  assert.deepEqual(states, [true, false]);
});
