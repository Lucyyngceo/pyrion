// Shared types and constants of the PYRION applicability engine.
// The engine reads only condition records as defined in schema/condition_record.schema.json.

export const REGIME_AXES = ['gravity_regime', 'fuel_phase', 'diluent', 'flame_type'] as const;
export type RegimeAxis = (typeof REGIME_AXES)[number];

export const REGIME_VALUES: Readonly<Record<RegimeAxis, readonly string[]>> = {
  gravity_regime: ['microgravity', 'partial_gravity', 'normal_gravity'],
  fuel_phase: ['solid', 'liquid', 'gas'],
  diluent: ['N2', 'He', 'CO2', 'Ar', 'mixed'],
  flame_type: ['normal', 'inverse'],
};

/** Continuous axes in a fixed order. This order is used everywhere (output, distance sums). */
export const CONTINUOUS_AXES = [
  'o2_mole_fraction',
  'burner_o2_mole_fraction',
  'pressure',
  'flow_velocity',
  'sample_thickness',
  'droplet_diameter_initial',
  'ambient_temperature',
  'gravity_level',
] as const;
export type ContinuousAxis = (typeof CONTINUOUS_AXES)[number];

/** The only unit accepted for each continuous axis (schema/README.md). */
export const AXIS_UNITS: Readonly<Record<ContinuousAxis, string>> = {
  o2_mole_fraction: '1',
  burner_o2_mole_fraction: '1',
  pressure: 'kPa',
  flow_velocity: 'cm/s',
  sample_thickness: 'mm',
  droplet_diameter_initial: 'mm',
  ambient_temperature: 'K',
  gravity_level: 'g',
};

export const DESCRIPTIVE_VARIABLES = ['fuel', 'material', 'geometry', 'flow_configuration', 'platform'] as const;

export const RECORD_FIELDS = [
  'accession',
  'test_id',
  'variable',
  'value',
  'unit',
  'value_original',
  'unit_original',
  'method',
  'source_file',
  'source_location',
  'quote',
  'status',
  'note',
] as const;

export type RecordStatus = 'extracted' | 'verified' | 'insufficient_evidence';

/** One validated condition record, exactly as read from data/conditions/<accession>.csv. */
export interface ConditionRecord {
  accession: string;
  test_id: string;
  variable: string;
  value: string;
  unit: string;
  value_original: string;
  unit_original: string;
  method: 'table' | 'document';
  source_file: string;
  source_location: string;
  quote: string;
  status: RecordStatus;
  note: string;
  /** Where the engine read it: file name and 1-based line of the CSV (header = line 1). */
  origin: { file: string; line: number };
}

export interface RejectedRow {
  file: string;
  line: number;
  reason: string;
}

/** What a receipt shows for one record. Every number in a verdict traces to one of these. */
export interface Citation {
  accession: string;
  test_id: string;
  variable: string;
  value: string;
  unit: string;
  value_original: string;
  unit_original: string;
  note: string;
  status: RecordStatus;
  method: 'table' | 'document';
  source_file: string;
  source_location: string;
  quote: string;
}

export type Verdict = 'APPLICABLE' | 'EXTRAPOLATION' | 'INSUFFICIENT_EVIDENCE' | 'REGIME_BARRIER';

/** A target condition. Continuous values use the schema units (o2 as a fraction, pressure in kPa). */
export interface Target {
  regime: Partial<Record<RegimeAxis, string>>;
  continuous: Partial<Record<ContinuousAxis, number>>;
  /**
   * Shown, never compared. A gravity level typed by the user selects the regime but is not a
   * continuous axis (no condition record carries gravity_level), so it lives here.
   * `gravity_not_covered`: the stated gravity has no regime in this dataset (above normal gravity);
   * every cluster is then INSUFFICIENT_EVIDENCE with this message as the reason.
   */
  informational?: { gravity_level?: number; gravity_not_covered?: string };
}

export interface EngineOptions {
  /**
   * 'extracted' (default): records with status extracted or verified count as evidence.
   * 'verified': only records a human has checked against the source count.
   * Records with status insufficient_evidence never count, whatever this option says.
   */
  minimumStatus?: 'extracted' | 'verified';
}

export interface AxisScale {
  axis: ContinuousAxis;
  unit: string;
  min: number | null;
  max: number | null;
  /** Divisor used to make the axis dimensionless. See README, "Distance". */
  scale: number;
  scaleRule: 'range' | 'abs_value' | 'unit';
}

export type ReasonCode =
  | 'regime_barrier'
  | 'regime_match'
  | 'regime_missing'
  | 'regime_conflicting'
  | 'target_regime_unstated'
  | 'axis_missing'
  | 'unpaired_values'
  | 'inside_range'
  | 'outside_range'
  | 'inside_hull'
  | 'outside_hull'
  | 'nearest_point'
  | 'incomplete_tests'
  | 'flagged_records_ignored';

export interface Reason {
  code: ReasonCode;
  /** True when the reason is context only and did not decide the verdict. */
  informational: boolean;
  axis: string | null;
  /** One plain sentence for a reader: no internal names, no raw precision. */
  message: string;
  /** Figures for people who want them (normalized distances, test-id lists); never needed to read the sentence. */
  technicalNote?: string;
  citations: Citation[];
}

