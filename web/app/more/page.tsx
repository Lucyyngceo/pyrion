import type { Metadata } from "next";
import "../lenses/lenses.css";
import { NASA_STD_6001B } from "../../../engine/src/experiments.ts";
import { loadConditionRecords, loadLenses } from "@/lib/lenses/data";
import { earthSentences, oxygenCeiling, pct, round, suitPartialPressure } from "@/lib/lenses/model";
import { loadProfiles } from "@/lib/lenses/profiles";

export const metadata: Metadata = {
  title: "More · PYRION Ω",
  description: "Earth applications as stated in PSI records, the spacesuit atmosphere (outside PSI) and why rockets are out of scope.",
};

export default function MorePage() {
  const lenses = loadLenses();
  const ch = lenses.challenge;
  const earth = earthSentences(loadProfiles());
  const suitO2 = ch.suit.o2_percent ?? 0;
  const suitPsi = ch.suit.pressure_psi ?? 0;
  const pO2 = suitPartialPressure(suitO2, suitPsi);
  const ceiling = oxygenCeiling(loadConditionRecords());
  const topAmbient = Math.max(...ceiling.ambient.map((a) => a.o2_mole_fraction));
  const anyAtSuit = topAmbient * 100 >= suitO2;
  const nSentences = earth.reduce((n, e) => n + e.sentences.length, 0);
  return (
    <main className="page lenses more">
      <header className="hero">
        <h1>More: Earth, spacesuits and rockets</h1>
        <p className="lede">Three short notes. Each one says where its words and numbers come from.</p>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>On Earth, as stated in the PSI record</h2>
          <p className="muted">
            NASA&apos;s challenge says: &ldquo;{ch.earth.quote}&rdquo; Below are only the investigations&apos; own sentences from the researchImpacts field of their PSI
            records that speak of use on Earth ({nSentences} sentences from {earth.length} investigations). They are what the records state, not claims checked
            by PYRION. Which sentences are shown is a PYRION convention: those that say &ldquo;on Earth&rdquo;, &ldquo;for Earth&rdquo;, &ldquo;to Earth&rdquo;,
            &ldquo;terrestrial&rdquo;, &ldquo;Earth benefits&rdquo; or &ldquo;Earth environments&rdquo;.
          </p>
        </div>
        <ul className="more-earth">
          {earth.map((e) => (
            <li key={e.accession}>
              <h3>
                <a data-help="more-earth-link" href={`/investigations/${e.accession}`}>
                  {e.acronym || e.accession}
                </a>{" "}
                <small className="muted">{e.accession}</small>
              </h3>
              {e.sentences.map((s, k) => (
                <blockquote key={k}>&ldquo;{s}&rdquo;</blockquote>
              ))}
              <p className="muted">
                As stated in the PSI record ({e.source ? `${e.source.file}, field ${e.source.key}` : "researchImpacts"}).{" "}
                {e.doi && (
                  <a data-help="more-earth-link" href={`https://doi.org/${e.doi}`}>
                    PSI DOI {e.doi}
                  </a>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Spacesuit atmosphere: outside PSI</h2>
          <p className="muted">From NASA&apos;s challenge: &ldquo;{ch.suit.quote}&rdquo;</p>
        </div>
        <dl className="more-suit">
          <dt>Oxygen</dt>
          <dd>{suitO2} %</dd>
          <dt>Total pressure</dt>
          <dd>{suitPsi} psi</dd>
          <dt>Oxygen partial pressure</dt>
          <dd>
            {round(pO2.kpa, 2)} kPa{pO2.psia !== null ? ` (${round(pO2.psia ?? 0, 2)} psia)` : ""}
            <br />
            <small className="muted">
              {pO2.display} {pO2.provenance}.
            </small>
          </dd>
        </dl>
        <p>
          <strong>Outside PSI:</strong>{" "}
          {anyAtSuit
            ? `PSI has ambient oxygen at or above ${suitO2} %.`
            : `no PSI test at these conditions. The highest ambient oxygen of any PSI test is ${pct(topAmbient)} %.`}{" "}
          This card is information, not a verdict. NASA&apos;s material test standard is {NASA_STD_6001B.title} (approved {NASA_STD_6001B.approved}; the file is in data/raw/nasa/
          {NASA_STD_6001B.file.split("/")[0]}/). {NASA_STD_6001B.note}
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Rockets and propellants: beyond PSI&apos;s scope</h2>
        </div>
        <p>
          NASA&apos;s challenge says, in a footnote: &ldquo;{ch.rockets.quote}&rdquo; PYRION therefore does not address rocket or propellant fire safety.
        </p>
      </section>
    </main>
  );
}
