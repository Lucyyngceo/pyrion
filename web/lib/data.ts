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
  return rowsOf(text).map((r) => ({
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

export async function loadDataset(): Promise<Dataset> {
  const [investigations, files] = await Promise.all([loadInvestigations(), readConditionFiles(path.join(DATA_DIR, "conditions"))]);
  const real = stats(files);
  if (real.stats.records > 0) {
    return { mode: "psi", files, investigations, sourceFiles: await loadSourceFiles(real.sources), stats: real.stats };
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
