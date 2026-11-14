// TRANSFER_HYPOTHESIS (docs/TRANSFER.md): which microgravity tests of a curved sample in a forced
// flow have a stretch rate inside the buoyant-stretch band of a target gravity level.
//
// A transfer hypothesis is NEVER evidence and NEVER counts as APPLICABLE. It is reported in addition
// to the regime verdict of evaluate(), which stays REGIME_BARRIER. Pure functions, no I/O.

import { parseCsv } from './csv.ts';
import {
  DENSITY_FACTOR_PMMA_AIR,
  buoyantStretch,
  forcedStretchCylinder,
  forcedStretchRodTip,
  type Band,
  type BuoyantVariant,
  type SourceCitation,
  type StretchResult,
} from './stretch.ts';
import { compareAccession, compareNatural } from './evidence.ts';
import type { Target } from './types.ts';

export type TransferGeometry = 'cylinder' | 'rod_tip';

/** One microgravity test with the inputs the stretch formulas need. */
export interface TransferTest {
  accession: string;
  test_id: string;
  /** Gravity regime as stated by a source. undefined = not stated; such a test is not used. */
  gravity_regime: 'microgravity' | 'partial_gravity' | 'normal_gravity' | undefined;
  material: string;
  geometry: TransferGeometry;
  /** Why this formula was chosen for this sample (shown with the result). */
  geometryBasis: string;
  radiusCm: number;
  flowCmS: Band;
  /** Regime axes the source states for this test; missing = unknown. */
  regime: Partial<Record<'fuel_phase' | 'diluent' | 'flame_type', string>>;
  o2_mole_fraction?: number;
  pressure_kpa?: number;
  /** Where the inputs come from (file, row, original text). Shown as the receipt. */
  inputRecords: { file: string; location: string; note: string }[];
}

export type GravityTargetId = 'moon' | 'mars' | 'earth';

export interface GravityTarget {
  id: GravityTargetId;
  label: string;
  /** In units of Earth gravity. */
  level: number;
  regime: 'partial_gravity' | 'normal_gravity';
  source: SourceCitation | { note: string };
}

export const GRAVITY_TARGETS: Record<GravityTargetId, GravityTarget> = {
  moon: {
    id: 'moon',
    label: 'Moon, 0.165 g',
    level: 0.165,
    regime: 'partial_gravity',
    source: {
      file: 'ntrs-20260001966/Ferkul-Lunar and Planetary Science Conf 2026 v2.pdf',
      page: 13,
      quote: 'Lunar-g = 0.165 gE',
      supports: 'lunar gravity level of the FM2 centrifuge setup (the engine presets use 0.16 g from NTRS 20210020446, p. 3)',
    },
  },
  mars: {
    id: 'mars',
    label: 'Mars, 0.38 g',
    level: 0.38,
    regime: 'partial_gravity',
    source: {
      file: 'ntrs-20010074003/20010074003.pdf',
      page: 2,
      quote: 'partial-gravity environments of 0.1, 0.16, and 0.38 g/gearth',
      supports:
        'the paper lists 0.38 g/gEarth as a KC-135 partial-gravity level; it does not label it Mars. The value 0.38 g for Mars is the one given in docs/TRANSFER.md.',
    },
  },
  earth: {
    id: 'earth',
    label: 'Earth, 1 g',
    level: 1,
    regime: 'normal_gravity',
    source: { note: '1 g_earth is the unit of the gravity level (docs/TRANSFER.md).' },
  },
};

/** The target with a gravity level and regime added (replacing any it had). */
export function withGravity(target: Target, id: GravityTargetId): Target {
  const g = GRAVITY_TARGETS[id];
  return {
    regime: { ...target.regime, gravity_regime: g.regime },
    continuous: { ...target.continuous, gravity_level: g.level },
  };
}

