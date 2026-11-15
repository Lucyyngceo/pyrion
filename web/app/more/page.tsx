import type { Metadata } from "next";
import "../lenses/lenses.css";
import { NASA_STD_6001B } from "../../../engine/src/experiments.ts";
import { loadConditionRecords, loadLenses } from "@/lib/lenses/data";
import { earthSentences, oxygenCeiling, pct, round, suitPartialPressure } from "@/lib/lenses/model";
import { loadProfiles } from "@/lib/lenses/profiles";
import { CHALLENGE_URL, EQUIPMENT_CARDS, EQUIPMENT_INTRO, equipmentSourceLabel, lensFilterHref, type EquipmentQuote } from "@/lib/lenses/equipment";

/** One verbatim quote with its source named after it. */
function Quote({ q }: { q: EquipmentQuote }) {
  return (
    <blockquote>
      &ldquo;{q.text}&rdquo;{" "}
      <small className="muted">
        ({equipmentSourceLabel(q.source)}
        {q.excerpt ? ", part of a sentence" : ""})
      </small>
    </blockquote>
  );
}

export const metadata: Metadata = {
  title: "More · PYRION Ω",
  description:
    "Fire detection, suppression and prevention research in PSI, Earth applications as stated in PSI records and the challenge statement, the spacesuit atmosphere (outside PSI) and why rockets are out of scope.",
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
        <h1>More: fire-safety equipment, Earth, spacesuits and rockets</h1>
        <p className="lede">
          This page shows which PSI combustion investigations relate to fire detection, suppression and prevention, what their PSI records and NASA&apos;s challenge
          statement say about uses on Earth, and what lies outside PSI (spacesuits, rockets). Every sentence in quotation marks is copied word for word, with its source named.
        </p>
      </header>

      <section className="card" aria-labelledby="more-equipment-h">
        <div className="card-head">
          <h2 id="more-equipment-h">Fire-safety equipment &amp; Earth</h2>
          <p className="muted">
            &ldquo;{EQUIPMENT_INTRO.text}&rdquo; ({equipmentSourceLabel(EQUIPMENT_INTRO.source)},{" "}
            <a data-help="more-equipment-link" href={CHALLENGE_URL}>
              challenge page
            </a>
            ). Below, one card per leg: only quotes, each from a PSI record field or from the challenge statement.
          </p>
        </div>
        <div className="more-equip">
          {EQUIPMENT_CARDS.map((c) => (
            <article key={c.leg} className="more-equip-card" aria-labelledby={`more-equip-${c.leg}`}>
              <h3 id={`more-equip-${c.leg}`}>{c.title}</h3>
              {c.quotes.map((q, k) => (
                <Quote key={k} q={q} />
              ))}
              <p className="more-equip-links">
                Investigations:{" "}
                {c.investigations.map((id, k) => (
                  <span key={id}>
                    {k > 0 ? " · " : ""}
                    <a data-help="more-equipment-link" href={`/investigations/${id}`}>
                      {lenses.investigations.find((i) => i.accession === id)?.acronym || id}
                    </a>
                  </span>
                ))}
                <br />
                <a data-help="more-equipment-link" href={lensFilterHref(c.leg)}>
                  Every investigation tagged {c.leg} in the lens matrix
                </a>
              </p>
            </article>
          ))}
        </div>
      </section>

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
