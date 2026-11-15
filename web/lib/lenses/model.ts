// Pure helpers for the /lenses and /more pages (no file access, no clock). Everything shown is computed
// here from data/derived/lenses.json, data/derived/timeline.json, data/conditions/*.csv and the engine.
// Relative imports with .ts extensions so `node --test` can load this file directly.

import { buildCorpus, citationOf } from "../../../engine/src/evidence.ts";
import { MOON_BASE_BAND, fm2Hypothetical } from "../../../engine/src/planner.ts";
import { KPA_PER_PSI } from "../../../engine/src/presets.ts";
import type { Citation, ConditionRecord } from "../../../engine/src/types.ts";
import { o2PartialPressure } from "../expert/calculators.ts";

// ---------- lenses.json ----------

export interface LensSource {
  kind: "psi" | "challenge";
  file: string;
  key?: string;
  line?: number;
}
export interface LensEntry {
  quote: string;
  source: LensSource;
}
export interface LensInvestigation {
  accession: string;
  acronym: string;
  title: string;
  doi: string;
  project_type: string;
  legs: Record<string, LensEntry[]>;
  phenomena: Record<string, LensEntry[]>;
  strength: LensEntry & { value: string };
  context: (LensEntry & { label: string })[];
}
export interface ChallengeFact extends LensEntry {
  o2_percent_min?: number;
  pressure_psi_max?: number;
  o2_percent?: number;
  pressure_psi?: number;
  o2_percent_max?: number;
}
export interface LensesFile {
  axes: { legs: string[]; phenomena: string[]; strengths: string[] };
  rules: { strength: string; keyword_note: string; matching: string; keywords: Record<string, string[]> };
  challenge: Record<"moon_base" | "suit" | "cfig_burner" | "rockets" | "partial_gravity" | "not_as_strongly" | "earth", ChallengeFact>;
  counts: { investigations: number; tag_rows: number; legs: Record<string, number>; phenomena: Record<string, number>; strength: Record<string, number> };
  investigations: LensInvestigation[];
}

/** "PSI record PSI-26, field "objective"" or "NASA Space Apps 2026 challenge statement" (the line number stays in lenses.json for the tests only). */
export function sourceLabel(s: LensSource): string {
  return s.kind === "psi" ? `PSI record ${s.file.split("/").pop()?.replace(".json", "")}, field "${s.key}"` : "NASA Space Apps 2026 challenge statement";
}

/** The text shown when a lens cell is hovered or focused: every quote with its source. */
export function cellTip(entries: readonly LensEntry[]): string {
  return entries.map((e) => `"${e.quote}" (${sourceLabel(e.source)})`).join("\n");
}

/** Acronym, or for ground studies without one, "ground study" (the full title is shown on hover). */
export const displayName = (i: { acronym: string; title: string }) => i.acronym || "ground study";

// ---------- numbers ----------

