import BootLog from "@/components/BootLog";
import Explorer from "@/components/Explorer";
import Link from "next/link";
import { loadDataset, loadLineage } from "@/lib/data";
import "./navigator.css";

export default async function Page() {
  const [dataset, lineage] = await Promise.all([loadDataset(), loadLineage()]);
  // What the code located in the NASA files, read from the validation report (never hard-coded). Omitted if the trace did not run.
  const v = lineage.validation;
  const traced = v && v.traceRan ? v.cellsTraced + v.quotesTraced : null;
  const usable = dataset.stats.records - dataset.stats.flagged;
  const synthetic = dataset.mode === "synthetic";
  const s = dataset.stats;

  return (
    <main className="page">
      <header className="hero">
        <BootLog
          steps={[
            `PSI manifest: ${dataset.investigations.length} investigations`,
            `${s.records.toLocaleString("en-US")} condition values parsed`,
            `${s.accessions} investigations with data`,
            "deterministic engine ready",
          ]}
        />
        <h1>
          PYRION Ω <span className="h1-dash">—</span> The Evidence Envelope
        </h1>
        <p className="lede">
          Which NASA combustion tests apply to a target cabin condition, and where the measured evidence ends. Data: NASA
          Physical Sciences Informatics (PSI), 24 combustion investigations, each cited by DOI.
        </p>
      </header>

      {synthetic ? (
        <div className="banner" role="note">
          <strong>Synthetic demo data.</strong> No condition records are in <code>data/conditions/</code>, so the page shows
          the engine&apos;s synthetic test fixtures (PSI-9001 to PSI-9007, numbers that do not exist in PSI). They are not
          NASA measurements.
        </div>
      ) : (
        <div className="evidence-status" aria-label="Status of the extracted values">
          <div className="es-head">
            <b>{s.records.toLocaleString("en-US")}</b> condition values from {s.accessions} of 24 PSI investigations
            {s.rejected > 0 && <span className="muted"> · {s.rejected} rows rejected by the engine&apos;s validator</span>}
          </div>
          <div className="es-bar" role="img" aria-label={`${traced ?? 0} located by code in the NASA source, ${traced === null ? usable : usable - traced} not located by code, ${s.flagged} flagged as insufficient evidence, ${s.verified} checked by a person`}>
            <i className="es-ver" style={{ flexGrow: traced ?? s.verified }} />
            <i className="es-ext" style={{ flexGrow: traced === null ? usable - s.verified : usable - traced }} />
            <i className="es-flag" style={{ flexGrow: s.flagged }} />
          </div>
          <ul className="es-legend small">
            {traced !== null && v && (
              <li>
                <i className="es-ver" /> ✓ {traced.toLocaleString("en-US")} located by code in the NASA source: {v.cellsTraced.toLocaleString("en-US")} table cells at their row and column,{" "}
                {v.quotesTraced.toLocaleString("en-US")} quotes found word for word
              </li>
            )}
            <li>
              <i className="es-ext" /> {(traced === null ? usable : usable - traced).toLocaleString("en-US")} with file and location, not located by code
            </li>
            <li>
              <i className="es-flag" /> {s.flagged.toLocaleString("en-US")} flagged insufficient, not counted
            </li>
            <li>
              {s.verified.toLocaleString("en-US")} checked by a person so far: the last step, <Link href="/method#verification">see Method</Link>
            </li>
          </ul>
        </div>
      )}

      <Explorer dataset={dataset} />

    </main>
  );
}