/** Limits from docs/TRANSFER.md, always returned with a hypothesis. */
export const TRANSFER_LIMITS: readonly string[] = [
  'Geometry. The expressions are for stagnation-point flow on curved bodies. Flat fabric sheets (SIBAL, Nomex in BASS, BASS-II, Saffire) have no radius R: no stretch rate is computed for them.',
  'Material dependence. The direction of the gravity effect depends on the material (NTRS 20250006779, pp. 18-19). An analog found for PMMA says nothing about Nomex.',
  'Scale and time. Sample size and test duration differ between an ISS glovebox, a centrifuge drop (about 5 s) and the lunar surface.',
  'Pressure. Stretch equivalence does not account for a pressure difference; pressure stays a separate axis.',
  'It is a hypothesis. FM2 (lunar surface) is designed to test this kind of bridge. Until then, nothing here is a prediction of flame behavior on the Moon.',
];

export type Relation = 'within' | 'overlap' | 'outside';
export type AxisStatus = 'same' | 'different' | 'unknown' | 'open';

export interface TransferHypothesis {
  kind: 'TRANSFER_HYPOTHESIS';
  /** Never evidence. */
  evidenceClass: 'hypothesis';
  countsAsApplicable: false;
  accession: string;
  test_id: string;
  material: string;
  geometry: TransferGeometry;
  geometryBasis: string;
  targetGravity: { level: number; regime: string };
  /** Stretch of the test, from its forced flow (g = 0): a band over the flow readings of the test. */
  testStretch: StretchResult;
  /** Buoyant stretch of a body of the same radius at the target gravity. */
  targetStretch: StretchResult;
  relation: Relation;
  /** within the target band AND no regime axis stated by the target is different or unknown. */
  isAnalog: boolean;
  /** Why isAnalog is false, in plain words. */
  blockers: string[];
  regimeAxes: { axis: string; target: string | null; test: string | null; status: AxisStatus }[];
  atmosphere: {
    o2_mole_fraction: { target: number | null; test: number | null; difference: number | null };
    pressure_kpa: { target: number | null; test: number | null; difference: number | null };
  };
  inputRecords: TransferTest['inputRecords'];
  /** All sources: formulas, density factor, target gravity. */
  sources: SourceCitation[];
  assumptions: string[];
  limits: readonly string[];
}

export interface Excluded {
  accession: string;
  test_id: string;
  reason: string;
}

export interface TransferReport {
  target: Target;
  buoyantVariant: BuoyantVariant;
  hypotheses: TransferHypothesis[];
  excluded: Excluded[];
  /** Why no hypothesis exists at all (for example, the target is microgravity). null otherwise. */
  notComputable: string | null;
}

export interface TransferOptions {
  /** Density factor for materials other than PMMA. PMMA in air uses the band of the source. */
  densityFactor?: Band;
  buoyantVariant?: BuoyantVariant;
}

const PMMA_RE = /pmma|plexiglas|perspex|polymethyl/i;

function relationOf(test: Band, target: Band): Relation {
  if (test.hi < target.lo || test.lo > target.hi) return 'outside';
  return test.lo >= target.lo && test.hi <= target.hi ? 'within' : 'overlap';
}

function axisStatus(t: string | undefined, e: string | undefined): AxisStatus {
  if (t === undefined) return 'open';
  if (e === undefined) return 'unknown';
  return t === e ? 'same' : 'different';
}

function diff(a: number | undefined, b: number | undefined) {
  return { target: a ?? null, test: b ?? null, difference: a !== undefined && b !== undefined ? a - b : null };
}

