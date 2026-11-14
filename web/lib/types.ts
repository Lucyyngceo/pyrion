// Web-only types. Engine types live in ../engine and are re-exported by ./engine.ts.

export interface Investigation {
  accession: string;
  acronym: string;
  title: string;
  doi: string;
  license: string;
  version: string;
  project_type: string;
}

/** One data/conditions/<accession>.csv file, passed to the browser as text and parsed there by the engine. */
export interface ConditionFile {
  name: string;
  accession: string;
  text: string;
  sha256: string;
}

/** Integrity data for a downloaded PSI file, from data/manifest/checksums_P*.csv. */
export interface SourceFile {
  sha256: string;
  source: string;
}

export interface Dataset {
  /** "psi": records extracted from NASA PSI. "synthetic": the engine's labelled test fixtures. */
  mode: "psi" | "synthetic";
  files: ConditionFile[];
  investigations: Investigation[];
  /** Keyed by source_file (path relative to data/raw/), only files cited by the records. */
  sourceFiles: Record<string, SourceFile>;
  stats: { records: number; verified: number; flagged: number; rejected: number; accessions: number };
}
