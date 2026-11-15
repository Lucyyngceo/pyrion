// ONE place where the shared counts are computed (server only, read when the page is built). Every page uses these,
// and each count says what it counts, so "10,042" and "10,036" can never be shown as the same thing.

import { loadDataset, loadLineage } from "@/lib/data";

export interface Facts {
  /** Rows in data/conditions/*.csv (used by the engine + rejected by its validator). */
  recordsInFiles: number;
  /** Rows the engine's validator rejected. */
  rejectedByValidator: number;
  /** Records the engine uses. */
  usedByEngine: number;
  /** Values the validator located in the NASA source by code (null when the trace did not run). */
  locatedByCode: number | null;
  /** Records flagged insufficient evidence. */
  flaggedInsufficient: number;
  investigationsWithData: number;
  investigationsTotal: number;
  /** Date of the validation report the located count comes from. */
  reportAt: string | null;
  /** The one sentence for counts: says what each number counts. */
  sentence: string;
}

const n = (x: number) => x.toLocaleString("en-US");

let cache: Promise<Facts> | null = null;
export function loadFacts(): Promise<Facts> {
  cache ??= (async () => {
    const [ds, lin] = await Promise.all([loadDataset(), loadLineage()]);
    const s = ds.stats;
    const v = lin.validation;
    const recordsInFiles = s.records + s.rejected;
    const sentence = `${n(recordsInFiles)} records extracted from NASA files; ${n(s.records - s.flagged)} used as evidence, ${n(s.flagged)} flagged insufficient${s.rejected > 0 ? `, ${n(s.rejected)} rejected by the validator` : ""}`;
    return {
      recordsInFiles,
      rejectedByValidator: s.rejected,
      usedByEngine: s.records,
      locatedByCode: v && v.traceRan ? v.cellsTraced + v.quotesTraced : null,
      flaggedInsufficient: s.flagged,
      investigationsWithData: s.accessions,
      investigationsTotal: ds.investigations.length,
      reportAt: v?.generatedAt ?? null,
      sentence,
    };
  })();
  return cache;
}
