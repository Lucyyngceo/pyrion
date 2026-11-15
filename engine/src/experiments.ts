// NAVIGATOR N10, "Experiments needed": what a new experiment would have to cover for the target to be comparable
// with PSI. Deterministic and sourced; a PYRION proposal, never NASA's plan. The planned-experiment statements
// come ONLY from documents in the repository (data/raw/nasa), quoted verbatim with file and page.

import { parseCsv } from './csv.ts';
import { buildCorpus } from './evidence.ts';
import { humanValue, levelSentence, plural, valueLabel } from './labels.ts';
import { bestLevel, type ExtrapolationLevel } from './levels.ts';
import { KPA_PER_PSI } from './presets.ts';
import { AXIS_UNITS, type ConditionRecord, type ContinuousAxis, type EngineOptions, type Evaluation, type Target, type Verdict } from './types.ts';
import { evaluate } from './verdict.ts';

export const EXPERIMENT_LABEL = 'PYRION proposal (a testable plan, not a NASA plan)';

/** PYRION design convention, not a NASA design: the oxygen offsets (points of oxygen) and pressure fractions of the test matrix. */
export const TEST_MATRIX_O2_OFFSETS_POINTS: readonly number[] = [-8, -4, 0, 4, 8];
export const TEST_MATRIX_PRESSURE_FRACTIONS: readonly number[] = [-0.15, 0, 0.15];
export const TEST_MATRIX_NOTE =
  'PYRION design convention, not a NASA design: the target point plus oxygen steps of ±4 and ±8 points and pressure steps of ±15 %, so that results form an envelope and not a single point.';

export interface PlannedSource {
  id: string;
  name: string;
  /** Path under data/raw/nasa/ */
  file: string;
  /** PDF page (1-based), or null for a web page. */
  page: number | null;
  /** Printed slide number, when the PDF shows one. */
  slide?: number;
  /** Verbatim from the source. */
  quote: string;
  supports: string;
}

const FM2_PAGE = 'crawl-combustion-science-flammability-of-materials-on-the-moon-fm2-ecc5990d/page.html';
const LPSC = 'ntrs-20260001966/Ferkul-Lunar and Planetary Science Conf 2026 v2.pdf';
const LUCI = 'ntrs-20250010653/ASGSR 2025-LUCI-Ferkul-Presentation-v2-20250010653.pdf';

/** What NASA documents in this repository state about FM2 and LUCI. Nothing else is assumed. */
export const PLANNED_SOURCES: readonly PlannedSource[] = [
  {
    id: 'fm2-web',
    name: 'FM2 (Flammability of Materials on the Moon), NASA web page',
    file: FM2_PAGE,
    page: null,
    quote: 'The experiment burns four fuel samples individually in atmospheric conditions planned for future lunar habitats or vehicles.',
    supports: 'FM2 burns four samples in atmospheres planned for lunar habitats or vehicles; the page does not state oxygen or pressure.',
  },
  {
    id: 'fm2-conditions',
    name: 'FM2 science requirements, NTRS 20260001966',
    file: LPSC,
    page: 10,
    slide: 9,
    quote: 'Test 1: 8.2 psia (+/- 0.3 psi), 37% O2 , balance nitrogen) Test 2: 8.2 psia (+/- 0.3 psi), 33% O2 , balance nitrogen) Test 3: 8.2 psia (+/- 0.3 psi), 29% O2 , balance nitrogen) Test 4: 8.2 psia (+/- 0.3 psi), 25% O2 , balance nitrogen)',
    supports: 'The four FM2 initial chamber atmospheres: 8.2 psia ± 0.3 psi, with 37, 33, 29 and 25 % oxygen, balance nitrogen.',
  },
  {
    id: 'fm2-fuel',
    name: 'FM2 fuel, NTRS 20260001966',
    file: LPSC,
    page: 10,
    slide: 9,
    quote: 'Fabric sheets (Synergy Pro "Navy") mounted between thin metal frames',
    supports: 'FM2 burns a fabric (a solid fuel); the quoted passage names no other fuel.',
  },
  {
    id: 'fm2-limit',
    name: 'FM2 test concept, NTRS 20260001966',
    file: LPSC,
    page: 5,
    slide: 4,
    quote: 'Test a material with an expected Lunar LOC of 24-26% and an expected oxygen consumption of 0.08 mol fraction',
    supports: 'FM2 aims at a limiting oxygen concentration (LOC) of one material, expected at 24 to 26 %.',
  },
  {
    id: 'luci-conditions',
    name: 'LUCI (Lunar gravity centrifuge flight), NTRS 20250010653',
    file: LUCI,
    page: 12,
    quote: 'Two samples are burned simultaneously in air at normal pressure: Cotton-fiberglass composite fabric sheet and a 4-mm diameter rod of acrylic plastic (polymethyl methacrylate).',
    supports: 'LUCI burned a cotton-fiberglass fabric and a 4-mm acrylic rod in air at "normal pressure", in simulated lunar gravity; the source gives no pressure figure in this passage.',
  },
  {
    id: 'luci-data',
    name: 'LUCI / FM2 expected data, NTRS 20250010653',
    file: LUCI,
    page: 18,
    quote: 'Flammability limits (%O2) for a subset of materials in Lunar-g Measurements of the flame spread rate over materials in exploration atmospheres',
    supports: 'The stated data products: oxygen flammability limits at lunar gravity and flame spread rate in exploration atmospheres.',
  },
];

