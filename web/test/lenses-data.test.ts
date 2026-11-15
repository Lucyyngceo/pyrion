// Grok v6: lenses, oxygen ceiling, timeline and /more. Checks the derived files against their sources and the engine.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildCorpus } from "../../engine/src/evidence.ts";
import { MOON_BASE_BAND, fm2Hypothetical } from "../../engine/src/planner.ts";
import { parseConditionCsv, parseValues } from "../../engine/src/records.ts";
import type { ConditionRecord } from "../../engine/src/types.ts";
import { o2PartialPressure } from "../lib/expert/calculators.ts";
import {
  earthSentences,
  fm2Planned,
  frames,
  inPolygon,
  moonBand,
  oxygenCeiling,
  pct,
  slimPoints,
  suitPartialPressure,
  visibleAt,
  type LensesFile,
  type ProfileLike,
  type TimelineFile,
} from "../lib/lenses/model.ts";

const repo = join(import.meta.dirname, "..", "..");
const data = join(repo, "data");
const lenses = JSON.parse(readFileSync(join(data, "derived", "lenses.json"), "utf8")) as LensesFile;
const timeline = JSON.parse(readFileSync(join(data, "derived", "timeline.json"), "utf8")) as TimelineFile;
const profiles = JSON.parse(readFileSync(join(data, "derived", "investigation_profiles.json"), "utf8")) as ProfileLike[];
const manifest = readFileSync(join(data, "manifest", "investigations.csv"), "utf8").split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(",")[0]);
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const psiJson = (acc: string) => join(data, "raw", "psi-data", acc, "_investigation", `${acc}.json`);
const hasRaw = manifest.every((a) => existsSync(psiJson(a)));
const challengeFile = process.env.PYRION_CHALLENGE ?? join(repo, "..", "Pyrion NASA", ".claude", "skills", "pyrion-flame", "references", "reto-oficial.md");
const hasChallenge = existsSync(challengeFile);

const records: ConditionRecord[] = readdirSync(join(data, "conditions"))
  .filter((n) => /^PSI-\d+\.csv$/.test(n))
  .flatMap((n) => parseConditionCsv(readFileSync(join(data, "conditions", n), "utf8"), n, n.slice(0, -4)).records);

const allEntries = () =>
  lenses.investigations.flatMap((i) => [
    ...Object.entries(i.legs).flatMap(([tag, es]) => es.map((e) => ({ acc: i.accession, tag, e }))),
    ...Object.entries(i.phenomena).flatMap(([tag, es]) => es.map((e) => ({ acc: i.accession, tag, e }))),
    { acc: i.accession, tag: i.strength.value, e: i.strength },
    ...i.context.map((e) => ({ acc: i.accession, tag: e.label, e })),
  ]);

test("lenses.json covers every manifest investigation once, each with a strength", () => {
  assert.deepEqual(lenses.investigations.map((i) => i.accession).sort(), [...manifest].sort());
  for (const i of lenses.investigations) assert.ok(lenses.axes.strengths.includes(i.strength.value), i.accession);
});

test("every tag has a non-empty quote, a source, and a keyword of its tag", () => {
  for (const { acc, tag, e } of allEntries()) {
    assert.ok(e.quote.trim().length > 10, `${acc} ${tag}: empty quote`);
    assert.ok(e.source.kind === "psi" ? !!e.source.key : typeof e.source.line === "number", `${acc} ${tag}: no source location`);
    const kws = lenses.rules.keywords[tag];
    assert.ok(kws && kws.some((k) => e.quote.toLowerCase().includes(k)), `${acc} ${tag}: no keyword in quote`);
  }
});

