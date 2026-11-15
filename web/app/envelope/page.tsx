import ExplorerLoader from "@/components/ExplorerLoader";
import HelpMenu from "@/components/HelpMenu";
import McpPanel from "@/components/McpPanel";
import WarpIntro from "@/components/WarpIntro";
import { loadDataset, loadLineage } from "@/lib/data";
import { loadFacts } from "@/lib/facts";
import "../navigator.css";

export default async function Page() {
  const [dataset, lineage, facts] = await Promise.all([loadDataset(), loadLineage(), loadFacts()]);
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
      <WarpIntro />
      <header className="hero hero-compact hero-row">
        <div>
          <h1 data-help="page-envelope" className="h1-small">The evidence envelope</h1>
          {!synthetic && (
            <p data-help="header-status-line" className="hero-status small muted">
              {facts.sentence}, from {facts.investigationsWithData} of {facts.investigationsTotal} combustion investigations in NASA&apos;s Physical Sciences Informatics (PSI) database · {located} · <a data-help="header-details-link" href="/data">details</a>
            </p>
          )}
        </div>
        <div className="hero-actions">
          <HelpMenu />
        </div>
      </header>

      <McpPanel />

      {synthetic && (
        <div className="banner" role="note">
          <strong>Synthetic demo data.</strong> No condition records are in <code>data/conditions/</code>, so the page shows
          the engine&apos;s synthetic test fixtures (PSI-9001 to PSI-9007, numbers that do not exist in PSI). They are not
          NASA measurements.
        </div>
      )}

      <ExplorerLoader dataset={{ ...dataset, files: dataset.files.map((f) => ({ ...f, text: "" })) }} />
    </main>
  );
}
