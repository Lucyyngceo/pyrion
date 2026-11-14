// Shared types of the web app. They mirror schema/condition_record.schema.json.

export type GravityRegime = "microgravity" | "partial_gravity" | "normal_gravity";
export type FuelPhase = "solid" | "liquid" | "gas";
export type Diluent = "N2" | "He" | "CO2" | "Ar" | "mixed";

export const GRAVITY_REGIMES: GravityRegime[] = ["microgravity", "partial_gravity", "normal_gravity"];
export const FUEL_PHASES: FuelPhase[] = ["solid", "liquid", "gas"];
export const DILUENTS: Diluent[] = ["N2", "He", "CO2", "Ar", "mixed"];

export type Verdict = "APPLICABLE" | "EXTRAPOLATION" | "INSUFFICIENT_EVIDENCE" | "REGIME_BARRIER";

export interface ConditionRecord {
  accession: string;
  test_id: string;
  variable: string;
  value: string;
  unit: string;
  value_original: string;
  unit_original: string;
  method: "table" | "document";
  source_file: string;
  source_location: string;
  quote: string;
  status: "extracted" | "verified" | "insufficient_evidence";
  note?: string;
}

export interface Investigation {
  accession: string;
  acronym: string;
  title: string;
  doi: string;
  license: string;
  version: string;
  project_type: string;
}

/** Integrity data for a downloaded source file, from data/manifest/checksums_P*.csv. */
export interface SourceFile {
  sha256: string;
  source: string;
}

export interface Regime {
  gravity_regime: GravityRegime;
  fuel_phase: FuelPhase;
  diluent: Diluent;
}

export interface EnvelopePoint {
  accession: string;
  test_id: string;
  /** O2 mole fraction, 0..1 */
  o2: number;
  /** kPa */
  pressure: number;
  records: ConditionRecord[];
}

export interface EnvelopeLayer {
  key: string;
  regime: Regime;
  points: EnvelopePoint[];
  /** Convex hull vertices [o2, kPa], counter-clockwise. 1 or 2 vertices when the points are degenerate. */
  hull: [number, number][];
  accessions: string[];
}

export interface Target {
  gravity_regime: GravityRegime;
  /** multiples of Earth gravity; only meaningful for partial gravity */
  gravity_level?: number;
  fuel_phase: FuelPhase;
  diluent: Diluent;
  /** 0..1 */
  o2_mole_fraction: number;
  /** kPa */
  pressure: number;
}

export type ReasonKind = "match" | "barrier" | "inside" | "outside" | "missing";

export interface Reason {
  axis: string;
  kind: ReasonKind;
  text: string;
  /** The condition records that justify this reason: the receipt. */
  records: ConditionRecord[];
}

export interface InvestigationResult {
  accession: string;
  verdict: Verdict;
  reasons: Reason[];
  /** Normalized distance outside the envelope. Never set for REGIME_BARRIER: a barrier has no distance. */
  distance?: number;
}

export interface EngineInfo {
  /** "engine" when ../engine is connected, "provisional" for the web app's own stand-in rules. */
  kind: "engine" | "provisional";
  label: string;
}

export interface Dataset {
  /** "psi": records extracted from NASA PSI. "synthetic": labelled fixtures for development only. */
  mode: "psi" | "synthetic";
  records: ConditionRecord[];
  investigations: Investigation[];
  /** Keyed by source_file (path relative to data/raw/). Only files referenced by records. */
  files: Record<string, SourceFile>;
  /** Files under data/conditions/ that were read. */
  conditionFiles: string[];
}