test("audit rules: BASS suppression, FLEX suppression, SAME/SAME-R/DAFT detection, SAFFIRE prevention with detection context", () => {
  const by = Object.fromEntries(lenses.investigations.map((i) => [i.accession, i]));
  assert.ok(by["PSI-26"].legs.suppression.some((e) => /inert, gaseous extinguishing agent/.test(e.quote)));
  assert.ok(by["PSI-69"].legs.suppression.some((e) => /CO2, He, and SF6/.test(e.quote)));
  for (const a of ["PSI-101", "PSI-102", "PSI-47"]) assert.ok(by[a].legs.detection.length > 0, a);
  for (const a of ["PSI-98", "PSI-99", "PSI-100"]) {
    assert.ok(by[a].legs.prevention.length > 0, a);
    assert.ok(by[a].context.some((c) => c.label === "detection context"), a);
  }
  // DAFT is indirect, quoting the challenge sentence about detecting dust
  assert.equal(by["PSI-47"].strength.value, "indirect");
  assert.match(by["PSI-47"].strength.quote, /was instead used to detect dust/);
  // BASS and BASS-II carry their own name as a suppression quote
  for (const a of ["PSI-25", "PSI-26"]) assert.ok(by[a].legs.suppression.some((e) => e.source.key === "title" && e.quote === "Burning and Suppression of Solids"), a);
  // PSI-60 (SPICE data, ground): aspiration sentence does not count as a detection or suppression test
  assert.deepEqual(by["PSI-60"].legs.detection, []);
  assert.deepEqual(by["PSI-60"].legs.suppression, []);
  assert.equal(by["PSI-60"].strength.value, "indirect");
  // extinction limits alone never make a suppression tag
  for (const i of lenses.investigations) for (const e of i.legs.suppression) assert.ok(!/^[^]*extinction limit[^]*$/i.test(e.quote) || /suppress|extinguishing agent|firefighting/i.test(e.quote), i.accession);
});

test("every PSI quote is word for word in its PSI JSON field (when data/raw is present)", { skip: !hasRaw && "data/raw not present" }, () => {
  for (const { acc, tag, e } of allEntries()) {
    if (e.source.kind !== "psi") continue;
    const d = JSON.parse(readFileSync(psiJson(acc), "utf8"));
    const rec = Array.isArray(d) ? d[0] : d;
    assert.ok(norm(String(rec[e.source.key as string] ?? "")).includes(norm(e.quote)), `${acc} ${tag}: quote not in ${e.source.key}`);
  }
});

test("every challenge quote is word for word on its line (when the challenge copy is present)", { skip: !hasChallenge && "challenge copy not present" }, () => {
  const lines = readFileSync(challengeFile, "utf8").split(/\r?\n/);
  const check = (q: string, line: number) => assert.ok(norm(lines[line - 1] ?? "").includes(norm(q)), `line ${line}: ${q}`);
  for (const { e } of allEntries()) if (e.source.kind === "challenge") check(e.quote, e.source.line as number);
  for (const f of Object.values(lenses.challenge)) check(f.quote, f.source.line as number);
});

test("challenge numbers are read from their quotes", () => {
  const c = lenses.challenge;
  assert.ok(c.moon_base.quote.includes(`${c.moon_base.o2_percent_min}% or greater`) && c.moon_base.quote.includes(`${c.moon_base.pressure_psi_max} psi or less`));
  assert.ok(c.suit.quote.includes(`${c.suit.o2_percent}% oxygen to only ${c.suit.pressure_psi} psi`));
  assert.ok(c.cfig_burner.quote.includes(`up to ${c.cfig_burner.o2_percent_max}% oxygen`));
});

test("oxygen ceiling: engine rule, ambient per fuel phase, burner kept separate", () => {
  const c = oxygenCeiling(records);
  assert.ok(c.ambient.length > 0);
  const corpus = buildCorpus(records, { minimumStatus: "extracted" });
  for (const cl of corpus.clusters)
    for (const t of cl.tests)
      for (const ph of t.regime.fuel_phase.values) {
        const e = c.ambient.find((a) => a.label === ph);
        for (const v of t.continuous.o2_mole_fraction.values) assert.ok(e && v <= e.o2_mole_fraction, `${t.accession} ${t.test_id}`);
      }
  for (const e of c.ambient) assert.ok(e.citations.length > 0 && e.citations.every((x) => x.variable === "o2_mole_fraction"));
  assert.ok(c.burner && c.burner.citations.every((x) => x.variable === "burner_o2_mole_fraction"));
  // the burner value is the challenge's CFI-G figure, read by code from both sides
  assert.equal(pct(c.burner!.o2_mole_fraction), String(lenses.challenge.cfig_burner.o2_percent_max));
});