export function transferHypotheses(target: Target, tests: readonly TransferTest[], options: TransferOptions = {}): TransferReport {
  const variant = options.buoyantVariant ?? 'eq1';
  const g = target.continuous.gravity_level;
  const out: TransferReport = { target, buoyantVariant: variant, hypotheses: [], excluded: [], notComputable: null };
  if (target.regime.gravity_regime === 'microgravity') {
    out.notComputable = 'The target is microgravity: PSI microgravity tests are directly comparable, there is nothing to transfer.';
    return out;
  }
  if (g === undefined) {
    out.notComputable = 'The target states no gravity_level, so a buoyant stretch cannot be computed.';
    return out;
  }
  const sorted = [...tests].sort((a, b) => compareAccession(a.accession, b.accession) || compareNatural(a.test_id, b.test_id));
  for (const t of sorted) {
    const skip = (reason: string) => out.excluded.push({ accession: t.accession, test_id: t.test_id, reason });
    if (t.gravity_regime !== 'microgravity') {
      skip(t.gravity_regime === undefined ? 'gravity regime of the test is not stated by a source' : `test gravity regime is ${t.gravity_regime}, not microgravity`);
      continue;
    }
    const isPmma = PMMA_RE.test(t.material);
    const factor = isPmma ? DENSITY_FACTOR_PMMA_AIR : options.densityFactor;
    if (factor === undefined) {
      skip(`no density factor for material "${t.material}": the source gives one only for PMMA in air; supply it as an input`);
      continue;
    }
    const testStretch = t.geometry === 'cylinder' ? forcedStretchCylinder(t.flowCmS, t.radiusCm) : forcedStretchRodTip(t.flowCmS, t.radiusCm);
    const targetStretch = buoyantStretch(g, t.radiusCm, { lo: factor.lo, hi: factor.hi }, variant);
    const relation = relationOf(testStretch.value, targetStretch.value);
    const regimeAxes = (['fuel_phase', 'diluent', 'flame_type'] as const).map((axis) => ({
      axis,
      target: target.regime[axis] ?? null,
      test: t.regime[axis] ?? null,
      status: axisStatus(target.regime[axis], t.regime[axis]),
    }));
    const blockers: string[] = [];
    if (relation !== 'within') blockers.push(relation === 'overlap' ? 'the stretch band of the test only partly overlaps the target band' : 'the stretch rate of the test is outside the target band');
    for (const a of regimeAxes) {
      if (a.status === 'different') blockers.push(`${a.axis}: target ${a.target}, test ${a.test}`);
      if (a.status === 'unknown') blockers.push(`${a.axis}: stated by the target, not stated for the test`);
    }
    const sources = [...testStretch.sources.slice(0, 1), ...targetStretch.sources, ...(isPmma ? DENSITY_FACTOR_PMMA_AIR.sources : [])];
    const gt = Object.values(GRAVITY_TARGETS).find((x) => x.level === g);
    if (gt && 'file' in gt.source) sources.push(gt.source);
    out.hypotheses.push({
      kind: 'TRANSFER_HYPOTHESIS',
      evidenceClass: 'hypothesis',
      countsAsApplicable: false,
      accession: t.accession,
      test_id: t.test_id,
      material: t.material,
      geometry: t.geometry,
      geometryBasis: t.geometryBasis,
      targetGravity: { level: g, regime: target.regime.gravity_regime ?? 'not stated' },
      testStretch,
      targetStretch,
      relation,
      isAnalog: blockers.length === 0,
      blockers,
      regimeAxes,
      atmosphere: {
        o2_mole_fraction: diff(target.continuous.o2_mole_fraction, t.o2_mole_fraction),
        pressure_kpa: diff(target.continuous.pressure, t.pressure_kpa),
      },
      inputRecords: t.inputRecords,
      sources,
      assumptions: [
        ...(isPmma ? DENSITY_FACTOR_PMMA_AIR.assumptions : [`Density factor supplied by the caller: ${factor.lo} to ${factor.hi}.`]),
        `Buoyant stretch by ${targetStretch.formulaId}.`,
        'The flow readings of the test are used as a band (lowest to highest listed); the source table calls them display readings, not steady velocities.',
        'The target is a body of the same radius at the target gravity with no imposed flow.',
      ],
      limits: TRANSFER_LIMITS,
    });
  }
  return out;
}

// ---------- adapter for data/derived/bass2_flow_steps.csv ----------

