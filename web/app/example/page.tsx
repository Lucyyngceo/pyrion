import type { Metadata } from "next";
import Link from "next/link";
import { evaluateOnServer } from "@/lib/server-eval";
import { ISS_PRESET } from "@/lib/presets";
import { levelSentence, verdictLabel, type ClusterVerdict, type Target } from "@/lib/engine";
import { profiles } from "@/lib/investigations/data";
import "../landing.css";

export const metadata: Metadata = {
  title: "Worked example · PYRION Ω",
  description:
    "One complete question, computed by the engine on the server: solid cabin materials in ISS cabin air, the comparable NASA tests, their sources, what NASA set out to learn, and the limits.",
};

// Recomputed on each request from the repository's records (no model involved).
export const dynamic = "force-dynamic";

const PSI = (acc: string) => `https://psi.nasa.gov/physci/repo/data/investigations/${acc}`;
const pct = (x: number) => `${Math.round(x * 1000) / 10} %`;

type Quote = { field: string; text: string };

export default async function Example() {
  const o2 = ISS_PRESET.continuous.o2_mole_fraction!.value;
  const p = ISS_PRESET.continuous.pressure!.value;
  const target: Target = { regime: { gravity_regime: "microgravity", fuel_phase: "solid" }, continuous: { o2_mole_fraction: o2, pressure: p } };
  const { evaluation, investigations, sha256 } = await evaluateOnServer(target);
  const name = (acc: string) => investigations.find((i) => i.accession === acc)?.acronym ?? acc;
  const doi = (acc: string) => investigations.find((i) => i.accession === acc)?.doi ?? "";
  // One row per investigation: its best cluster (ranked first, then insufficient, then another regime).
  const all: ClusterVerdict[] = [...evaluation.ranked, ...evaluation.unranked].filter((v, i, a) => a.findIndex((x) => x.accession === v.accession) === i);
  const top = evaluation.ranked[0] ?? null;
  const decisive = top ? top.reasons.filter((r) => !r.informational) : [];
  const cites = top ? decisive.flatMap((r) => r.citations).filter((c, i, a) => a.findIndex((x) => x.test_id === c.test_id && x.variable === c.variable) === i).slice(0, 4) : [];
  const profile = top ? (profiles as unknown as { accession: string; summary_quotes?: Quote[] }[]).find((x) => x.accession === top.accession) : undefined;
  const words = profile?.summary_quotes ?? [];
  const c = evaluation.counts.investigations;

  return (
    <main className="page landing">
      <section className="ld-hero" aria-labelledby="ex-h">
        <p className="ld-kicker">Worked example · computed by the engine on the server, no AI</p>
        <h1 id="ex-h" className="ld-title">Which NASA fire tests are comparable to solid cabin materials in ISS cabin air?</h1>
        <p className="ld-answer">
          This page runs one complete question through PYRION and prints every step, so it can be checked without clicking anything.
          The same question is live on the{" "}
          <Link data-help="example-link" href="/envelope?preset=iss-cabin-air">
            dashboard
          </Link>{" "}
          (set the fuel phase to solid).
        </p>
      </section>

      <section className="ld-section" aria-labelledby="ex-1">
        <h2 id="ex-1">1 · The condition</h2>
        <p>
          ISS cabin air as NASA describes it: {pct(o2)} oxygen at {Math.round(p * 10) / 10} kPa (14.7 psia), microgravity. Fuel phase set to
          solid, because cabin fires start in materials such as fabrics and plastics.
        </p>
        <p className="ld-src small">Source: {ISS_PRESET.continuous.o2_mole_fraction!.source.title}.</p>
      </section>

      <section className="ld-section" aria-labelledby="ex-2">
        <h2 id="ex-2">2 · The verdict for each PSI investigation</h2>
        <p>
          {c.APPLICABLE} applicable · {c.EXTRAPOLATION} extrapolation · {c.INSUFFICIENT_EVIDENCE} insufficient evidence · {c.REGIME_BARRIER} another
          regime. Ordered by how close their tested conditions are (not by importance).
        </p>
        <div className="tars-cmptable">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Investigation</th>
                <th>Verdict</th>
                <th>Why, in one line</th>
              </tr>
            </thead>
            <tbody>
              {all.map((v) => (
                <tr key={`${v.accession}|${v.clusterKey}`}>
                  <td>{v.rank ?? "—"}</td>
                  <td>
                    <Link data-help="example-link" href={`/investigations/${v.accession}`}>
                      {v.accession} {name(v.accession)}
                    </Link>
                  </td>
                  <td>
                    {verdictLabel(v.verdict)}
                    {v.extrapolationLevel ? ` (${v.extrapolationLevel.replaceAll("_", " ")})` : ""}
                  </td>
                  <td className="small">{v.reasons.find((r) => !r.informational)?.message ?? v.reasons[0]?.message ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {top && (
        <section className="ld-section" aria-labelledby="ex-3">
          <h2 id="ex-3">
            3 · The receipt for the closest one: {top.accession} {name(top.accession)}
          </h2>
          <p>
            Verdict: <strong>{verdictLabel(top.verdict)}</strong>. {top.extrapolationLevel ? `${levelSentence(top.extrapolationLevel)}.` : ""} Distance: {top.distanceNote}.
          </p>
          <div className="tars-cmptable">
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Value</th>
                  <th>Where in the NASA file</th>
                  <th>Text in the file</th>
                </tr>
              </thead>
              <tbody>
                {cites.map((x) => (
                  <tr key={`${x.test_id}|${x.variable}`}>
                    <td>{x.test_id}</td>
                    <td>
                      {x.variable.replaceAll("_", " ")}: {x.value_original} {x.unit_original}
                    </td>
                    <td className="small">
                      {x.source_file.split("/").pop()} · {x.source_location}
                    </td>
                    <td className="small">{x.quote ? `“${x.quote.slice(0, 160)}${x.quote.length > 160 ? "…" : ""}”` : "table cell (header and row above)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ld-src small">
            Investigation DOI:{" "}
            <a data-help="example-link" href={`https://doi.org/${doi(top.accession)}`}>
              {doi(top.accession)}
            </a>{" "}
            · PSI record:{" "}
            <a data-help="example-link" href={PSI(top.accession)}>
              {top.accession}
            </a>
          </p>
        </section>
      )}

      {top && words.length > 0 && (
        <section className="ld-section" aria-labelledby="ex-4">
          <h2 id="ex-4">4 · What NASA set out to learn there, in its own words</h2>
          {words.map((q) => (
            <blockquote key={q.text} className="ld-quote">
              &ldquo;{q.text}&rdquo; <span className="small muted">(PSI record {top.accession}, field &ldquo;{q.field}&rdquo;)</span>
            </blockquote>
          ))}
        </section>
      )}

      <section className="ld-section" aria-labelledby="ex-5">
        <h2 id="ex-5">5 · The limits, and what to do next</h2>
        <ul>
          <li>
            A verdict compares conditions; it does not predict how a flame behaves and never says a condition is safe.
          </li>
          {top?.extrapolationLevel && <li>The closest evidence is outside the tested range on at least one axis: values would have to be extended beyond NASA&apos;s measurements.</li>}
          <li>Axes left open are not compared: {evaluation.openRegimeAxes.map((a) => a.replaceAll("_", " ")).join(", ") || "none"}.</li>
          <li>
            For the Moon Base condition the same engine finds no PSI test in lunar gravity; the{" "}
            <Link data-help="example-link" href="/planner">
              Mission Planner
            </Link>{" "}
            shows what the planned FM2 tests would and would not reach.
          </li>
        </ul>
        <p className="ld-src small">
          Fingerprint of this computation (SHA-256): <code>{sha256}</code> · engine {evaluation.engine.name} {evaluation.engine.version}. The same
          records and condition always give the same fingerprint.
        </p>
      </section>
    </main>
  );
}
