// MISSION PLANNER: design bands from sourced vertices, evidence coverage of a band, hypothetical experiments (FM2, LUCI),
// the minimum test set and the ranking of candidate experiments. PYRION proposals: they measure how much measured
// evidence exists for a band, never a prediction and never a safety assessment.
//
// Coverage uses evaluate() itself (same rules, same 0.5 % tolerance): a grid cell is covered when at least one
// investigation is APPLICABLE at that cell. Hypothetical records are built in memory, flagged, and never written anywhere.

import { canonicalJson } from './json.ts';
import { PLANNED_SOURCES, type PlannedSource } from './experiments.ts';
import { KPA_PER_PSI, SOURCES, type SourceRef } from './presets.ts';
import { evaluate } from './verdict.ts';
import type { ConditionRecord, EngineOptions, Target } from './types.ts';

export const PLANNER_LABEL = 'PYRION proposal — evidence coverage, not a prediction or a safety assessment';

export type FuelPhase = 'solid' | 'liquid' | 'gas';

// ---------------------------------------------------------------- design bands

export interface BandVertex {
  label: string;
  o2_mole_fraction: number;
  pressure_kpa: number;
  /** True when a source states this point; false: a closing point chosen by PYRION. */
  sourced: boolean;
  /** What states it (sourced vertices only). */
  source?: SourceRef;
  /** The value as the source writes it. */
  as_written: string;
}

export interface DesignBand {
  id: string;
  label: string;
  gravity: { regime: string; level: number; source: SourceRef };
  /** Counter-clockwise, no repeated vertex. */
  vertices: BandVertex[];
  /** Sourced points that lie on an edge (not corners). */
  edgePoints: BandVertex[];
  /** How the polygon is closed, in words. */
  closure: string;
  /** What is PYRION convention in this band, in words. */
  convention: string;
}

const kpa = (psi: number) => psi * KPA_PER_PSI;

/**
 * Moon Base / pressurized rover. SOURCED vertices only, then a stated closure:
 *  - NESC exploration atmospheres 10.2 psia / 26.5 % O2 and 8.2 psia / 34 % O2 (NASA/TM-20260003925, pp. 13 and 18).
 *  - Challenge statement: "30% or greater, with a corresponding pressure of 10.2 psi or less" (a corner at 30 % / 10.2 psi).
 * The challenge band is open (no upper oxygen, no lower pressure), so the polygon is closed as the bounding rectangle of
 * the two NESC atmospheres: its other two corners (34 % / 10.2 psia and 26.5 % / 8.2 psia) are NOT stated by any source.
 */
export const MOON_BASE_BAND: DesignBand = {
  id: 'moon-base-pressurized-rover',
  label: 'Moon Base / pressurized rover design band',
  gravity: { regime: 'partial_gravity', level: 0.16, source: SOURCES.lunarGravity },
  vertices: [
    { label: 'NESC 8.2 psia, low oxygen corner', o2_mole_fraction: 0.265, pressure_kpa: kpa(8.2), sourced: false, as_written: 'closing corner: 26.5 % O2, 8.2 psia' },
    { label: 'NESC Exploration Atmosphere 8.2 psia / 34 % O2', o2_mole_fraction: 0.34, pressure_kpa: kpa(8.2), sourced: true, source: SOURCES.nescSurface, as_written: '8.2 psia/34% O2' },
    { label: 'closing corner 34 % O2 at 10.2 psia', o2_mole_fraction: 0.34, pressure_kpa: kpa(10.2), sourced: false, as_written: 'closing corner: 34 % O2, 10.2 psia' },
    { label: 'NESC Exploration Atmosphere 10.2 psia / 26.5 % O2', o2_mole_fraction: 0.265, pressure_kpa: kpa(10.2), sourced: true, source: SOURCES.nescSurface, as_written: '10.2 psia/26.5% O2' },
  ],
  edgePoints: [{ label: 'challenge corner 30 % O2 at 10.2 psi', o2_mole_fraction: 0.3, pressure_kpa: kpa(10.2), sourced: true, source: SOURCES.challenge, as_written: '30% or greater ... 10.2 psi or less' }],
  closure:
    'Bounding rectangle of the two NESC Exploration Atmospheres (26.5 to 34 % O2, 8.2 to 10.2 psia). The challenge corner (30 % O2, 10.2 psi) lies on its top edge. The challenge band itself is open (30 % or more, 10.2 psi or less).',
  convention:
    'PYRION convention: the two closing corners (26.5 % O2 at 8.2 psia and 34 % O2 at 10.2 psia) are not stated by any source; the rectangle is a way to close an open band with sourced limits, not a NASA design envelope. The 26.5 to 30 % part of the band is below the challenge text (30 % or more) but inside the NESC atmospheres.',
};