export interface FlowStepsOptions {
  /** Gravity regime of these tests, as stated by a source the caller can cite. Default: not stated. */
  gravityRegime?: TransferTest['gravity_regime'];
  /**
   * Formula for a rod. The table does not say how the rod sits in the flow, so this is an explicit
   * choice, repeated in each result: 'rod_tip' (3/2 U/R, rod burning from its end in a flow along
   * its axis, NTRS 20150008961) or 'cylinder' (2U/R, flow across the rod).
   */
  rodFormula?: TransferGeometry;
}

/**
 * Tests of data/derived/bass2_flow_steps.csv that the stretch formulas can use: rows with
 * parse_status ok, geometry_class rod, a stated sample radius and at least one flow reading.
 * Columns used: accession, test_id, material, geometry_class, size_original, sample_radius_mm,
 * radius_basis, o2_initial, flow_steps, flow_unit, parse_status, source_file, source_row.
 * Rows without a radius (films, sheets, spheres, rods without an inch mark) are not guessed.
 */
export function transferTestsFromFlowSteps(csvText: string, options: FlowStepsOptions = {}): { tests: TransferTest[]; skipped: Excluded[] } {
  const rows = parseCsv(csvText);
  const tests: TransferTest[] = [];
  const skipped: Excluded[] = [];
  if (rows.length === 0) return { tests, skipped };
  const h = rows[0].cells.map((x) => x.trim());
  const need = ['accession', 'test_id', 'material', 'geometry_class', 'sample_radius_mm', 'radius_basis', 'o2_initial', 'flow_steps', 'flow_unit', 'parse_status', 'source_file', 'source_row'];
  const missing = need.filter((c) => !h.includes(c));
  if (missing.length > 0) throw new Error(`flow-steps table lacks column(s): ${missing.join(', ')}`);
  const formula = options.rodFormula ?? 'rod_tip';
  for (const r of rows.slice(1)) {
    const c = (name: string) => (r.cells[h.indexOf(name)] ?? '').trim();
    const accession = c('accession');
    const test_id = c('test_id');
    const skip = (reason: string) => skipped.push({ accession, test_id, reason });
    if (c('parse_status') !== 'ok') skip('flow cell is ambiguous in the derived table');
    else if (c('geometry_class') !== 'rod') skip(`geometry is ${c('geometry_class')}: no sample radius, no stretch rate`);
    else if (c('sample_radius_mm') === '') skip('rod without a stated radius');
    else if (c('flow_unit') !== 'cm/s') skip('flow unit is not cm/s');
    else {
      const flows = c('flow_steps').split(/\s+/).map(Number);
      const radiusMm = Number(c('sample_radius_mm'));
      if (flows.length === 0 || flows.some((x) => !Number.isFinite(x) || x < 0) || !(radiusMm > 0)) skip('flow readings or radius are not plain positive numbers');
      else {
        const o2 = c('o2_initial') === '' ? undefined : Number(c('o2_initial'));
        tests.push({
          accession,
          test_id,
          gravity_regime: options.gravityRegime,
          material: c('material'),
          geometry: formula,
          geometryBasis:
            formula === 'rod_tip'
              ? 'rod burning from its end in a flow along its axis (3/2 U/R); the table does not state the orientation, chosen by the caller'
              : 'flow across the rod (2U/R); the table does not state the orientation, chosen by the caller',
          radiusCm: radiusMm / 10,
          flowCmS: { lo: Math.min(...flows), hi: Math.max(...flows) },
          regime: {},
          ...(o2 !== undefined && Number.isFinite(o2) ? { o2_mole_fraction: o2 } : {}),
          inputRecords: [
            { file: c('source_file'), location: `data row ${c('source_row')}; derived table data/derived/bass2_flow_steps.csv`, note: `radius: ${c('radius_basis')}; flow readings (cm/s, display): ${c('flow_steps')}` },
          ],
        });
      }
    }
  }
  return { tests, skipped };
}
