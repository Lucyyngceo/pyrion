// Node-only loader: reads data/conditions/<accession>.csv files. Kept apart from the pure core
// so the core can also run in a browser bundle.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseConditionCsv } from './records.ts';
import type { ConditionRecord, RejectedRow } from './types.ts';

export interface LoadedFile {
  file: string;
  sha256: string;
  records: number;
  rejected: number;
}

export interface LoadResult {
  dir: string;
  found: boolean;
  files: LoadedFile[];
  records: ConditionRecord[];
  rejected: RejectedRow[];
}

const FILE_RE = /^(PSI-[0-9]+)\.csv$/;

/** Load every <accession>.csv in `dir`, in sorted file-name order. Other files are ignored. */
export function loadConditionDir(dir: string): LoadResult {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return { dir, found: false, files: [], records: [], rejected: [] };
  const names = readdirSync(dir)
    .filter((n) => FILE_RE.test(n))
    .sort((a, b) => Number(a.slice(4, -4)) - Number(b.slice(4, -4)) || (a < b ? -1 : 1));
  const files: LoadedFile[] = [];
  const records: ConditionRecord[] = [];
  const rejected: RejectedRow[] = [];
  for (const name of names) {
    const buf = readFileSync(join(dir, name));
    const accession = (FILE_RE.exec(name) as RegExpExecArray)[1];
    const res = parseConditionCsv(buf.toString('utf8'), name, accession);
    files.push({ file: name, sha256: createHash('sha256').update(buf).digest('hex'), records: res.records.length, rejected: res.rejected.length });
    records.push(...res.records);
    rejected.push(...res.rejected);
  }
  return { dir, found: true, files, records, rejected };
}
