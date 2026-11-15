import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { helpIdsIn, isInteractive, scanTags } from "../lib/help-scan.ts";
import { loadTopicsSync } from "../lib/tars/topics-sync.ts";

const root = join(import.meta.dirname, "..");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? (n === "api" ? [] : walk(p)) : p.endsWith(".tsx") ? [p] : [];
});
const files = [...walk(join(root, "components")), ...walk(join(root, "app"))];
const rel = (f: string) => f.replace(root, "").replaceAll("\\", "/");

const topicList = loadTopicsSync();
const topics = new Map(topicList.map((t) => [t.id, t]));
/** Every data-help id some topic lists in its dataHelp. */
const covered = new Set(topicList.flatMap((t) => t.dataHelp ?? []));

test("every interactive element carries a data-help id", () => {
  const missing: string[] = [];
  let tagged = 0;
  for (const f of files) {
    for (const t of scanTags(readFileSync(f, "utf8"))) {
      if (!isInteractive(t)) continue;
      if (t.help) tagged++;
      else missing.push(`${rel(f)}:${t.line} <${t.name}> ${t.after.slice(0, 40)}`);
    }
  }
  assert.deepEqual(missing, [], `${missing.length} interactive elements have no data-help`);
  assert.ok(tagged > 100);
});

test("every data-help id is covered by some topic's dataHelp list", () => {
  const used = new Map<string, string>();
  for (const f of files) for (const id of helpIdsIn(readFileSync(f, "utf8"))) used.set(id, rel(f));
  const missing = [...used].filter(([id]) => !covered.has(id)).map(([id, f]) => `${id} (${f})`);
  assert.deepEqual(missing, [], `${missing.length} ids no topic covers`);
});

test("topic ids are unique, and a topic about one element has the five labelled parts", () => {
  assert.equal(topics.size, topicList.length, "duplicate topic ids");
  const bad: string[] = [];
  for (const t of topicList) {
    if (!(t.dataHelp?.length === 1 && t.dataHelp[0] === t.id)) continue;
    for (const part of ["What it is:", "What it shows:", "How to use it:", "Example:", "What it does not do:"]) if (!t.body.includes(part)) bad.push(`${t.id} lacks "${part}"`);
  }
  assert.deepEqual(bad, []);
});

test("dataHelp entries that match no element are reported (not a failure: a topic may cover planned elements)", () => {
  const used = new Set<string>();
  for (const f of files) for (const id of helpIdsIn(readFileSync(f, "utf8"))) used.add(id);
  const stale = topicList.flatMap((t) => (t.dataHelp ?? []).filter((id) => !used.has(id)).map((id) => `${t.id} -> ${id}`));
  if (stale.length) console.warn(`[help] dataHelp ids that no element carries (fix the topic or tag the element): ${stale.join(", ")}`);
});
