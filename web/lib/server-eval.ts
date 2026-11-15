// Server only: the engine run on the server's own copy of the data, so nothing a client sends is ever "engine output".

import { createHash } from "node:crypto";
import { canonicalJson, evaluate, parseConditionCsv, type ConditionRecord, type Evaluation, type Target } from "./engine";
import { loadDataset } from "./data";
import type { Investigation } from "./types";

let cache: Promise<{ records: ConditionRecord[]; investigations: Investigation[] }> | null = null;

function load() {
  cache ??= loadDataset().then((d) => ({
    records: d.files.flatMap((f) => parseConditionCsv(f.text, f.name, f.accession).records),
    investigations: d.investigations,
  }));
  return cache;
}

/** The server's own records and investigation list. */
export const serverData = () => load();

export async function evaluateOnServer(target: Target): Promise<{ evaluation: Evaluation; investigations: Investigation[]; sha256: string }> {
  const { records, investigations } = await load();
  const evaluation = evaluate(records, target);
  return { evaluation, investigations, sha256: createHash("sha256").update(canonicalJson(evaluation)).digest("hex") };
}