/**
 * Measurement tolerance used by every inside-the-envelope test, on every continuous axis: a target counts
 * as inside a measured range or hull when it is within ±0.5 % of its own value of it.
 * PYRION convention, not a NASA value. Why 0.5 %: it is the worst-case rounding of a three-significant-digit
 * value (1.00 → ±0.5 %) and sits inside the usual accuracy of pressure transducers (0.25–1 % of reading),
 * so "101.3 kPa", "14.7 psia" and "760 mmHg" all count as the tested 1 atm, while a real gap
 * (110 kPa against 101.325) does not. Without it a zero-width envelope (all records at exactly 1 atm)
 * would turn the same physical pressure into APPLICABLE or EXTRAPOLATION by the digits typed.
 */
export const MEASUREMENT_TOLERANCE_REL = 0.005;
export const MEASUREMENT_TOLERANCE_NOTE = `PYRION convention, not a NASA value: a target within ±${MEASUREMENT_TOLERANCE_REL * 100} % of its own value of a measured range or tested region counts as inside it (rounding of typed values and typical instrument accuracy).`;

export interface AxisCheck {
  axis: ContinuousAxis;
  unit: string;
  target: number;
  min: number | null;
  max: number | null;
  status: 'inside' | 'below' | 'above' | 'missing';
  /** Distance from the target to the nearest measured bound, in axis units. 0 when inside. */
  gap: number | null;
  /** gap divided by the axis scale. */
  gapNormalized: number | null;
  minCitations: Citation[];
  maxCitations: Citation[];
  /** Present (true) only when the target counts as inside because of the measurement tolerance. */
  viaTolerance?: true;
}

export interface PlanePoint {
  o2_mole_fraction: number;
  pressure: number;
}

export interface HullCheck {
  /** Convex hull of the measured (O2, pressure) points, counter-clockwise. */
  hull: PlanePoint[];
  inside: boolean;
  /** Normalized distance from the target to the hull. 0 when inside. */
  distanceNormalized: number;
  pointCount: number;
  /** Present (true) only when the target counts as inside because of the measurement tolerance. */
  viaTolerance?: true;
}

export interface RegimeState {
  axis: RegimeAxis;
  state: 'known' | 'missing' | 'conflicting';
  values: string[];
}

export interface ClusterVerdict {
  accession: string;
  clusterKey: string;
  regime: RegimeState[];
  tests: string[];
  verdict: Verdict;
  /** 1-based rank among APPLICABLE then EXTRAPOLATION clusters. null for the other verdicts. */
  rank: number | null;
  /**
   * Normalized distance from the target to the nearest measured point.
   * null means not defined: across a regime barrier, or when the evidence is insufficient.
   */
  distance: number | null;
  distanceNote: string;
  /** Per-axis checks. For REGIME_BARRIER they are context only and never used for ranking. */
  axes: AxisCheck[];
  hull: HullCheck | null;
  /** 'verified' only if every record used for this verdict has status verified. */
  evidenceStatus: 'verified' | 'includes_unverified' | 'none';
  descriptors: Record<string, string[]>;
  reasons: Reason[];
}

export type BlockerCode =
  | 'AXIS_NOT_RECORDED'
  | 'NO_USABLE_VALUE'
  | 'REGIME_NOT_TESTED'
  | 'RECORDS_DISAGREE'
  | 'AXES_NOT_RECORDED_TOGETHER'
  | 'VALUES_NOT_PAIRED';

/** Why an investigation is INSUFFICIENT_EVIDENCE or REGIME_BARRIER, in a fixed code plus a plain sentence. */
export interface Blocker {
  code: BlockerCode;
  /** The axis concerned, or null when it concerns several. */
  axis: string | null;
  /** REGIME_NOT_TESTED: the values of that axis the investigation was tested in. RECORDS_DISAGREE: the values recorded. */
  testedValues?: string[];
  sentence: string;
  /** What NAVIGATOR (routesToEvidence) would do about it, when something can be done. */
  action?: { kind: 'leave_open' | 'switch_regime'; axis: string; to?: string; sentence: string };
}

export interface InvestigationVerdict {
  accession: string;
  verdict: Verdict;
  /** Present for INSUFFICIENT_EVIDENCE and REGIME_BARRIER: the reasons of the deciding cluster. */
  blockers?: Blocker[];
  /** Cluster that gives the investigation verdict (see README, "One verdict per investigation"). */
  decidingCluster: string;
  clusters: { clusterKey: string; verdict: Verdict }[];
}

export interface Evaluation {
  engine: { name: string; version: string };
  target: Target;
  /** Regime axes the target leaves open. They are not compared; every verdict says so. */
  openRegimeAxes: RegimeAxis[];
  /**
   * Present when the target states a gravity regime in which no investigation was tested at all:
   * "No PSI test in this gravity regime". testedValues are the gravity regimes the investigations do state.
   */
  regimeUntested?: { axis: 'gravity_regime'; value: string; testedValues: string[] };
  options: Required<EngineOptions>;
  normalization: AxisScale[];
  counts: {
    investigations: Record<Verdict, number>;
    clusters: Record<Verdict, number>;
    recordsUsed: number;
    recordsFlaggedInsufficient: number;
    recordsBelowMinimumStatus: number;
  };
  investigations: InvestigationVerdict[];
  /** APPLICABLE then EXTRAPOLATION clusters, nearest first. */
  ranked: ClusterVerdict[];
  /** INSUFFICIENT_EVIDENCE then REGIME_BARRIER clusters. Never ranked. */
  unranked: ClusterVerdict[];
}

export const ENGINE_NAME = 'pyrion-applicability-engine';
export const ENGINE_VERSION = '0.2.0';
