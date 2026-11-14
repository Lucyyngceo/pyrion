import type { Metadata } from "next";
import { parseConditionCsv } from "@/lib/engine";
import { loadDataset } from "@/lib/data";

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
  const ds = await loadDataset();
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
      <header className="hero">
        <h1>The data behind the envelope</h1>
        <p className="lede">
          Every condition value PYRION uses comes from a NASA Physical Sciences Informatics (PSI) combustion investigation,
          with the file and location it was read from. This page shows what was extracted from each one.
        </p>
      </header>

      <div className="kpis">
        <div className="card kpi">
          <b>{withData} / {ds.investigations.length}</b>
          <span>investigations with extracted values</span>
        </div>
        <div className="card kpi">
          <b>{totals.records.toLocaleString("en-US")}</b>
          <span>condition values</span>
        </div>
        <div className="card kpi">
          <b>{totals.tests.toLocaleString("en-US")}</b>
          <span>distinct tests</span>
        </div>
        <div className="card kpi">
          <b>{Math.round((100 * totals.table) / Math.max(1, totals.records))} %</b>
          <span>read by code from PSI tables (rest: quoted from documents)</span>
        </div>
      </div>

      <section className="card" aria-labelledby="cov-h">
        <div className="card-head">
          <h2 id="cov-h">Coverage by investigation</h2>
          <p className="muted small">
            Sorted by extracted values. A dash means that axis is not stated in the extracted records for that investigation,
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
            Each value keeps its original text and unit, its converted value, its file and location, and a status: extracted,
            verified by a person, or flagged as insufficient evidence.
          </li>
          <li>
            Automated checks run on every change: schema, provenance, cell trace against the source file, unit conversion,
            physical bounds, consistency and citation. Milestone reviews sample records by hand.
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
