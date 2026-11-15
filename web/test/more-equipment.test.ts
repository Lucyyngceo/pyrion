// Grok round 7: the "Fire-safety equipment & Earth" cards of /more and the ?leg= filter of /lenses.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  CHALLENGE_SENTENCES,
  CHALLENGE_SOURCE,
  EQUIPMENT_CARDS,
  EQUIPMENT_INTRO,
  LENS_LEGS,
  equipmentSourceLabel,
  lensFilterHref,
  parseLeg,
} from "../lib/lenses/equipment.ts";
import { sourceLabel, type LensesFile, type ProfileLike } from "../lib/lenses/model.ts";

const web = join(import.meta.dirname, "..");
const repo = join(web, "..");
const data = join(repo, "data");
const norm = (s: string) => s.replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").trim();
const profiles = JSON.parse(readFileSync(join(data, "derived", "investigation_profiles.json"), "utf8")) as (ProfileLike & { fields: Record<string, { value: string | null } | undefined> })[];
const lenses = JSON.parse(readFileSync(join(data, "derived", "lenses.json"), "utf8")) as LensesFile;
const manifest = readFileSync(join(data, "manifest", "investigations.csv"), "utf8").split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(",")[0]);
const psiJson = (acc: string) => join(data, "raw", "psi-data", acc, "_investigation", `${acc}.json`);
const challengeFile = process.env.PYRION_CHALLENGE ?? join(repo, "..", "Pyrion NASA", ".claude", "skills", "pyrion-flame", "references", "reto-oficial.md");
const allQuotes = [EQUIPMENT_INTRO, ...EQUIPMENT_CARDS.flatMap((c) => c.quotes)];

test("three cards, one per safety leg, each with quotes and investigation links", () => {
  assert.deepEqual(EQUIPMENT_CARDS.map((c) => c.leg).sort(), ["detection", "prevention", "suppression"]);
  for (const c of EQUIPMENT_CARDS) {
    assert.ok(c.quotes.length >= 2, c.leg);
    assert.ok(c.investigations.length >= 1, c.leg);
  }
  const ids = (leg: string) => EQUIPMENT_CARDS.find((c) => c.leg === leg)!.investigations;
  assert.deepEqual(ids("detection"), ["PSI-102", "PSI-101"]); // SAME, SAME-R
  assert.deepEqual(ids("suppression"), ["PSI-69"]); // FLEX
  assert.deepEqual(ids("prevention"), ["PSI-26", "PSI-25", "PSI-98", "PSI-99", "PSI-100"]); // BASS, BASS-II, Saffire-I/II/III
});

test("every quote names its source", () => {
  for (const q of allQuotes) {
    assert.ok(q.text.trim().length > 20, q.text);
    const label = equipmentSourceLabel(q.source);
    if (q.source.kind === "psi") assert.match(label, new RegExp(`^PSI record ${q.source.accession}, field ${q.source.field}$`));
    else assert.equal(label, CHALLENGE_SOURCE);
  }
  assert.equal(CHALLENGE_SOURCE, "NASA Space Apps 2026 challenge statement");
});

test("challenge quotes are whole sentences of the challenge statement, or marked as part of one", () => {
  for (const q of allQuotes) {
    if (q.source.kind !== "challenge") continue;
    if (q.excerpt) assert.ok(CHALLENGE_SENTENCES.some((s) => norm(s).includes(norm(q.text))), q.text);
    else assert.ok(CHALLENGE_SENTENCES.some((s) => norm(s) === norm(q.text)), q.text);
  }
});

test("the challenge sentences are word for word in the project's copy of the statement (when present)", { skip: !existsSync(challengeFile) && "challenge copy not present" }, () => {
  const copy = norm(readFileSync(challengeFile, "utf8").replace(/^>\s?/gm, ""));
  for (const s of CHALLENGE_SENTENCES) assert.ok(copy.includes(norm(s)), s);
});

