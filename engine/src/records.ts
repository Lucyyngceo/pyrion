// Reads condition records from CSV text and checks them against the shared schema
// (schema/condition_record.schema.json) plus the numeric rules the engine needs.
// A row that fails is rejected with a reason and never used.

import { parseCsv } from './csv.ts';
import {
  AXIS_UNITS,
  CONTINUOUS_AXES,
  REGIME_AXES,
  REGIME_VALUES,
  type ConditionRecord,
  type ContinuousAxis,
  type RecordStatus,
  type RegimeAxis,
  type RejectedRow,
} from './types.ts';

const REQUIRED_FIELDS = [
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
] as const;

const ACCESSION_RE = /^PSI-[0-9]+$/;
const VARIABLE_RE =
  /^(gravity_regime|fuel_phase|diluent|flame_type|o2_mole_fraction|burner_o2_mole_fraction|pressure|flow_velocity|sample_thickness|droplet_diameter_initial|ambient_temperature|gravity_level|fuel|material|geometry|flow_configuration|platform|outcome:[a-z0-9_]+)$/;
const NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
const STATUSES: readonly RecordStatus[] = ['extracted', 'verified', 'insufficient_evidence'];

export function isRegimeAxis(v: string): v is RegimeAxis {
  return (REGIME_AXES as readonly string[]).includes(v);
}

export function isContinuousAxis(v: string): v is ContinuousAxis {
  return (CONTINUOUS_AXES as readonly string[]).includes(v);
}

/** Strict decimal number parse. Returns null for anything that is not a plain finite number. */
export function parseNumber(s: string): number | null {
  const t = s.trim();
  if (!NUMBER_RE.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Value of a continuous record: a plain number, or a range "lo..hi" (schema value convention:
 * one cell stating a range). A range gives its two ends. Returns null if neither form, or lo > hi.
 */
export function parseValues(s: string): number[] | null {
  const parts = s.split('..');
  if (parts.length === 1) {
    const n = parseNumber(s);
    return n === null ? null : [n];
  }
  if (parts.length !== 2) return null;
  const lo = parseNumber(parts[0]);
  const hi = parseNumber(parts[1]);
  if (lo === null || hi === null || lo > hi) return null;
  return lo === hi ? [lo] : [lo, hi];
}

function numericProblem(axis: ContinuousAxis, n: number): string | null {
  if ((axis === 'o2_mole_fraction' || axis === 'burner_o2_mole_fraction') && (n < 0 || n > 1)) return `${axis} must be between 0 and 1`;
  if ((axis === 'pressure' || axis === 'ambient_temperature') && n <= 0) return `${axis} must be greater than 0`;
  if (n < 0) return `${axis} must not be negative`;
  return null;
}

export interface ParseResult {
  records: ConditionRecord[];
  rejected: RejectedRow[];
}

/**
 * Parse one data/conditions/<accession>.csv file.
 * @param file name used in origins and rejections (e.g. "PSI-69.csv")
 * @param expectedAccession if given, rows with another accession are rejected
 */
export function parseConditionCsv(text: string, file: string, expectedAccession?: string): ParseResult {
  const rows = parseCsv(text);
  const records: ConditionRecord[] = [];
  const rejected: RejectedRow[] = [];
  if (rows.length === 0) return { records, rejected };
  const header = rows[0].cells.map((h) => h.trim());
  const missing = REQUIRED_FIELDS.filter((f) => !header.includes(f));
  if (missing.length > 0) {
    rejected.push({ file, line: rows[0].line, reason: `header lacks required field(s): ${missing.join(', ')}` });
    return { records, rejected };
  }
  const col = (name: string) => header.indexOf(name);
  for (const row of rows.slice(1)) {
    const get = (name: string) => {
      const i = col(name);
      return i >= 0 && i < row.cells.length ? row.cells[i].trim() : '';
    };
    const reject = (reason: string) => rejected.push({ file, line: row.line, reason });
    if (row.cells.length !== header.length) {
      reject(`expected ${header.length} cells, found ${row.cells.length}`);
      continue;
    }
    const empty = REQUIRED_FIELDS.filter((f) => f !== 'unit' && f !== 'unit_original' && get(f) === '');
    if (empty.length > 0) {
      reject(`empty required field(s): ${empty.join(', ')}`);
      continue;
    }
    const accession = get('accession');
    const variable = get('variable');
    const value = get('value');
    const unit = get('unit');
    const method = get('method');
    const status = get('status');
    if (!ACCESSION_RE.test(accession)) {
      reject(`accession "${accession}" does not match PSI-<number>`);
      continue;
    }
    if (expectedAccession !== undefined && accession !== expectedAccession) {
      reject(`accession ${accession} in the file of ${expectedAccession}`);
      continue;
    }
    if (!VARIABLE_RE.test(variable)) {
      reject(`variable "${variable}" is not in the schema`);
      continue;
    }
    if (method !== 'table' && method !== 'document') {
      reject(`method "${method}" must be table or document`);
      continue;
    }
    if (!(STATUSES as readonly string[]).includes(status)) {
      reject(`status "${status}" must be extracted, verified or insufficient_evidence`);
      continue;
    }
    // Schema-level rules (apply whatever the status).
    if (isRegimeAxis(variable) && !REGIME_VALUES[variable].includes(value)) {
      reject(`${variable} value "${value}" must be one of ${REGIME_VALUES[variable].join(', ')}`);
      continue;
    }
    if ((variable === 'o2_mole_fraction' || variable === 'burner_o2_mole_fraction' || variable === 'pressure') && unit !== AXIS_UNITS[variable]) {
      reject(`${variable} unit "${unit}" must be "${AXIS_UNITS[variable]}"`);
      continue;
    }
    // Engine rules for values that count as evidence. A record flagged insufficient_evidence is
    // never used numerically, so it is kept even if its value is not a plain number.
    if (isContinuousAxis(variable) && status !== 'insufficient_evidence') {
      if (unit !== AXIS_UNITS[variable]) {
        reject(`${variable} unit "${unit}" must be "${AXIS_UNITS[variable]}"`);
        continue;
      }
      const ns = parseValues(value);
      if (ns === null) {
        reject(`${variable} value "${value}" is not a plain number or an ascending range lo..hi`);
        continue;
      }
      const problem = ns.map((n) => numericProblem(variable, n)).find((x) => x !== null) ?? null;
      if (problem !== null) {
        reject(problem);
        continue;
      }
    }
    records.push({
      accession,
      test_id: get('test_id'),
      variable,
      value,
      unit,
      value_original: get('value_original'),
      unit_original: get('unit_original'),
      method,
      source_file: get('source_file'),
      source_location: get('source_location'),
      quote: get('quote'),
      status: status as RecordStatus,
      note: get('note'),
      origin: { file, line: row.line },
    });
  }
  return { records, rejected };
}
