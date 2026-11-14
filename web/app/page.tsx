import Explorer from "@/components/Explorer";
import { loadDataset } from "@/lib/data";

export default async function Page() {
  const dataset = await loadDataset();
  const synthetic = dataset.mode === "synthetic";
  const s = dataset.stats;

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
        <h1>Which NASA combustion experiments apply to a target condition, and where the measured evidence ends.</h1>
        <p className="lede">
          Source: NASA Physical Sciences Informatics (PSI), its 24 Combustion Science investigations, each cited by DOI.
          Physical regimes are barriers; O₂ and pressure are compared only inside the measured envelope.
        </p>
      </header>

      {synthetic ? (
        <div className="banner" role="note">
          <strong>Synthetic demo data.</strong> No condition records are in <code>data/conditions/</code>, so the page shows
          the engine&apos;s synthetic test fixtures (PSI-9001 to PSI-9007, numbers that do not exist in PSI). They are not
          NASA measurements.
        </div>
      ) : (
        <p className="data-line muted small">
          {s.records.toLocaleString("en-US")} condition values extracted from {s.accessions} of 24 PSI investigations:{" "}
          {s.verified.toLocaleString("en-US")} verified by a person, {(s.records - s.verified - s.flagged).toLocaleString("en-US")}{" "}
          extracted and not yet verified, {s.flagged.toLocaleString("en-US")} flagged as insufficient evidence
          {s.rejected > 0 ? `, ${s.rejected} rows rejected by the engine's validator` : ""}.
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
