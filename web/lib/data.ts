// Server-only: reads the repository's data folder (../data by default).
// Imported only from Server Components.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseCsvObjects } from "./csv";
import { syntheticDataset } from "./fixtures";
import type { ConditionRecord, Dataset, Investigation, SourceFile } from "./types";

// turbopackIgnore: the data folder is read at run time and must not be traced into the
// build (data/raw holds gigabytes of PSI downloads).
const DATA_DIR = process.env.PYRION_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "data");

async function readText(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function loadInvestigations(): Promise<Investigation[]> {
  const text = await readText(path.join(DATA_DIR, "manifest", "investigations.csv"));
  if (!text) return [];
  return parseCsvObjects(text).map((r) => ({
    accession: r.accession,
    acronym: r.acronym,
    title: r.title,
    doi: r.doi,
    license: r.license,
    version: r.version,
    project_type: r.project_type,
  }));
}

async function loadConditionRecords(): Promise<{ records: ConditionRecord[]; files: string[] }> {
  const dir = path.join(DATA_DIR, "conditions");
  let names: string[] = [];
  try {
    names = (await readdir(dir)).filter((n) => n.toLowerCase().endsWith(".csv")).sort();
  } catch {
    return { records: [], files: [] };
  }
  const texts = await Promise.all(names.map((n) => readText(path.join(dir, n))));
  const records: ConditionRecord[] = [];
  texts.forEach((t) => {
    if (!t) return;
    for (const r of parseCsvObjects(t)) {
      if (!r.accession || !r.variable || r.value === undefined || r.value === "") continue;
      records.push({
        accession: r.accession,
        test_id: r.test_id || "*",
        variable: r.variable,
        value: r.value,
        unit: r.unit ?? "",
        value_original: r.value_original ?? "",
        unit_original: r.unit_original ?? "",
        method: r.method === "document" ? "document" : "table",
        source_file: r.source_file ?? "",
        source_location: r.source_location ?? "",
        quote: r.quote ?? "",
        status: r.status === "verified" || r.status === "insufficient_evidence" ? r.status : "extracted",
        note: r.note || undefined,
      });
    }
  });
  return { records, files: names.map((n) => `data/conditions/${n}`) };
}

async function loadSourceFiles(wanted: Set<string>): Promise<Record<string, SourceFile>> {
  const out: Record<string, SourceFile> = {};
  if (wanted.size === 0) return out;
  const texts = await Promise.all(
    ["P1", "P2", "P3"].map((p) => readText(path.join(DATA_DIR, "manifest", `checksums_${p}.csv`))),
  );
  for (const t of texts) {
    if (!t) continue;
    for (const r of parseCsvObjects(t)) {
      if (wanted.has(r.path) && !out[r.path]) out[r.path] = { sha256: r.sha256, source: r.source };
    }
  }
  return out;
}

export async function loadDataset(): Promise<Dataset> {
  const [investigations, { records, files }] = await Promise.all([loadInvestigations(), loadConditionRecords()]);
  if (records.length === 0 || investigations.length === 0) return syntheticDataset();
  const sourceFiles = await loadSourceFiles(new Set(records.map((r) => r.source_file)));
  return { mode: "psi", records, investigations, files: sourceFiles, conditionFiles: files };
}
