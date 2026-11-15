// Server-only: reads the repository's data folder (../data by default) and, when it holds no
// condition records yet, the engine's synthetic test fixtures. Imported only from app/page.tsx.

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseConditionCsv, parseCsv } from "./engine";
import type { ConditionFile, Dataset, Investigation, SourceFile } from "./types";

// turbopackIgnore: these folders are read at run time and must not be traced into the build
// (data/raw holds gigabytes of PSI downloads).
const DATA_DIR = process.env.PYRION_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "data");
const FIXTURE_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "engine", "test", "fixtures", "synthetic");

const FILE_RE = /^(PSI-[0-9]+)\.csv$/;

async function readText(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

/** CSV text to objects keyed by header; lines starting with "#" before the header are skipped. */
function rowsOf(text: string): Record<string, string>[] {
  const rows = parseCsv(text).filter((r) => !(r.cells[0] ?? "").startsWith("#"));
  if (rows.length === 0) return [];
  const header = rows[0].cells.map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r.cells[i] ?? "").trim()])));
}

async function readConditionFiles(dir: string): Promise<ConditionFile[]> {
  let names: string[] = [];
  try {
    names = (await readdir(dir)).filter((n) => FILE_RE.test(n));
  } catch {
    return [];
  }
  names.sort((a, b) => Number(a.slice(4, -4)) - Number(b.slice(4, -4)) || a.localeCompare(b));
  const files = await Promise.all(
    names.map(async (name) => {
      const buf = await readFile(path.join(dir, name));
      return {
        name,
        accession: (FILE_RE.exec(name) as RegExpExecArray)[1],
        text: buf.toString("utf8"),
        sha256: createHash("sha256").update(buf).digest("hex"),
      };
    }),
  );
  return files;
}

async function loadInvestigations(): Promise<Investigation[]> {
  const text = await readText(path.join(DATA_DIR, "manifest", "investigations.csv"));
  if (!text) return [];
  const pubs = new Map<string, string[]>();
  for (const r of rowsOf((await readText(path.join(DATA_DIR, "manifest", "publications.csv"))) ?? "")) {
    if (!r.title) continue;
    const list = pubs.get(r.accession) ?? [];
    list.push(r.title);
    pubs.set(r.accession, list);
  }
  return rowsOf(text).map((r) => ({
    publications: pubs.get(r.accession) ?? [],
    accession: r.accession,
    acronym: r.acronym,
    title: r.title,
    doi: r.doi,
    license: r.license,
    version: r.version,
    project_type: r.project_type,
  }));
}

async function loadSourceFiles(wanted: Set<string>): Promise<Record<string, SourceFile>> {
  const out: Record<string, SourceFile> = {};
  if (wanted.size === 0) return out;
  const texts = await Promise.all(
    ["P1", "P2", "P3", "P4"].map((p) => readText(path.join(DATA_DIR, "manifest", `checksums_${p}.csv`))),
  );
  for (const t of texts) {
    if (!t) continue;
    for (const r of rowsOf(t)) {
      if (wanted.has(r.path) && !out[r.path]) out[r.path] = { sha256: r.sha256, source: r.source };
    }
  }
  return out;
}

function stats(files: ConditionFile[]) {
  let records = 0;
  let verified = 0;
  let flagged = 0;
  let rejected = 0;
  const sources = new Set<string>();
  for (const f of files) {
    const res = parseConditionCsv(f.text, f.name, f.accession);
    records += res.records.length;
    rejected += res.rejected.length;
    for (const r of res.records) {
      if (r.status === "verified") verified++;
      if (r.status === "insufficient_evidence") flagged++;
      sources.add(r.source_file);
    }
  }
  return { stats: { records, verified, flagged, rejected, accessions: files.length }, sources };
}

