import Explorer from "@/components/Explorer";
import TourButton from "@/components/TourButton";
import { loadDataset, loadLineage } from "@/lib/data";
import "./navigator.css";

export default async function Page() {
  const [dataset, lineage] = await Promise.all([loadDataset(), loadLineage()]);
  const v = lineage.validation;
  const traced = v && v.traceRan ? v.cellsTraced + v.quotesTraced : null;
  const s = dataset.stats;
  const usable = s.records - s.flagged;
  const synthetic = dataset.mode === "synthetic";
  // One small status line; the full breakdown is on /data.
  const located =
    traced === null ? "every value carries its file and location in the NASA source" : traced >= usable ? "every value located by code in the NASA source" : `${traced.toLocaleString("en-US")} of ${usable.toLocaleString("en-US")} values located by code in the NASA source`;

  return (
    <main className="page">
      <header className="hero hero-compact hero-row">
        <div>
          <h1 className="h1-small">The evidence envelope</h1>
          {!synthetic && (
            <p className="hero-status small muted">
              {s.records.toLocaleString("en-US")} values from {s.accessions} of {dataset.investigations.length} investigations · {located} · <a href="/data">details</a>
            </p>
          )}
        </div>
        <TourButton />
      </header>

      {synthetic && (
        <div className="banner" role="note">
          <strong>Synthetic demo data.</strong> No condition records are in <code>data/conditions/</code>, so the page shows
          the engine&apos;s synthetic test fixtures (PSI-9001 to PSI-9007, numbers that do not exist in PSI). They are not
          NASA measurements.
        </div>
      )}

      <Explorer dataset={dataset} />
    </main>
  );
}