test("PSI quotes are word for word in their PSI record field (profiles; and the PSI JSON when present)", () => {
  for (const q of allQuotes) {
    if (q.source.kind !== "psi") continue;
    const { accession, field } = q.source;
    const p = profiles.find((x) => x.accession === accession);
    assert.ok(p, accession);
    assert.ok(norm(p.fields[field]?.value ?? "").includes(norm(q.text)), `${accession} ${field}: ${q.text}`);
    if (existsSync(psiJson(accession))) {
      const d = JSON.parse(readFileSync(psiJson(accession), "utf8"));
      const rec = Array.isArray(d) ? d[0] : d;
      assert.ok(norm(String(rec[field] ?? "")).includes(norm(q.text)), `${accession} ${field} not in PSI JSON`);
    }
  }
});

test("investigation links point to existing investigation pages", () => {
  for (const c of EQUIPMENT_CARDS)
    for (const id of c.investigations) {
      assert.ok(manifest.includes(id), `${id} not in data/manifest/investigations.csv`);
      assert.ok(profiles.some((p) => p.accession === id), `${id} has no /investigations page (no profile)`);
    }
});

test("lens filter links and ?leg= parsing", () => {
  assert.deepEqual([...LENS_LEGS].sort(), [...lenses.axes.legs].sort());
  for (const c of EQUIPMENT_CARDS) {
    assert.equal(lensFilterHref(c.leg), `/lenses?leg=${c.leg}`);
    assert.equal(parseLeg(c.leg), c.leg);
    // every linked investigation shows up under that leg's filter, or is at least in the matrix
    assert.ok(c.investigations.every((id) => lenses.investigations.some((i) => i.accession === id)));
  }
  assert.equal(parseLeg(undefined), null);
  assert.equal(parseLeg("ignition"), null);
  assert.equal(parseLeg(["detection", "x"]), "detection");
  const detection = lenses.investigations.filter((i) => i.legs.detection.length > 0).map((i) => i.accession);
  for (const id of ["PSI-101", "PSI-102"]) assert.ok(detection.includes(id), id);
});

test("challenge sources are shown as the challenge statement, never as a local copy", () => {
  assert.equal(sourceLabel({ kind: "challenge", file: "x", line: 22 }), "NASA Space Apps 2026 challenge statement");
  for (const f of ["app/more/page.tsx", "app/lenses/page.tsx", "lib/lenses/equipment.ts", "lib/lenses/model.ts"]) {
    const t = readFileSync(join(web, f), "utf8");
    assert.ok(!/reto-oficial|of the copy/.test(t), f);
  }
});

test("the /more page renders the cards and tags every new link with a help topic", () => {
  const more = readFileSync(join(web, "app", "more", "page.tsx"), "utf8");
  assert.match(more, /EQUIPMENT_CARDS\.map/);
  assert.match(more, /data-help="more-equipment-link"/);
  assert.match(more, /This page shows which PSI combustion investigations/);
  const lensesPage = readFileSync(join(web, "app", "lenses", "page.tsx"), "utf8");
  assert.match(lensesPage, /data-help="lenses-leg-filter"/);
  assert.match(lensesPage, /This page is for finding/);
  for (const h of ["content/help/more/more-equipment-link.md", "content/help/lenses/lenses-leg-filter.md"]) assert.ok(existsSync(join(web, h)), h);
});

test("no banned overclaim words in the new text", () => {
  const files = ["lib/lenses/equipment.ts", "app/more/page.tsx", "app/lenses/page.tsx", "content/help/more/more-equipment-link.md", "content/help/lenses/lenses-leg-filter.md"];
  const banned = [/\bsafe\b/i, /\bvalidated\b/i, /\bfirst\b/i, /\bproves?\b/i, /\bdiscovery\b/i, /NASA-approved/i, /no data exists/i, /(?<![a-z-])expert(?![a-z-])/i];
  for (const f of files) {
    const t = readFileSync(join(web, f), "utf8");
    for (const w of banned) assert.ok(!w.test(t), `${f}: ${w}`);
  }
  for (const q of allQuotes) for (const w of banned) assert.ok(!w.test(q.text), `quote: ${q.text}`);
});