async function loadEmbedding(): Promise<Dataset["embedding"]> {
  const t = await readText(path.join(DATA_DIR, "derived", "text_similarity.json"));
  if (!t) return undefined;
  try {
    const j = JSON.parse(t) as { model?: { name?: unknown; license?: unknown }; rankings?: unknown };
    if (typeof j.model?.name !== "string" || typeof j.rankings !== "object" || j.rankings === null) return undefined;
    const rankings: Record<string, { accession: string; score: number }[]> = {};
    for (const [k, v] of Object.entries(j.rankings as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue;
      rankings[k] = v
        .filter((x): x is { accession: string; cosine: number } => !!x && typeof (x as { accession?: unknown }).accession === "string" && typeof (x as { cosine?: unknown }).cosine === "number")
        .map((x) => ({ accession: x.accession, score: x.cosine }));
    }
    return { model: j.model.name, license: typeof j.model.license === "string" ? j.model.license : "", rankings };
  } catch {
    return undefined;
  }
}

/** Chips only (never the quotes): the safety legs an investigation has a tagged quote for, and its relevance tier. Defensive: a missing or odd file gives nothing. */
async function loadLenses(): Promise<Dataset["lenses"]> {
  const t = await readText(path.join(DATA_DIR, "derived", "lenses.json"));
  if (!t) return undefined;
  try {
    const j = JSON.parse(t) as { investigations?: { accession?: unknown; legs?: Record<string, unknown[]>; strength?: { value?: unknown } }[] };
    const out: NonNullable<Dataset["lenses"]> = {};
    for (const i of j.investigations ?? []) {
      if (typeof i.accession !== "string") continue;
      out[i.accession] = { legs: Object.entries(i.legs ?? {}).filter(([, v]) => Array.isArray(v) && v.length > 0).map(([k]) => k), tier: typeof i.strength?.value === "string" ? i.strength.value : null };
    }
    return Object.keys(out).length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

export async function loadDataset(): Promise<Dataset> {
  const [investigations, files] = await Promise.all([loadInvestigations(), readConditionFiles(path.join(DATA_DIR, "conditions"))]);
  const real = stats(files);
  if (real.stats.records > 0) {
    return { mode: "psi", files, investigations, sourceFiles: await loadSourceFiles(real.sources), embedding: await loadEmbedding(), lenses: await loadLenses(), stats: real.stats };
  }
  const fixtures = await readConditionFiles(FIXTURE_DIR);
  return {
    mode: "synthetic",
    files: fixtures,
    investigations: fixtures.map((f) => ({
      accession: f.accession,
      acronym: "Synthetic fixture",
      title: "Engine test fixture, invented for development. Not NASA data.",
      doi: "",
      license: "",
      version: "0",
      project_type: "Synthetic fixture",
    })),
    sourceFiles: {},
    stats: stats(fixtures).stats,
  };
}

export interface Lineage {
  psiFiles: number;
  psiBytes: number;
  selectedFiles: number;
  selectedBytes: number;
  validation: {
    generatedAt: string;
    records: number;
    cellsTraced: number;
    quotesTraced: number;
    traceRan: boolean;
    blocker: number;
    major: number;
    minor: number;
  } | null;
}

/** Counts for the data lineage on /data: PSI inventory, downloaded files, and the last committed validation report. */
export async function loadLineage(): Promise<Lineage> {
  let psiFiles = 0;
  let psiBytes = 0;
  for (const r of rowsOf((await readText(path.join(DATA_DIR, "manifest", "coverage.csv"))) ?? "")) {
    psiFiles += Number(r.files_in_psi) || 0;
    psiBytes += Number(r.bytes_in_psi) || 0;
  }
  const seen = new Set<string>();
  let selectedFiles = 0;
  let selectedBytes = 0;
  for (const p of ["P1", "P2", "P3", "P4"]) {
    for (const r of rowsOf((await readText(path.join(DATA_DIR, "manifest", `checksums_${p}.csv`))) ?? "")) {
      if (r.status !== "ok" || seen.has(r.path)) continue;
      seen.add(r.path);
      selectedFiles++;
      selectedBytes += Number(r.bytes) || 0;
    }
  }
  let validation: Lineage["validation"] = null;
  const report = await readText(path.join(DATA_DIR, "..", "validation", "reports", "latest.json"));
  if (report) {
    try {
      const d = JSON.parse(report);
      validation = {
        generatedAt: String(d.generated_at_utc ?? ""),
        records: Number(d.stats?.records ?? 0),
        cellsTraced: Number(d.stats?.cells_traced ?? 0),
        quotesTraced: Number(d.stats?.quotes_traced ?? 0),
        traceRan: Boolean(d.trace_ran),
        blocker: Number(d.counts?.BLOCKER ?? 0),
        major: Number(d.counts?.MAJOR ?? 0),
        minor: Number(d.counts?.MINOR ?? 0),
      };
    } catch {
      validation = null;
    }
  }
  return { psiFiles, psiBytes, selectedFiles, selectedBytes, validation };
}