export interface CatalogEntry {
  acronym: string;
  title: string;
  doi: string;
}

/** accession -> acronym, title, DOI, from data/manifest/investigations.csv (the engine never reads files itself). */
export function parseInvestigationCatalog(csvText: string): Record<string, CatalogEntry> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return {};
  const h = rows[0].cells;
  const col = (n: string) => h.indexOf(n);
  const out: Record<string, CatalogEntry> = {};
  for (const r of rows.slice(1)) {
    const acc = r.cells[col('accession')];
    if (acc) out[acc] = { acronym: r.cells[col('acronym')] ?? '', title: r.cells[col('title')] ?? '', doi: r.cells[col('doi')] ?? '' };
  }
  return out;
}

export interface MatrixPoint {
  o2_mole_fraction?: number;
  pressure_kpa?: number;
  isTarget: boolean;
}

export interface PhaseCoverage {
  fuel_phase: 'solid' | 'liquid' | 'gas';
  /** Best verdict among the investigations of that fuel phase at the target's regime; 'NONE' when no investigation of that phase is comparable. */
  best: Verdict | 'NONE';
  level?: ExtrapolationLevel;
  investigations: string[];
}

export interface ComparableInvestigation {
  accession: string;
  acronym?: string;
  title?: string;
  doi?: string;
  /** Verdict of its fuel-phase cluster against the target with the gravity regime left open. */
  verdict: Verdict;
  descriptors: Record<string, string[]>;
  /** True when the comparable cluster was tested in the target's own gravity regime; false: another regime (same fuel phase). */
  inTargetRegime: boolean;
  flow_velocity?: { min: number; max: number; unit: string };
  sample_thickness?: { min: number; max: number; unit: string };
}

export interface MeasuredVariable {
  variable: string;
  label: string;
  unit: string;
  investigations: string[];
}

export interface CoverageStatement {
  source: string;
  covered: MatrixPoint[];
  sentence: string;
}

export interface PriorityItem {
  rank: number;
  kind: 'regime_untested' | 'solid_fuel' | 'far_outside' | 'outside' | 'just_outside' | 'combination' | 'no_comparable_test';
  fuel_phase?: string;
  sentence: string;
}

export interface ExperimentsNeeded {
  label: string;
  target: Target;
  gap: { kind: 'regime_untested' | 'outside_tested_data' | 'insufficient' | 'covered'; sentence: string; level?: ExtrapolationLevel; detail: string[] };
  phaseCoverage: PhaseCoverage[];
  zeroCoveragePhases: string[];
  testMatrix: { note: string; gravity: { regime?: string; level?: number }; points: MatrixPoint[]; pointCount: number; sentence: string };
  configuration: { prioritized: 'solid'; comparable: ComparableInvestigation[]; sentence: string };
  measurements: { recorded: MeasuredVariable[]; /** What FM2 / LUCI are stated to produce, quoted from the sources. */ plannedDataProducts: PlannedSource[]; sentence: string };
  plannedCoverage: { sources: readonly PlannedSource[]; statements: CoverageStatement[] };
  remainingGap: { points: MatrixPoint[]; sentence: string };
  priority: PriorityItem[];
}

