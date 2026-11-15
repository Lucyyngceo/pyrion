import type { Metadata } from "next";
import { parseConditionCsv } from "@/lib/engine";
import AddSource from "@/components/AddSource";
import CountUp from "@/components/CountUp";
import EvidenceStatus from "@/components/EvidenceStatus";
import { loadDataset, loadLineage } from "@/lib/data";

export const metadata: Metadata = {
  title: "Data · PYRION Ω",
  description: "What PYRION extracted from each NASA PSI combustion investigation, with DOI and license.",
};

const VARS = ["o2_mole_fraction", "pressure", "gravity_regime", "fuel_phase", "diluent", "flame_type"] as const;
const VAR_LABEL: Record<(typeof VARS)[number], string> = {
  o2_mole_fraction: "O₂",
  pressure: "Pressure",
  gravity_regime: "Gravity",
  fuel_phase: "Fuel phase",
  diluent: "Diluent",
  flame_type: "Flame type",
};

const doiUrl = (d: string) => `https://doi.org/${d}`;

export default async function DataPage() {
  const [ds, lin] = await Promise.all([loadDataset(), loadLineage()]);
  const v = lin.validation;
  const gb = (b: number) => (b >= 1e12 ? `${(b / 1e12).toFixed(1)} TB` : b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${(b / 1e6).toFixed(0)} MB`);
  const n = (x: number) => x.toLocaleString("en-US");
  const per = new Map<string, { records: number; verified: number; flagged: number; tests: Set<string>; vars: Set<string>; table: number; doc: number }>();
  for (const f of ds.files) {
    const { records } = parseConditionCsv(f.text, f.name, f.accession);
    const e = per.get(f.accession) ?? { records: 0, verified: 0, flagged: 0, tests: new Set(), vars: new Set(), table: 0, doc: 0 };
    for (const r of records) {
      e.records++;
      if (r.status === "verified") e.verified++;
      if (r.status === "insufficient_evidence") e.flagged++;
      e.tests.add(r.test_id);
      e.vars.add(r.variable);
      if (r.method === "table") e.table++;
      else e.doc++;
    }
    per.set(f.accession, e);
  }
  const max = Math.max(1, ...[...per.values()].map((e) => e.records));
  const invs = ds.investigations.toSorted((a, b) => (per.get(b.accession)?.records ?? 0) - (per.get(a.accession)?.records ?? 0));
  const withData = invs.filter((i) => per.has(i.accession)).length;
  const totals = [...per.values()].reduce(
    (t, e) => ({ records: t.records + e.records, table: t.table + e.table, doc: t.doc + e.doc, tests: t.tests + e.tests.size }),
    { records: 0, table: 0, doc: 0, tests: 0 },
  );

  return (
    <main className="page">
      <header className="hero hero-row">
        <div>
          <h1>The data behind the envelope</h1>
          <p className="lede">
            Every condition value PYRION uses comes from a NASA Physical Sciences Informatics (PSI) combustion investigation,
            with the file and location it was read from. This page shows what was extracted from each one.
          </p>
        </div>
        <div className="hero-actions">
          <AddSource />
        </div>
      </header>

      <EvidenceStatus dataset={ds} lineage={lin} />

      <section className="card lineage" aria-labelledby="lin-h">
        <div className="card-head">
          <h2 id="lin-h">Lineage: from PSI to a verdict</h2>
          <p className="muted small">
            Every step is a file in the repository. Counts are read from the manifests and from the last committed
            validation report{v?.generatedAt ? ` (${v.generatedAt.replace("T", " ").replace("Z", " UTC")})` : ""}.
          </p>
        </div>
        <ol className="lin-steps">
          <li>
            <span className="lin-k">NASA PSI</span>
            <b><CountUp value={lin.psiFiles} /></b>
            <span>files listed in {ds.investigations.length} combustion investigations ({gb(lin.psiBytes)})</span>
            <code>data/manifest/coverage.csv</code>
          </li>
          <li>
            <span className="lin-k">Selected and checksummed</span>
            <b><CountUp value={lin.selectedFiles} /></b>
            <span>files downloaded with SHA-256 ({gb(lin.selectedBytes)}): tables, reports, test matrices</span>
            <code>data/manifest/checksums_P*.csv</code>
          </li>
          <li>
            <span className="lin-k">Extracted</span>
            <b><CountUp value={totals.records} /></b>
            <span>condition values, each with file, location, original text and unit</span>
            <code>data/conditions/*.csv</code>
          </li>
          {v && (
            <li>
              <span className="lin-k">Traced to the source</span>
              <b><CountUp value={v.cellsTraced + v.quotesTraced} /></b>
              <span>
                {n(v.cellsTraced)} table cells and {n(v.quotesTraced)} quotes re-read from the PSI file
                {v.traceRan ? "" : " (trace not run in this report)"}
              </span>
              <code>validation/run_all.py</code>
            </li>
          )}
          {v && (
            <li>
              <span className="lin-k">Automated gates</span>
              <b>{v.blocker} critical findings</b>
              <span>
                {n(v.major)} major, {n(v.minor)} minor findings logged for review
              </span>
              <code>validation/reports/latest.md</code>
            </li>
          )}
          <li>
            <span className="lin-k">Engine</span>
            <b>4 verdicts</b>
            <span>deterministic rules: same records and target in, same verdict out</span>
            <code>engine/src</code>
          </li>
        </ol>
      </section>

      <section className="card" aria-labelledby="cov-h">
        <div className="card-head">
          <h2 id="cov-h">Coverage by investigation</h2>
          <p className="muted small">
            {withData} of {ds.investigations.length} investigations have extracted values so far, {n(totals.tests)} distinct tests,{" "}
            {Math.round((100 * totals.table) / Math.max(1, totals.records))} % of values read by code from PSI tables. Sorted by
            extracted values. A dash means that axis is not stated in the extracted records for that investigation,
            in PSI as read so far.
          </p>
        </div>
        <div className="data-scroll">
          <table className="vtable">
            <thead>
              <tr>
                <th scope="col">Investigation</th>
                <th scope="col" className="num">
                  Values
                </th>
                <th scope="col" aria-label="Share of values" />
                <th scope="col" className="num">
                  Tests
                </th>
                {VARS.map((v) => (
                  <th key={v} scope="col">
                    {VAR_LABEL[v]}
                  </th>
                ))}
                <th scope="col" className="num">
                  Papers
                </th>
                <th scope="col">DOI · license</th>
              </tr>
            </thead>
            <tbody>
              {invs.map((i) => {
                const e = per.get(i.accession);
                return (
                  <tr key={i.accession}>
                    <td>
                      <span className="acc">{i.accession}</span> <strong>{i.acronym}</strong>
                      <div className="muted small">{i.title}</div>
                    </td>
                    <td className="num">{e ? e.records.toLocaleString("en-US") : "—"}</td>
                    <td>
                      <div className="bar" aria-hidden="true">
                        <i style={{ width: `${e ? (100 * e.records) / max : 0}%` }} />
                      </div>
                    </td>
                    <td className="num">{e ? e.tests.size : "—"}</td>
                    {VARS.map((v) => (
                      <td key={v} aria-label={e?.vars.has(v) ? "stated" : "not stated"}>
                        {e?.vars.has(v) ? "●" : <span className="muted">—</span>}
                      </td>
                    ))}
                    <td className="num">{i.publications?.length ?? 0}</td>
                    <td className="small">
                      {i.doi ? (
                        <a href={doiUrl(i.doi)} target="_blank" rel="noreferrer">
                          {i.doi}
                        </a>
                      ) : (
                        "—"
                      )}
                      <div className="muted">{i.license || "license not stated on PSI"}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="prose">
        <h2>How a value gets here</h2>
        <ol>
          <li>The PSI files of each investigation are downloaded and listed with their SHA-256 checksum.</li>
          <li>
            Values are read by code from PSI experimental tables (cell by cell), or quoted from the investigation&apos;s
            documents with the page and the exact sentence.
          </li>
          <li>
            Each value keeps its original text and unit, its converted value, its file and location, and a status: extracted, or
            flagged as insufficient evidence.
          </li>
          <li>
            Automated checks run on every change: schema, provenance, cell trace against the source file, unit conversion,
            physical bounds, consistency and citation. Milestone reviews are run by separate automated reviewer agents (metrology, provenance, combustion, mission).
          </li>
        </ol>
        <p className="muted small">
          Data: NASA PSI, released under CC0-1.0 except where the table says otherwise. A hackathon project, not a NASA
          product.
        </p>
      </section>
    </main>
  );
}
