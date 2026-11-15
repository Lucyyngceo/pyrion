import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { helpIdsIn, isInteractive, scanTags } from "../lib/help-scan.ts";
import { parseTopic } from "../lib/tars/help.ts";

const root = join(import.meta.dirname, "..");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? (n === "api" ? [] : walk(p)) : p.endsWith(".tsx") ? [p] : [];
});
const files = [...walk(join(root, "components")), ...walk(join(root, "app"))];
const rel = (f: string) => f.replace(root, "").replaceAll("\\", "/");

const topicDir = join(root, "content", "help");
const topicFiles = readdirSync(topicDir).filter((n) => n.endsWith(".md"));
const topics = new Map(topicFiles.map((n) => [n.replace(/\.md$/, ""), parseTopic(n.replace(/\.md$/, ""), readFileSync(join(topicDir, n), "utf8"))]));

/** The first topics, written as page overviews before the element topics; they follow the older, looser format. */
const LEGACY = new Set(["what-is-pyrion", "envelope-page", "scenario-tiles", "verdicts", "extrapolation-levels", "navigator-take-me-there", "evidence-map", "full-screen-chart", "ask-box", "ai-limits", "data-and-sources", "add-a-source", "bridge", "sealed-predictions", "glossary"]);

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

test("every data-help id has a topic file", () => {
  const used = new Map<string, string>();
  for (const f of files) for (const id of helpIdsIn(readFileSync(f, "utf8"))) used.set(id, rel(f));
  const missing = [...used].filter(([id]) => !topics.has(id)).map(([id, f]) => `${id} (${f})`);
  assert.deepEqual(missing, [], `${missing.length} ids without a topic file`);
});

test("every element topic is used by the UI, and has the five labelled parts", () => {
  const used = new Set<string>();
  for (const f of files) for (const id of helpIdsIn(readFileSync(f, "utf8"))) used.add(id);
  const orphans = [...topics.keys()].filter((id) => !LEGACY.has(id) && !used.has(id));
  assert.deepEqual(orphans, [], "topic files that no element points at");
  const bad: string[] = [];
  for (const [id, t] of topics) {
    if (LEGACY.has(id)) continue;
    for (const part of ["What it is:", "What it shows:", "How to use it:", "Example:", "What it does not do:"]) if (!t.body.includes(part)) bad.push(`${id} lacks "${part}"`);
  }
  assert.deepEqual(bad, []);
});