export const DESIGN_BANDS: readonly DesignBand[] = [MOON_BASE_BAND];

interface Pt {
  x: number;
  y: number;
}
const polygonOf = (b: DesignBand): Pt[] => b.vertices.map((v) => ({ x: v.o2_mole_fraction, y: v.pressure_kpa }));

function area(poly: readonly Pt[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Convex hull, CCW (monotone chain). Fewer than 3 points: returned as they are. */
function hull(points: readonly Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y).filter((p, i, a) => i === 0 || p.x !== a[i - 1].x || p.y !== a[i - 1].y);
  if (pts.length <= 2) return pts;
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Area of (convex subject) ∩ (convex CCW clip), by Sutherland–Hodgman. */
function intersectionArea(subject: readonly Pt[], clip: readonly Pt[]): number {
  if (subject.length < 3) return 0;
  let out: Pt[] = [...subject];
  for (let i = 0; i < clip.length && out.length > 0; i += 1) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const inside = (p: Pt) => cross(a, b, p) >= -1e-12;
    const next: Pt[] = [];
    for (let j = 0; j < out.length; j += 1) {
      const p = out[j];
      const q = out[(j + 1) % out.length];
      const pin = inside(p);
      const qin = inside(q);
      if (pin) next.push(p);
      if (pin !== qin) {
        const d1 = cross(a, b, p);
        const d2 = cross(a, b, q);
        const t = d1 / (d1 - d2);
        next.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
      }
    }
    out = next;
  }
  return out.length < 3 ? 0 : area(out);
}

/** Is the band a convex polygon? (The coverage grid and the test set assume it.) */
export function bandIsConvex(band: DesignBand): boolean {
  const poly = polygonOf(band);
  return hull(poly).length === poly.length;
}

// ---------------------------------------------------------------- hypothetical experiments

export interface HypotheticalPoint {
  o2_mole_fraction: number;
  pressure_kpa: number;
}

export interface HypotheticalExperiment {
  id: string;
  name: string;
  hypothetical: true;
  /** Always shown with it. */
  flag: string;
  /** False: the source does not state the numbers needed to place it in the oxygen–pressure plane. */
  placeable: boolean;
  /** Why it cannot be placed, or what it assumes. */
  reason: string;
  fuel_phase?: FuelPhase;
  material?: string;
  gravity_regime?: string;
  points: HypotheticalPoint[];
  /** 'line': every test at one pressure (or one oxygen), so the tested region has no area. */
  shape: 'none' | 'point' | 'line' | 'area';
  /** In-memory records, flagged HYPOTHETICAL, never written to the data. */
  records: ConditionRecord[];
  tests: number;
  sources: PlannedSource[];
}

export const HYPOTHETICAL_FLAG = 'HYPOTHETICAL — built from what a planning document states; no measurement exists, and nothing here is written to the data.';

const planned = (...ids: string[]) => PLANNED_SOURCES.filter((s) => ids.includes(s.id));

function shapeOf(points: readonly HypotheticalPoint[]): HypotheticalExperiment['shape'] {
  const uniq = [...new Map(points.map((p) => [`${p.o2_mole_fraction}|${p.pressure_kpa}`, p])).values()];
  if (uniq.length === 0) return 'none';
  if (uniq.length === 1) return 'point';
  const rel = (a: number, b: number) => Math.abs(a - b) <= 0.005 * Math.max(Math.abs(a), Math.abs(b));
  const sameP = uniq.every((p) => rel(p.pressure_kpa, uniq[0].pressure_kpa));
  const sameO = uniq.every((p) => rel(p.o2_mole_fraction, uniq[0].o2_mole_fraction));
  if (sameP || sameO) return 'line';
  return area(hull(uniq.map((p) => ({ x: p.o2_mole_fraction, y: p.pressure_kpa })))) > 0 ? 'area' : 'line';
}

/** Hypothetical records for a set of test points, one test per point. All flagged. */
export function hypotheticalRecords(accession: string, points: readonly HypotheticalPoint[], opts: { fuelPhase: FuelPhase; gravityRegime: string; diluent?: string; material?: string; source: PlannedSource }): ConditionRecord[] {
  const out: ConditionRecord[] = [];
  const file = `HYPOTHETICAL/${opts.source.file}`;
  const base = { accession, method: 'document' as const, source_file: file, source_location: opts.source.page === null ? 'web page' : `PDF p. ${opts.source.page}`, quote: opts.source.quote, status: 'extracted' as const };
  let line = 2;
  const add = (test: string, variable: string, value: string, unit: string) =>
    out.push({ ...base, test_id: test, variable, value, unit, value_original: value, unit_original: unit, note: 'HYPOTHETICAL — not a measurement; built from a planning document.', origin: { file: 'hypothetical', line: line++ } });
  points.forEach((p, i) => {
    const t = `H${i + 1}`;
    add(t, 'gravity_regime', opts.gravityRegime, '');
    add(t, 'fuel_phase', opts.fuelPhase, '');
    if (opts.diluent) add(t, 'diluent', opts.diluent, '');
    if (opts.material) add(t, 'material', opts.material, '');
    add(t, 'o2_mole_fraction', String(p.o2_mole_fraction), '1');
    add(t, 'pressure', String(p.pressure_kpa), 'kPa');
  });
  return out;
}

const FM2_MATERIAL = 'Synergy Pro "Navy" fabric';
const FM2_O2 = [0.37, 0.33, 0.29, 0.25];

/**
 * FM2: four burns of one fabric at 8.2 psia ± 0.3 psi with 37, 33, 29 and 25 % O2, balance nitrogen, lunar gravity
 * (NTRS 20260001966, PDF p. 10). Nominal: every test at 8.2 psia, so the region is a LINE. `withToleranceBounds` adds the
 * two ends of the stated ± 0.3 psi (7.9 and 8.5 psia) for every oxygen level: an optimistic what-if (NASA states a
 * tolerance, not tests at both ends), reported separately and never as the main result.
 */
export function fm2Hypothetical(opts: { withToleranceBounds?: boolean } = {}): HypotheticalExperiment {
  const pressures = opts.withToleranceBounds ? [7.9, 8.5] : [8.2];
  const points: HypotheticalPoint[] = pressures.flatMap((p) => FM2_O2.map((o) => ({ o2_mole_fraction: o, pressure_kpa: kpa(p) })));
  const src = planned('fm2-conditions')[0];
  const records = hypotheticalRecords(opts.withToleranceBounds ? 'HYPO-FM2-TOL' : 'HYPO-FM2', points, { fuelPhase: 'solid', gravityRegime: 'partial_gravity', diluent: 'N2', material: FM2_MATERIAL, source: src });
  return {
    id: opts.withToleranceBounds ? 'fm2-with-tolerance-bounds' : 'fm2',
    name: opts.withToleranceBounds ? 'FM2 with both ends of its stated pressure tolerance (optimistic what-if)' : 'FM2 as planned (four burns at 8.2 psia)',
    hypothetical: true,
    flag: HYPOTHETICAL_FLAG,
    placeable: true,
    reason: opts.withToleranceBounds
      ? 'Assumes tests at 7.9 and 8.5 psia for every oxygen level; the source states 8.2 psia ± 0.3 psi, not eight tests. An upper bound on what FM2 could cover.'
      : 'Four tests, all at 8.2 psia (± 0.3 psi) with 37, 33, 29 and 25 % oxygen, balance nitrogen, one fabric, lunar gravity (partial gravity).',
    fuel_phase: 'solid',
    material: FM2_MATERIAL,
    gravity_regime: 'partial_gravity',
    points,
    shape: shapeOf(points),
    records,
    tests: points.length,
    sources: planned('fm2-web', 'fm2-conditions', 'fm2-fuel', 'fm2-limit'),
  };
}

/** LUCI: air at "normal pressure" in a rotating vehicle; no pressure figure and no oxygen figure in the quoted passage, so it cannot be placed. */
export function luciHypothetical(): HypotheticalExperiment {
  return {
    id: 'luci',
    name: 'LUCI (rotating vehicle, air at normal pressure)',
    hypothetical: true,
    flag: HYPOTHETICAL_FLAG,
    placeable: false,
    reason: 'LUCI burned samples "in air at normal pressure" in simulated partial gravity (rotating vehicle). The source passage gives no pressure figure and no oxygen figure, so PYRION cannot place it in the oxygen–pressure plane and does not guess one.',
    gravity_regime: 'partial_gravity',
    points: [],
    shape: 'none',
    records: [],
    tests: 0,
    sources: planned('luci-conditions', 'luci-rotation', 'luci-data'),
  };
}

/** A candidate experiment from test points (one test per point). */
export function candidateFromPoints(id: string, name: string, points: readonly HypotheticalPoint[], opts: { fuelPhase: FuelPhase; material?: string; gravityRegime?: string; diluent?: string }): HypotheticalExperiment {
  const src: PlannedSource = { id: `${id}-proposal`, name: 'PYRION proposal', file: 'proposal', page: null, quote: 'PYRION proposal (a testable plan, not a NASA plan)', supports: 'A proposed test point set.' };
  const pts = [...points];
  return {
    id,
    name,
    hypothetical: true,
    flag: HYPOTHETICAL_FLAG,
    placeable: pts.length > 0,
    reason: 'A PYRION proposal: points chosen by PYRION, not a NASA plan.',
    fuel_phase: opts.fuelPhase,
    ...(opts.material ? { material: opts.material } : {}),
    gravity_regime: opts.gravityRegime ?? 'partial_gravity',
    points: pts,
    shape: shapeOf(pts),
    records: hypotheticalRecords(`HYPO-${id}`.toUpperCase(), pts, { fuelPhase: opts.fuelPhase, gravityRegime: opts.gravityRegime ?? 'partial_gravity', diluent: opts.diluent ?? 'N2', ...(opts.material ? { material: opts.material } : {}), source: src }),
    tests: pts.length,
    sources: [],
  };
}

// ---------------------------------------------------------------- coverage

export interface CoverageCell {
  o2_mole_fraction: number;
  pressure_kpa: number;
  covered: boolean;
  /** Investigations that are APPLICABLE at this cell. */
  applicable: string[];
}

export interface CoverageResult {
  band: string;
  fuelPhase: FuelPhase | null;
  grid: { o2: number; pressure: number };
  /** Cells inside the band (all of them for a convex polygon grid clipped to the band). */
  total: number;
  covered: number;
  /** covered / total, 0 to 1. */
  fraction: number;
  cells: CoverageCell[];
  /** Investigations APPLICABLE somewhere in the band. */
  investigations: string[];
  /** Records of real investigations considered after the regime pre-filter (hypothetical records are counted apart). */
  recordsConsidered: number;
  extraRecords: number;
  note: string;
}

export const COVERAGE_NOTE =
  'A cell is covered when at least one investigation is APPLICABLE there, by the same rules and the same ±0.5 % tolerance as evaluate(). Grid fractions depend on the grid; a tested line covers the cells on it within the tolerance but has no area.';

/**
 * Investigations that cannot matter for a target are dropped before the grid is evaluated: an investigation that never
 * states the target's gravity regime (or fuel phase) can only be a regime barrier or insufficient there, never APPLICABLE.
 */
function relevantRecords(records: readonly ConditionRecord[], regime: string, fuelPhase: FuelPhase | null): ConditionRecord[] {
  const stating = (variable: string, value: string) => new Set(records.filter((r) => r.variable === variable && r.value === value && r.status !== 'insufficient_evidence').map((r) => r.accession));
  let keep = stating('gravity_regime', regime);
  if (fuelPhase) {
    const f = stating('fuel_phase', fuelPhase);
    keep = new Set([...keep].filter((a) => f.has(a)));
  }
  return records.filter((r) => keep.has(r.accession));
}

function linspace(a: number, b: number, n: number): number[] {
  if (n <= 1) return [(a + b) / 2];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

export interface CoverageOptions extends EngineOptions {
  fuelPhase?: FuelPhase;
  /** Hypothetical or candidate records added to the real ones (for what-ifs). */
  extraRecords?: readonly ConditionRecord[];
  /** Grid size per axis (default 9 x 9, corners included). */
  grid?: { o2?: number; pressure?: number };
}

function cellTarget(band: DesignBand, o2: number, p: number, fuelPhase: FuelPhase | null): Target {
  return { regime: { gravity_regime: band.gravity.regime, ...(fuelPhase ? { fuel_phase: fuelPhase } : {}) }, continuous: { o2_mole_fraction: o2, pressure: p }, informational: { gravity_level: band.gravity.level } };
}

export function coverage(records: readonly ConditionRecord[], band: DesignBand, opts: CoverageOptions = {}): CoverageResult {
  const { fuelPhase = null, extraRecords = [], grid, ...engineOptions } = opts as CoverageOptions & { fuelPhase?: FuelPhase | null };
  if (!bandIsConvex(band)) throw new RangeError(`band ${band.id} is not convex; the coverage grid assumes a convex polygon`);
  const poly = polygonOf(band);
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const no2 = grid?.o2 ?? 9;
  const np = grid?.pressure ?? 9;
  const pool = [...relevantRecords(records, band.gravity.regime, fuelPhase), ...extraRecords];
  const cells: CoverageCell[] = [];
  const inside = (pt: Pt) => poly.every((a, i) => cross(a, poly[(i + 1) % poly.length], pt) >= -1e-9 * Math.max(1, Math.abs(pt.x * pt.y)));
  for (const p of linspace(Math.min(...ys), Math.max(...ys), np)) {
    for (const o of linspace(Math.min(...xs), Math.max(...xs), no2)) {
      if (!inside({ x: o, y: p })) continue;
      const ev = pool.length === 0 ? null : evaluate(pool, cellTarget(band, o, p, fuelPhase), engineOptions);
      const applicable = ev ? ev.investigations.filter((i) => i.verdict === 'APPLICABLE').map((i) => i.accession).sort() : [];
      cells.push({ o2_mole_fraction: Number(o.toPrecision(10)), pressure_kpa: Number(p.toPrecision(10)), covered: applicable.length > 0, applicable });
    }
  }
  const covered = cells.filter((c) => c.covered).length;
  return {
    band: band.id,
    fuelPhase,
    grid: { o2: no2, pressure: np },
    total: cells.length,
    covered,
    fraction: cells.length === 0 ? 0 : covered / cells.length,
    cells,
    investigations: [...new Set(cells.flatMap((c) => c.applicable))].sort(),
    recordsConsidered: pool.length - extraRecords.length,
    extraRecords: extraRecords.length,
    note: COVERAGE_NOTE,
  };
}

export interface GainResult {
  experiment: string;
  placeable: boolean;
  shape: HypotheticalExperiment['shape'];
  tests: number;
  baseFraction: number;
  withFraction: number;
  /** Grid cells gained (covered with the experiment, not without). */
  cellsGained: number;
  gainFraction: number;
  /** Area of the hull of the experiment's own test points inside the band, as a fraction of the band's area. 0 for a line. */
  hullAreaFraction: number;
  gainPerTest: number;
  note: string;
}

/** Coverage gained by a hypothetical experiment (what the grid says, and what the hull area says). */
export function coverageGained(records: readonly ConditionRecord[], band: DesignBand, exp: HypotheticalExperiment, opts: CoverageOptions = {}): GainResult {
  const fuel = opts.fuelPhase ?? exp.fuel_phase;
  const base = coverage(records, band, { ...opts, ...(fuel ? { fuelPhase: fuel } : {}) });
  const withExp = exp.placeable ? coverage(records, band, { ...opts, ...(fuel ? { fuelPhase: fuel } : {}), extraRecords: [...(opts.extraRecords ?? []), ...exp.records] }) : base;
  const gained = withExp.covered - base.covered;
  const h = hull(exp.points.map((p) => ({ x: p.o2_mole_fraction, y: p.pressure_kpa })));
  const hullArea = exp.placeable ? intersectionArea(h, hull(polygonOf(band))) / area(polygonOf(band)) : 0;
  const note = !exp.placeable
    ? exp.reason
    : exp.shape === 'line'
      ? 'Every test lies on one line (one pressure or one oxygen level): the tested region has no area; the cells gained are those on the line within the 0.5 % tolerance.'
      : exp.shape === 'area'
        ? 'The tests span an area of the oxygen–pressure plane.'
        : 'One point.';
  return {
    experiment: exp.id,
    placeable: exp.placeable,
    shape: exp.shape,
    tests: exp.tests,
    baseFraction: base.fraction,
    withFraction: withExp.fraction,
    cellsGained: gained,
    gainFraction: withExp.fraction - base.fraction,
    hullAreaFraction: hullArea,
    gainPerTest: exp.tests === 0 ? 0 : gained / exp.tests,
    note,
  };
}

/** Candidates ranked by coverage gained per test (cells gained / tests), best first; ties by hull area, then id. */
export function rankExperiments(records: readonly ConditionRecord[], band: DesignBand, candidates: readonly HypotheticalExperiment[], opts: CoverageOptions = {}): GainResult[] {
  return candidates
    .map((c) => coverageGained(records, band, c, opts))
    .sort((a, b) => b.gainPerTest - a.gainPerTest || b.hullAreaFraction - a.hullAreaFraction || (a.experiment < b.experiment ? -1 : 1));
}

// ---------------------------------------------------------------- minimum test set

export interface TestPoint {
  o2_mole_fraction: number;
  pressure_kpa: number;
  /** The band vertex it is. */
  vertex: string;
  sourced: boolean;
  source?: SourceRef;
  /** True when an existing or planned experiment already covers this point (by evaluate()). */
  coveredBy: string[];
}

export interface MinimumTestSet {
  band: string;
  fuelPhase: FuelPhase | null;
  material: string | null;
  /** The smallest set: the vertices of the (convex) band polygon, deduplicated. Their hull plus the tolerance covers the band. */
  points: TestPoint[];
  /** Points no existing evidence covers. */
  missing: TestPoint[];
  /** What FM2 contributes (nominal plan), per point. */
  fm2Contributes: TestPoint[];
  rule: string;
}

export const MINIMUM_TEST_SET_CONVENTION =
  "This is a minimum under PYRION's convention that the region between measured tests counts as covered, separately for each material, flow velocity and sample thickness. Flammability limits are thresholds and need not behave monotonically (a U-shaped boundary of the oxygen limit against flow velocity is described in the microgravity literature, Olson and T'ien; that attribution is not cited from this repository's sources), so covering the corners does not show that everything between them behaves like the tests; it only makes the band comparable under that convention.";

export const MINIMUM_TEST_SET_RULE =
  'The smallest set of test points whose region (hull plus the 0.5 % tolerance) covers the band is the set of vertices of the band polygon, deduplicated: for a convex band, the hull of the vertices is the band itself, and no smaller set has that hull. It assumes one test per vertex, at the band gravity, for the stated fuel phase (and material), and that a test inside its own region counts like a measured point; it says nothing about how many repeats a test needs. ' +
  MINIMUM_TEST_SET_CONVENTION;

export function minimumTestSet(records: readonly ConditionRecord[], band: DesignBand, opts: { fuelPhase?: FuelPhase; material?: string; extraRecords?: readonly ConditionRecord[] } & EngineOptions = {}): MinimumTestSet {
  const { fuelPhase, material, extraRecords = [], ...engineOptions } = opts;
  const fm2 = fm2Hypothetical();
  const fm2Applies = (fuelPhase === undefined || fuelPhase === 'solid') && (material === undefined || /synergy/i.test(material));
  const seen = new Set<string>();
  const verts = band.vertices.filter((v) => (seen.has(`${v.o2_mole_fraction}|${v.pressure_kpa}`) ? false : (seen.add(`${v.o2_mole_fraction}|${v.pressure_kpa}`), true)));
  const real = relevantRecords(records, band.gravity.regime, fuelPhase ?? null);
  const points: TestPoint[] = verts.map((v) => {
    const t = cellTarget(band, v.o2_mole_fraction, v.pressure_kpa, fuelPhase ?? null);
    const coveredBy: string[] = [];
    const existing = [...real, ...extraRecords];
    if (existing.length > 0 && evaluate(existing, t, engineOptions).counts.investigations.APPLICABLE > 0) coveredBy.push('existing PSI evidence');
    if (fm2Applies && evaluate(fm2.records, t, engineOptions).counts.investigations.APPLICABLE > 0) coveredBy.push('FM2 (planned)');
    return { o2_mole_fraction: v.o2_mole_fraction, pressure_kpa: v.pressure_kpa, vertex: v.label, sourced: v.sourced, ...(v.source ? { source: v.source } : {}), coveredBy };
  });
  return {
    band: band.id,
    fuelPhase: fuelPhase ?? null,
    material: material ?? null,
    points,
    missing: points.filter((p) => p.coveredBy.length === 0),
    fm2Contributes: points.filter((p) => p.coveredBy.includes('FM2 (planned)')),
    rule: MINIMUM_TEST_SET_RULE,
  };
}

/** SHA-256-ready canonical text of anything the planner returns (for fingerprints). */
export const plannerCanonical = (x: unknown): string => canonicalJson(x);