const PHASES = ['solid', 'liquid', 'gas'] as const;

function matrixPoints(target: Target): MatrixPoint[] {
  const o2 = target.continuous.o2_mole_fraction;
  const p = target.continuous.pressure;
  const o2s = o2 === undefined ? [undefined] : TEST_MATRIX_O2_OFFSETS_POINTS.map((d) => Number((o2 + d / 100).toFixed(6))).filter((x) => x > 0 && x <= 1);
  const ps = p === undefined ? [undefined] : TEST_MATRIX_PRESSURE_FRACTIONS.map((f) => Number((p * (1 + f)).toPrecision(8))).filter((x) => x > 0);
  const pts: MatrixPoint[] = [];
  for (const pv of ps) {
    for (const ov of o2s) {
      if (ov === undefined && pv === undefined) continue;
      pts.push({
        ...(ov !== undefined ? { o2_mole_fraction: ov } : {}),
        ...(pv !== undefined ? { pressure_kpa: pv } : {}),
        isTarget: (ov === undefined || ov === o2) && (pv === undefined || pv === Number((p as number).toPrecision(8))),
      });
    }
  }
  return pts;
}

const sameRel = (a: number, b: number, rel: number) => Math.abs(a - b) <= rel * Math.abs(b);

/** FM2's stated starting atmospheres: 8.2 psia ± 0.3 psi at 37, 33, 29 and 25 % oxygen (NTRS 20260001966, PDF p. 10). */
function coveredByFm2(pt: MatrixPoint, gravityRegime: string | undefined): boolean {
  if (gravityRegime !== 'partial_gravity' || pt.o2_mole_fraction === undefined || pt.pressure_kpa === undefined) return false;
  const kpa = pt.pressure_kpa / KPA_PER_PSI;
  return kpa >= 8.2 - 0.3 - 1e-9 && kpa <= 8.2 + 0.3 + 1e-9 && [0.37, 0.33, 0.29, 0.25].some((x) => sameRel(pt.o2_mole_fraction as number, x, 0.005));
}

const OUTCOME_LABELS: Readonly<Record<string, string>> = {
  burn_time: 'burn time',
  burning_rate: 'burning rate',
  hot_ignition: 'hot ignition',
  cool_flame: 'cool flame',
  o2_mole_fraction_after_test: 'oxygen after the test',
  pressure_after_test: 'pressure after the test',
  test_end: 'how the test ended',
  visible_flame_extinction_diameter: 'droplet diameter at visible-flame extinction',
};

/** The unit shown for an outcome variable: the unit the records carry ('' means a plain number). */
function unitText(u: string): string {
  return u === '' || u === '1' ? '' : u;
}

