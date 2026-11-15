import type { Lineage } from "@/lib/data";
import type { Dataset } from "@/lib/types";

/** What the code located in the NASA files, read from the validation report (never hard-coded). */
export default function EvidenceStatus({ dataset, lineage }: { dataset: Dataset; lineage: Lineage }) {
  const v = lineage.validation;
  const traced = v && v.traceRan ? v.cellsTraced + v.quotesTraced : null;
  const s = dataset.stats;
  const usable = s.records - s.flagged;
  const rest = traced === null ? usable : usable - traced;
  return (
    <div data-help="data-evidence-status" className="evidence-status" aria-label="Status of the extracted values">
      <div className="es-head">
        <b>{s.records.toLocaleString("en-US")}</b> condition values from {s.accessions} of {dataset.investigations.length} PSI combustion investigations
        {s.rejected > 0 && <span className="muted"> · {s.rejected} rows rejected by the engine&apos;s validator</span>}
      </div>
      <div className="es-bar" role="img" aria-label={`${traced ?? 0} located by code in the NASA source, ${rest} not located by code, ${s.flagged} flagged as insufficient evidence`}>
        <i className="es-ver" style={{ flexGrow: traced ?? 0 }} />
        <i className="es-ext" style={{ flexGrow: rest }} />
        <i className="es-flag" style={{ flexGrow: s.flagged }} />
      </div>
      <ul className="es-legend small">
        {traced !== null && v && (
          <li>
            <i className="es-ver" /> ✓ {traced.toLocaleString("en-US")} located by code in the NASA source: {v.cellsTraced.toLocaleString("en-US")} table cells at their row and column,{" "}
            {v.quotesTraced.toLocaleString("en-US")} quotes found word for word
          </li>
        )}
        {rest > 0 && (
          <li>
            <i className="es-ext" /> {rest.toLocaleString("en-US")} with file and location{traced !== null ? " (format not yet read by the checker)" : ""}
          </li>
        )}
        <li>
          <i className="es-flag" /> {s.flagged.toLocaleString("en-US")} flagged insufficient, not counted
        </li>
      </ul>
    </div>
  );
}
