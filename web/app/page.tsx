import BootLog from "@/components/BootLog";
import Explorer from "@/components/Explorer";
import { loadDataset } from "@/lib/data";
import "./navigator.css";

export default async function Page() {
  const dataset = await loadDataset();
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
          <div className="es-bar" role="img" aria-label={`${s.verified} verified, ${s.records - s.verified - s.flagged} extracted not yet verified, ${s.flagged} flagged as insufficient evidence`}>
            <i className="es-ver" style={{ flexGrow: s.verified }} />
            <i className="es-ext" style={{ flexGrow: s.records - s.verified - s.flagged }} />
            <i className="es-flag" style={{ flexGrow: s.flagged }} />
          </div>
          <ul className="es-legend small">
            <li>
              <i className="es-ver" /> {s.verified.toLocaleString("en-US")} verified by a person
            </li>
            <li>
              <i className="es-ext" /> {(s.records - s.verified - s.flagged).toLocaleString("en-US")} extracted with file and location, not yet verified
            </li>
            <li>
              <i className="es-flag" /> {s.flagged.toLocaleString("en-US")} flagged insufficient, not counted
            </li>
          </ul>
        </div>
      )}

      <Explorer dataset={dataset} />

    </main>
  );
}