export function experimentsNeeded(
  records: readonly ConditionRecord[],
  target: Target,
  options: EngineOptions & { catalog?: Record<string, CatalogEntry> } = {},
): ExperimentsNeeded {
  const { catalog, ...engineOptions } = options;
  // No condition record carries a gravity level: it selects the regime and is only shown (as everywhere in the engine).
  const normalized: Target = { regime: { ...target.regime }, continuous: { ...target.continuous }, ...(target.informational ? { informational: { ...target.informational } } : {}) };
  if (normalized.continuous.gravity_level !== undefined) {
    normalized.informational = { ...normalized.informational, gravity_level: normalized.continuous.gravity_level };
    delete normalized.continuous.gravity_level;
  }
  target = normalized;
  const ev: Evaluation = evaluate(records, target, engineOptions);
  const regime = target.regime.gravity_regime;
  const gravityLevel = target.informational?.gravity_level ?? target.continuous.gravity_level;

  // ---- coverage by fuel phase, at the target's regime ----
  const phaseCoverage: PhaseCoverage[] = PHASES.map((phase) => {
    const t: Target = { regime: { ...target.regime, fuel_phase: phase }, continuous: { ...target.continuous } };
    if (t.informational === undefined && target.informational) t.informational = { ...target.informational };
    const e = evaluate(records, t, engineOptions);
    const comparable = e.investigations.filter((i) => i.verdict === 'APPLICABLE' || i.verdict === 'EXTRAPOLATION');
    const best = comparable.length === 0 ? 'NONE' : comparable.some((i) => i.verdict === 'APPLICABLE') ? 'APPLICABLE' : 'EXTRAPOLATION';
    const level = best === 'EXTRAPOLATION' ? bestLevel(comparable.map((i) => i.extrapolationLevel)) : undefined;
    return { fuel_phase: phase, best, ...(level ? { level } : {}), investigations: comparable.map((i) => i.accession) };
  });
  const zeroCoveragePhases = phaseCoverage.filter((p) => p.best === 'NONE').map((p) => p.fuel_phase);

  // ---- the gap ----
  const anyApplicable = ev.counts.investigations.APPLICABLE > 0;
  const overall = bestLevel(ev.investigations.filter((i) => i.verdict === 'EXTRAPOLATION').map((i) => i.extrapolationLevel));
  let gap: ExperimentsNeeded['gap'];
  if (ev.regimeUntested) {
    const tested = ev.regimeUntested.testedValues.map(valueLabel).join(' and ');
    gap = {
      kind: 'regime_untested',
      sentence: `No PSI test was run in ${valueLabel(ev.regimeUntested.value)}; the investigations state only ${tested || 'other regimes'}.`,
      detail: [],
    };
  } else if (!anyApplicable && overall) {
    gap = { kind: 'outside_tested_data', sentence: `${levelSentence(overall)}.`, level: overall, detail: [] };
  } else if (!anyApplicable) {
    const sentences = [...new Set(ev.investigations.flatMap((i) => (i.blockers ?? []).map((b) => b.sentence)))].slice(0, 5);
    gap = { kind: 'insufficient', sentence: 'The investigations do not record enough to compare at this condition.', detail: sentences };
  } else {
    const solid = phaseCoverage[0];
    gap = {
      kind: 'covered',
      sentence:
        solid.best === 'APPLICABLE'
          ? 'At least one investigation is comparable at this condition for solid fuel.'
          : `${ev.counts.investigations.APPLICABLE} ${plural(ev.counts.investigations.APPLICABLE, 'investigation is', 'investigations are')} comparable at this condition, but not for solid fuel.`,
      detail: [],
    };
  }

  // ---- the test matrix ----
  const points = matrixPoints(target);
  const matrixSentence =
    points.length === 0
      ? 'The target states neither oxygen nor pressure, so no test matrix can be drawn around it.'
      : `${points.length} test ${plural(points.length, 'point', 'points')} ${regime ? `in ${valueLabel(regime)}` : '(gravity regime not stated)'}: oxygen from ${
          target.continuous.o2_mole_fraction === undefined ? 'not set' : `${humanValue('o2_mole_fraction', Math.max(0.0001, target.continuous.o2_mole_fraction - 0.08))} to ${humanValue('o2_mole_fraction', Math.min(1, target.continuous.o2_mole_fraction + 0.08))}`
        } and pressure from ${
          target.continuous.pressure === undefined ? 'not set' : `${humanValue('pressure', target.continuous.pressure * 0.85)} to ${humanValue('pressure', target.continuous.pressure * 1.15)}`
        }, around the target.`;

  // ---- nearest comparable solid-fuel investigations (gravity regime left open) ----
  const openGravity: Target = { regime: { ...target.regime, fuel_phase: 'solid' }, continuous: { ...target.continuous } };
  delete openGravity.regime.gravity_regime;
  const solidEval = evaluate(records, openGravity, engineOptions);
  const solidClusters = [...solidEval.ranked, ...solidEval.unranked].filter((c) => c.regime.some((s) => s.axis === 'fuel_phase' && s.state === 'known' && s.values[0] === 'solid') && (c.verdict === 'APPLICABLE' || c.verdict === 'EXTRAPOLATION'));
  const seen = new Set<string>();
  // Same gravity regime first (the configuration to repeat), then the nearest in other regimes; stable within each group.
  const inRegime = (c: (typeof solidClusters)[number]) => regime !== undefined && c.regime.some((s) => s.axis === 'gravity_regime' && s.state === 'known' && s.values[0] === regime);
  const ordered = [...solidClusters.filter(inRegime), ...solidClusters.filter((c) => !inRegime(c))];
  const nearest = ordered.filter((c) => (seen.has(c.accession) ? false : (seen.add(c.accession), true))).slice(0, 3);
  const corpus = buildCorpus(records, { minimumStatus: engineOptions.minimumStatus ?? 'extracted' });
  const range = (acc: string, axis: ContinuousAxis) => {
    const vals = corpus.clusters.filter((c) => c.accession === acc).flatMap((c) => c.tests.flatMap((t) => t.continuous[axis].values));
    return vals.length === 0 ? undefined : { min: Math.min(...vals), max: Math.max(...vals), unit: AXIS_UNITS[axis] };
  };
  const comparable: ComparableInvestigation[] = nearest.map((c) => {
    const cat = catalog?.[c.accession];
    const flow = range(c.accession, 'flow_velocity');
    const th = range(c.accession, 'sample_thickness');
    return {
      accession: c.accession,
      ...(cat ? { acronym: cat.acronym, title: cat.title, doi: cat.doi } : {}),
      verdict: c.verdict,
      inTargetRegime: inRegime(c),
      descriptors: Object.fromEntries(['platform', 'material', 'geometry', 'flow_configuration', 'fuel'].filter((k) => c.descriptors[k]).map((k) => [k, c.descriptors[k].slice(0, 5)])),
      ...(flow ? { flow_velocity: flow } : {}),
      ...(th ? { sample_thickness: th } : {}),
    };
  });
  const name = (c: ComparableInvestigation) => `${c.accession}${c.acronym ? ` ${c.acronym}` : ''}${c.doi ? ` (doi:${c.doi})` : ''}${c.inTargetRegime || regime === undefined ? '' : ` [tested in another gravity regime]`}`;
  const configSentence =
    comparable.length === 0
      ? 'No solid-fuel investigation in the extracted records is comparable at this oxygen and pressure, so there is no existing configuration to repeat.'
      : `Solid fuel first (the case that matters for cabin fires). Repeat the configuration of ${comparable.map(name).join('; ')} so new results can be compared with theirs.`;

  // ---- what PSI records for those investigations ----
  const accs = new Set(comparable.map((c) => c.accession));
  const byVar = new Map<string, { unit: string; accs: Set<string> }>();
  for (const r of records) {
    if (!r.variable.startsWith('outcome:') || !accs.has(r.accession) || r.status === 'insufficient_evidence') continue;
    const e = byVar.get(r.variable) ?? { unit: r.unit, accs: new Set<string>() };
    e.accs.add(r.accession);
    byVar.set(r.variable, e);
  }
  const recorded: MeasuredVariable[] = [...byVar.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([variable, e]) => {
      const key = variable.slice('outcome:'.length);
      return { variable, label: OUTCOME_LABELS[key] ?? key.replace(/_/g, ' '), unit: unitText(e.unit), investigations: [...e.accs].sort() };
    });
  const measurementSentence =
    recorded.length === 0
      ? 'The extracted records of these investigations carry no outcome variable yet, so there is nothing to copy. NASA states that FM2 and LUCI produce oxygen flammability limits (% O2) and flame spread rate.'
      : `What PSI records for these investigations: ${recorded.map((m) => `${m.label}${m.unit ? ` (${m.unit})` : ''}`).join(', ')}. NASA states that FM2 and LUCI produce oxygen flammability limits (% O2) and flame spread rate.`;

  // ---- what NASA's planned experiments are stated to cover ----
  const statements: CoverageStatement[] = [];
  const fm2Covered = points.filter((p) => coveredByFm2(p, regime));
  statements.push({
    source: 'FM2',
    covered: fm2Covered,
    sentence:
      regime === 'partial_gravity'
        ? fm2Covered.length > 0
          ? `FM2 is stated to start at 8.2 psia ± 0.3 psi with 37, 33, 29 and 25 % oxygen; ${fm2Covered.length} of the ${points.length} test points fall on those conditions.`
          : `FM2 is stated to start at 8.2 psia ± 0.3 psi with 37, 33, 29 and 25 % oxygen; none of the ${points.length} test points falls on those conditions.`
        : 'FM2 and LUCI are stated to work at lunar gravity; this target is not at lunar gravity, so they are not stated to cover it.',
  });
  statements.push({
    source: 'LUCI',
    covered: [],
    sentence:
      regime === 'partial_gravity'
        ? 'LUCI is stated to have burned samples "in air at normal pressure" in simulated lunar gravity; the source gives no oxygen or pressure figures for that passage, so whether a test point is covered is not stated by the source.'
        : 'LUCI is stated to have worked in simulated lunar gravity only.',
  });
  const remaining = points.filter((p) => !fm2Covered.includes(p));
  const remainingSentence =
    points.length === 0
      ? 'Nothing to compare.'
      : regime === 'partial_gravity'
        ? `${remaining.length} of ${points.length} test points are not stated to be covered by FM2; for LUCI, coverage is not stated by the source.`
        : `All ${points.length} test points remain: no planned experiment in the downloaded sources is stated to cover this gravity regime.`;

  // ---- priority ----
  const items: (PriorityItem & { _o: number })[] = [];
  if (ev.regimeUntested) {
    items.push({ _o: 0, rank: 0, kind: 'regime_untested', sentence: `Run at least one test in ${valueLabel(ev.regimeUntested.value)}: PSI has none.` });
  }
  const solid = phaseCoverage[0];
  if (solid.best !== 'APPLICABLE') {
    items.push({
      _o: 1,
      rank: 0,
      kind: 'solid_fuel',
      fuel_phase: 'solid',
      sentence:
        solid.best === 'NONE'
          ? 'Solid fuel: no comparable test exists at this condition, and solids are the case that matters for cabin fires.'
          : `Solid fuel: ${levelSentence(solid.level as ExtrapolationLevel).toLowerCase()}; solids are the case that matters for cabin fires.`,
    });
  }
  for (const p of phaseCoverage.slice(1)) {
    if (p.best === 'APPLICABLE') continue;
    if (p.best === 'NONE') {
      if (ev.regimeUntested) continue;
      items.push({ _o: 2, rank: 0, kind: 'no_comparable_test', fuel_phase: p.fuel_phase, sentence: `${valueLabel(p.fuel_phase)}: no comparable test exists at this condition.` });
    } else {
      const lv = p.level as ExtrapolationLevel;
      const o = lv === 'far_outside' ? 2 : lv === 'outside' ? 3 : lv === 'just_outside' ? 4 : 5;
      items.push({ _o: o, rank: 0, kind: lv, fuel_phase: p.fuel_phase, sentence: `${valueLabel(p.fuel_phase)}: ${levelSentence(lv).toLowerCase()}.` });
    }
  }
  if (solid.best === 'EXTRAPOLATION' && solid.level) {
    const it = items.find((x) => x.kind === 'solid_fuel');
    if (it) it._o = 1; // solids stay first among the levels
  }
  items.sort((a, b) => a._o - b._o || (a.fuel_phase ?? '').localeCompare(b.fuel_phase ?? ''));
  const priority: PriorityItem[] = items.map(({ _o, ...rest }, i) => ({ ...rest, rank: i + 1 }));

  return {
    label: EXPERIMENT_LABEL,
    target,
    gap,
    phaseCoverage,
    zeroCoveragePhases,
    testMatrix: {
      note: TEST_MATRIX_NOTE,
      gravity: { ...(regime ? { regime } : {}), ...(gravityLevel !== undefined ? { level: gravityLevel } : {}) },
      points,
      pointCount: points.length,
      sentence: matrixSentence,
    },
    configuration: { prioritized: 'solid', comparable, sentence: configSentence },
    measurements: { recorded, plannedDataProducts: PLANNED_SOURCES.filter((p) => p.id === 'luci-data'), sentence: measurementSentence },
    plannedCoverage: { sources: PLANNED_SOURCES, statements },
    remainingGap: { points: remaining, sentence: remainingSentence },
    priority,
  };
}
