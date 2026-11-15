// Server only: reads the derived lens and timeline files and the condition records from ../data.
// The JSON files are produced by tools/build_lenses.py and tools/build_timeline.py.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseConditionCsv } from "../../../engine/src/records.ts";
import type { ConditionRecord } from "../../../engine/src/types.ts";
import type { LensesFile, TimelineFile } from "./model.ts";

const DATA = path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "data");

export function loadLenses(): LensesFile {
  return JSON.parse(readFileSync(path.join(DATA, "derived", "lenses.json"), "utf8")) as LensesFile;
}

export function loadTimeline(): TimelineFile {
  return JSON.parse(readFileSync(path.join(DATA, "derived", "timeline.json"), "utf8")) as TimelineFile;
}

/** Every condition record of data/conditions/PSI-*.csv, parsed by the engine. */
export function loadConditionRecords(): ConditionRecord[] {
  const dir = path.join(DATA, "conditions");
  const names = readdirSync(dir).filter((n) => /^PSI-\d+\.csv$/.test(n)).sort((a, b) => Number(a.slice(4, -4)) - Number(b.slice(4, -4)));
  return names.flatMap((n) => parseConditionCsv(readFileSync(path.join(dir, n), "utf8"), n, n.slice(0, -4)).records);
}
