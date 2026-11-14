import Explorer from "@/components/Explorer";
import { loadDataset } from "@/lib/data";

export default async function Page() {
  const dataset = await loadDataset();
  const synthetic = dataset.mode === "synthetic";
  const nInv = synthetic ? 24 : dataset.investigations.length;
  const verified = dataset.records.filter((r) => r.status === "verified").length;
  const withValues = new Set(dataset.records.map((r) => r.accession)).size;

  return (
    <main className="page">
      <header className="hero">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            Ω
          </span>
          <span className="brand-name">PYRION</span>
          <span className="brand-sub">NASA Space Apps 2026 · Flame in Freefall</span>
        </div>
        <h1>
          Which NASA combustion experiments apply to a target condition, and where the measured evidence ends.
        </h1>
        <p className="lede">
          Source: NASA Physical Sciences Informatics (PSI), the {nInv} investigations in its Combustion Science research
          area, each cited by DOI. Gravity regime, fuel phase and diluent are barriers; O₂ and pressure are compared only
          inside the measured range.
        </p>
      </header>

      {synthetic ? (
        <div className="banner" role="note">
          <strong>Synthetic demo data.</strong> No condition records have been extracted from PSI into{" "}
          <code>data/conditions/</code> yet, so the chart and verdicts below use invented fixtures named DEMO-A to DEMO-G.
          They are not NASA measurements.
        </div>
      ) : (
        <p className="data-line muted small">
          {dataset.records.length} condition values from {withValues} of {nInv} investigations ({verified} verified by a
          person, {dataset.records.length - verified} extracted, not yet verified). Read from{" "}
          {dataset.conditionFiles.length} file{dataset.conditionFiles.length === 1 ? "" : "s"} in{" "}
          <code>data/conditions/</code>.
        </p>
      )}

      <Explorer dataset={dataset} />

      <footer className="footer muted small">
        <p>
          PYRION Ω, team NDMLM, NASA Space Apps Challenge 2026. A hackathon project, not a NASA product. Data: NASA PSI,
          released under CC0-1.0 except PSI-10, whose license is not stated on PSI. Code: Apache-2.0. Built with the help of
          SI tools (Claude Code); see the repository README.
        </p>
        <p>
          <a href="https://psi.nasa.gov" target="_blank" rel="noreferrer">
            psi.nasa.gov
          </a>{" "}
          ·{" "}
          <a href="https://github.com/Lucyyngceo/pyrion" target="_blank" rel="noreferrer">
            github.com/Lucyyngceo/pyrion
          </a>
        </p>
      </footer>
    </main>
  );
}
