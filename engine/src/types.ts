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
  message: string;
  citations: Citation[];
}

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
   * null means undefined: across a regime barrier, or when the evidence is insufficient.
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

export interface InvestigationVerdict {
  accession: string;
  verdict: Verdict;
  /** Cluster that gives the investigation verdict (see README, "One verdict per investigation"). */
  decidingCluster: string;
  clusters: { clusterKey: string; verdict: Verdict }[];
}

export interface Evaluation {
  engine: { name: string; version: string };
  target: Target;
  /** Regime axes the target leaves open. They are not compared; every verdict says so. */
  openRegimeAxes: RegimeAxis[];
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
export const ENGINE_VERSION = '0.1.0';