/** 0.34 -> "34"; 0.22721982701616103 -> "22.7". At most one decimal, no trailing ".0". */
export function pct(fraction: number): string {
  const v = Math.round(fraction * 1000) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
export const round = (x: number, d = 1) => String(Math.round(x * 10 ** d) / 10 ** d);

// ---------- oxygen ceiling (engine rule) ----------

export interface CeilingEntry {
  label: string;
  o2_mole_fraction: number;
  tests: { accession: string; test_id: string }[];
  citations: Citation[];
}
export interface Ceiling {
  ambient: CeilingEntry[];
  burner: CeilingEntry | null;
  testsResolved: number;
}

/**
 * Highest ambient o2_mole_fraction per fuel phase, and the highest burner_o2_mole_fraction, over the tests
 * the engine builds (buildCorpus: test_id "*" records apply to a test unless it has its own; records with
 * status insufficient_evidence never count). Ties keep every test.
 */
export function oxygenCeiling(records: readonly ConditionRecord[]): Ceiling {
  const corpus = buildCorpus(records, { minimumStatus: "extracted" });
  const ambient = new Map<string, CeilingEntry>();
  let burner: CeilingEntry | null = null;
  let testsResolved = 0;
  const bump = (cur: CeilingEntry | undefined | null, label: string, v: number, acc: string, tid: string, recs: ConditionRecord[]): CeilingEntry => {
    const at = recs.filter((r) => r.value.split("..").some((p) => Number(p) === v));
    if (!cur || v > cur.o2_mole_fraction) return { label, o2_mole_fraction: v, tests: [{ accession: acc, test_id: tid }], citations: at.map(citationOf) };
    if (v === cur.o2_mole_fraction) {
      cur.tests.push({ accession: acc, test_id: tid });
      cur.citations.push(...at.map(citationOf));
    }
    return cur;
  };
  for (const c of corpus.clusters) {
    for (const t of c.tests) {
      testsResolved += 1;
      const o2 = t.continuous.o2_mole_fraction;
      if (o2.values.length) {
        const top = Math.max(...o2.values);
        for (const phase of t.regime.fuel_phase.values) ambient.set(phase, bump(ambient.get(phase), phase, top, t.accession, t.test_id, o2.records));
      }
      const b = t.continuous.burner_o2_mole_fraction;
      if (b.values.length) burner = bump(burner, "burner", Math.max(...b.values), t.accession, t.test_id, b.records);
    }
  }
  return { ambient: [...ambient.values()].sort((a, b) => a.label.localeCompare(b.label)), burner, testsResolved };
}

// ---------- Moon Base band, FM2, suit (engine and calculators) ----------

export const kpaToPsi = (kpa: number) => kpa / KPA_PER_PSI;
export const psiToKpa = (psi: number) => psi * KPA_PER_PSI;

/** The Moon Base / pressurized rover band exactly as /planner draws it (engine MOON_BASE_BAND). */
export function moonBand() {
  return {
    label: MOON_BASE_BAND.label,
    gravity: MOON_BASE_BAND.gravity.regime,
    vertices: MOON_BASE_BAND.vertices.map((v) => ({ o2: v.o2_mole_fraction, kpa: v.pressure_kpa, label: v.label, sourced: v.sourced })),
    edgePoints: MOON_BASE_BAND.edgePoints.map((v) => ({ o2: v.o2_mole_fraction, kpa: v.pressure_kpa, label: v.label })),
    closure: MOON_BASE_BAND.closure,
    convention: MOON_BASE_BAND.convention,
  };
}

/** FM2's planned tests exactly as /planner places them (engine fm2Hypothetical, NTRS 20260001966). */
export function fm2Planned() {
  const h = fm2Hypothetical();
  const src = h.sources.find((s) => s.id === "fm2-conditions");
  return {
    name: h.name,
    flag: h.flag,
    points: h.points.map((p) => ({ o2: p.o2_mole_fraction, kpa: p.pressure_kpa })),
    source: src ? { quote: src.quote, file: src.file, page: src.page ?? null } : null,
  };
}

/** Spacesuit oxygen partial pressure from the challenge numbers, computed by web/lib/expert/calculators.ts. */
export function suitPartialPressure(o2Percent: number, psi: number) {
  const r = o2PartialPressure(o2Percent / 100, `${psi} psia`);
  if (!r.ok || typeof r.value !== "number") throw new Error(`o2PartialPressure failed for ${o2Percent} % at ${psi} psia`);
  return { kpa: r.value as number, psia: r.also?.pO2_psia?.value ?? null, display: r.display, provenance: r.provenance };
}

// ---------- timeline.json ----------

export interface TimelinePoint {
  o2_mole_fraction: number;
  pressure_kpa: number;
  tests: number;
  gravity_regime: string[];
}
export interface TimelineInvestigation {
  accession: string;
  acronym: string;
  title: string;
  doi: string;
  dates: Record<string, string>;
  placed_by: string | null;
  year: number | null;
  date_note: string | null;
  gravity_regime: string[];
  points: (TimelinePoint & { example: unknown })[];
}
export interface TimelineFile {
  rules: { label: string; date_notes: string; placement: string; points: string };
  counts: { investigations: number; with_points: number; points: number; undated: number };
  years: number[];
  investigations: TimelineInvestigation[];
}

export interface SlimPoint {
  o2: number;
  kpa: number;
  acc: string;
  year: number | null;
  gravity: string[];
}
/** The plot input: one entry per distinct (O2, pressure) point of an investigation. */
export function slimPoints(t: TimelineFile): SlimPoint[] {
  return t.investigations.flatMap((i) => i.points.map((p) => ({ o2: p.o2_mole_fraction, kpa: p.pressure_kpa, acc: i.accession, year: i.year, gravity: p.gravity_regime })));
}

/** Frames: one per stated year, then a last frame that adds investigations with no stated date. */
export function frames(t: TimelineFile): { label: string; year: number | null; final: boolean }[] {
  const ys = t.years.map((y) => ({ label: String(y), year: y, final: false }));
  return t.counts.undated > 0 ? [...ys, { label: "+ date not stated in PSI", year: null, final: true }] : ys;
}

/** Points visible at a frame: dated up to that year; the final frame shows everything. */
export function visibleAt(points: readonly SlimPoint[], frame: { year: number | null; final: boolean }): SlimPoint[] {
  if (frame.final) return [...points];
  return points.filter((p) => p.year !== null && frame.year !== null && p.year <= frame.year);
}

/** Investigations whose PSI researchImpacts sentences are quoted on /more (verbatim, split by code). */
export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z(0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Ray-casting point-in-polygon (boundary counts as inside). Used to count PSI points inside the Moon Base band. */
export function inPolygon(p: { o2: number; kpa: number }, poly: readonly { o2: number; kpa: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const minX = Math.min(a.o2, b.o2), maxX = Math.max(a.o2, b.o2), minY = Math.min(a.kpa, b.kpa), maxY = Math.max(a.kpa, b.kpa);
    const cross = (b.o2 - a.o2) * (p.kpa - a.kpa) - (b.kpa - a.kpa) * (p.o2 - a.o2);
    if (Math.abs(cross) < 1e-12 && p.o2 >= minX && p.o2 <= maxX && p.kpa >= minY && p.kpa <= maxY) return true;
    if (a.kpa > p.kpa !== b.kpa > p.kpa && p.o2 < ((b.o2 - a.o2) * (p.kpa - a.kpa)) / (b.kpa - a.kpa) + a.o2) inside = !inside;
  }
  return inside;
}

/** PYRION convention for the Earth panel: a researchImpacts sentence is shown when it speaks of use on Earth ("on/for/to Earth", "terrestrial", "Earth benefits/environments"). */
export const EARTH_PATTERN = /\b(on|for|to) earth\b|\bterrestrial\b|\bearth (benefits|environments)\b/i;

export interface ProfileLike {
  accession: string;
  acronym: string;
  doi: string;
  fields: { researchImpacts?: { value: string | null; source: { file: string; key: string } } };
}

/** Per investigation, the researchImpacts sentences that mention Earth, verbatim (only split into sentences). */
export function earthSentences(profiles: readonly ProfileLike[]) {
  return profiles
    .map((p) => {
      const f = p.fields.researchImpacts;
      const text = f?.value ?? "";
      return { accession: p.accession, acronym: p.acronym, doi: p.doi, source: f?.source ?? null, text, sentences: sentences(text).filter((s) => EARTH_PATTERN.test(s)) };
    })
    .filter((x) => x.sentences.length > 0);
}
