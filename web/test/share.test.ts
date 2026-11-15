import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeShare, encodeShare } from "../lib/tars/share.ts";

const target = { regime: { gravity_regime: "microgravity" }, continuous: { o2_mole_fraction: 0.34, pressure: 56.5 } };

test("a shared link round-trips the question (with accents), the condition and the fingerprint", () => {
  const fp = "a".repeat(64);
  const raw = encodeShare({ q: "¿Qué pasa a 34 % de oxígeno?", t: target, fp });
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeShare(raw), { q: "¿Qué pasa a 34 % de oxígeno?", t: target, fp });
});

test("a malformed or foreign payload is refused, and a bad fingerprint is dropped", () => {
  assert.equal(decodeShare("not base64 !!"), null);
  assert.equal(decodeShare(encodeShare({ q: "x", t: null as unknown as object })), null);
  assert.equal(decodeShare(encodeShare({ q: "x", t: target, fp: "zz" }))?.fp, undefined);
});