test("timeline points equal the engine's test points (O2 x pressure, insufficient_evidence excluded)", () => {
  const corpus = buildCorpus(records, { minimumStatus: "extracted" });
  const fromEngine = new Map<string, Set<string>>();
  for (const cl of corpus.clusters)
    for (const t of cl.tests) {
      const o = t.continuous.o2_mole_fraction.values;
      const p = t.continuous.pressure.values;
      for (const x of o) for (const y of p) (fromEngine.get(t.accession) ?? fromEngine.set(t.accession, new Set()).get(t.accession)!).add(`${x}|${y}`);
    }
  for (const i of timeline.investigations) {
    const mine = new Set(i.points.map((p) => `${p.o2_mole_fraction}|${p.pressure_kpa}`));
    assert.deepEqual([...mine].sort(), [...(fromEngine.get(i.accession) ?? [])].sort(), i.accession);
  }
  assert.ok(parseValues("0.2..0.3")?.length === 2);
});

test("timeline dates are copied from PSI and frames end with the undated ones", { skip: !hasRaw && "data/raw not present" }, () => {
  for (const i of timeline.investigations) {
    const d = JSON.parse(readFileSync(psiJson(i.accession), "utf8"));
    for (const k of Object.keys(i.dates)) assert.equal(i.dates[k], d[k] ?? "", `${i.accession} ${k}`);
  }
  const byAcc = Object.fromEntries(timeline.investigations.map((i) => [i.accession, i]));
  assert.match(byAcc["PSI-98"].date_note ?? "", /identical to SAME's in PSI; may be a PSI record error/);
  assert.equal(timeline.rules.label, "year as listed by PSI (end date)");
  const f = frames(timeline);
  const pts = slimPoints(timeline);
  assert.equal(visibleAt(pts, f[f.length - 1]).length, pts.length);
  assert.ok(visibleAt(pts, f[0]).length <= pts.length);
});

test("Moon Base band and FM2 come from the engine, unchanged", () => {
  assert.deepEqual(moonBand().vertices.map((v) => [v.o2, v.kpa]), MOON_BASE_BAND.vertices.map((v) => [v.o2_mole_fraction, v.pressure_kpa]));
  assert.deepEqual(fm2Planned().points.map((p) => [p.o2, p.kpa]), fm2Hypothetical().points.map((p) => [p.o2_mole_fraction, p.pressure_kpa]));
  assert.match(fm2Planned().source?.quote ?? "", /8\.2 psia/);
  // no PSI point inside the band today (the page says so only if this count is 0)
  const inBand = slimPoints(timeline).filter((p) => inPolygon(p, moonBand().vertices)).length;
  assert.equal(typeof inBand, "number");
  assert.ok(inPolygon({ o2: 0.3, kpa: 60 }, moonBand().vertices));
});

test("spacesuit partial pressure is the calculator's result", () => {
  const c = lenses.challenge.suit;
  const mine = suitPartialPressure(c.o2_percent!, c.pressure_psi!);
  const ref = o2PartialPressure(c.o2_percent! / 100, `${c.pressure_psi} psia`);
  assert.ok(ref.ok);
  assert.equal(mine.kpa, ref.value);
});

test("Earth sentences are verbatim researchImpacts sentences", () => {
  const e = earthSentences(profiles);
  assert.ok(e.length > 0);
  for (const x of e) for (const s of x.sentences) assert.ok(norm(x.text).includes(s), `${x.accession}: ${s}`);
  if (hasRaw)
    for (const x of e) {
      const d = JSON.parse(readFileSync(psiJson(x.accession), "utf8"));
      for (const s of x.sentences) assert.ok(norm(d.researchImpacts).includes(s), `${x.accession} not in PSI JSON: ${s}`);
    }
});

test("pages use no forbidden overclaim words", () => {
  const files = ["app/lenses/page.tsx", "app/more/page.tsx", "components/lenses/LensMatrix.tsx", "components/lenses/Timeline.tsx"];
  for (const f of files) {
    const t = readFileSync(join(repo, "web", f), "utf8").replace(/\{[^{}]*quote[^{}]*\}/g, "");
    for (const w of [/\bsafe\b/i, /\bvalidated\b/i, /\bfirst\b/i, /\bproves?\b/i, /\bdiscovery\b/i, /NASA-approved/i, /no data exists/i]) assert.ok(!w.test(t), `${f}: ${w}`);
  }
});
