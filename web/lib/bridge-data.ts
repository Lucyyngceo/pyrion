// Server-only: reads data/derived/bass2_flow_steps.csv and the source of the PSI-25 gravity regime.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseConditionCsv } from "./engine";

const DATA_DIR = process.env.PYRION_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "data");

export interface BridgeData {
  csv: string | null;
  /** The record that states the gravity regime of the BASS-II tests (PSI-25). */
  gravitySource: { file: string; location: string; quote: string; status: string } | null;
}

async function text(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

export async function loadBridgeData(): Promise<BridgeData> {
  const csv = await text(path.join(DATA_DIR, "derived", "bass2_flow_steps.csv"));
  const cond = await text(path.join(DATA_DIR, "conditions", "PSI-25.csv"));
  let gravitySource: BridgeData["gravitySource"] = null;
  if (cond) {
    const rec = parseConditionCsv(cond, "PSI-25.csv", "PSI-25").records.find((r) => r.variable === "gravity_regime" && r.value === "microgravity");
    if (rec) gravitySource = { file: rec.source_file, location: rec.source_location, quote: rec.quote, status: rec.status };
  }
  return { csv, gravitySource };
}
