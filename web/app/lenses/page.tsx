import type { Metadata } from "next";
import "./lenses.css";
import LensMatrix from "@/components/lenses/LensMatrix";
import Timeline from "@/components/lenses/Timeline";
import { loadLenses, loadTimeline } from "@/lib/lenses/data";
import { displayName, fm2Planned, frames, inPolygon, moonBand, pct, round, slimPoints, sourceLabel } from "@/lib/lenses/model";

export const metadata: Metadata = {
  title: "Lenses · PYRION Ω",
  description: "PSI investigations by safety leg and phenomenon, each tag with a verbatim quote, and the evidence timeline.",
};

export default function LensesPage() {
  const lenses = loadLenses();
  const timeline = loadTimeline();
  const band = moonBand();
  const fm2 = fm2Planned();
  const ch = lenses.challenge;
  const names = Object.fromEntries(lenses.investigations.map((i) => [i.accession, displayName(i)]));
  const c = lenses.counts;
  const pts = slimPoints(timeline);
  const inBandPts = pts.filter((p) => inPolygon(p, band.vertices));
  const inBand = inBandPts.length;
  const inBandGravity = [...new Set(inBandPts.flatMap((p) => p.gravity))].sort();
  const inBandAccs = [...new Set(inBandPts.map((p) => names[p.acc] ?? p.acc))];
  const lunar = inBandPts.filter((p) => p.gravity.includes(band.gravity)).length;
  const bandLabel = lunar === 0 ? "Moon Base band: no PSI test in lunar gravity" : `Moon Base band: ${lunar} points in lunar gravity`;
  const tc = timeline.counts;
  return (
    <main className="page lenses">
      <header className="hero">
        <h1>Lenses: what each PSI investigation is about, for fire safety</h1>
        <p className="lede">
          Each investigation is tagged by safety leg (prevention, detection, suppression) and by phenomenon (ignition, spread, extinction, smoke). Every tag has a word-for-word
          quote from the investigation&apos;s PSI record or from NASA&apos;s challenge text, checked by code (tools/build_lenses.py). No quote, no tag.
        </p>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>Lens matrix</h2>
          <p className="muted">
            {c.investigations} investigations, {c.tag_rows} checked quotes. Hover or focus a dot to read the quote and its source. An empty cell means no quote was found in
            these fields, not that the investigation has nothing to say.
          </p>
        </div>
        <LensMatrix rows={lenses.investigations} legs={lenses.axes.legs} phenomena={lenses.axes.phenomena} />
        <p className="muted lens-rule">
          <strong>Strength.</strong> {lenses.rules.strength}
        </p>
        <p className="muted lens-rule">
          <strong>How a tag is allowed.</strong> {lenses.rules.keyword_note} {lenses.rules.matching}
        </p>
        <p className="muted lens-rule">
          Rows tagged here: prevention {c.legs.prevention}, detection {c.legs.detection}, suppression {c.legs.suppression}; ignition {c.phenomena.ignition}, spread{" "}
          {c.phenomena.spread}, extinction {c.phenomena.extinction}, smoke {c.phenomena.smoke}.
        </p>
        {lenses.investigations.some((i) => i.context.length) && (
          <div className="lens-context">
            <h3>Context (not a tag)</h3>
            <ul>
              {lenses.investigations.flatMap((i) =>
                i.context.map((x, k) => (
                  <li key={`${i.accession}-${k}`}>
                    {displayName(i)}, {x.label}: &ldquo;{x.quote}&rdquo; <span className="muted">({sourceLabel(x.source)})</span>
                  </li>
                )),
              )}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Oxygen ceiling and materials</h2>
          <p className="muted">
            The highest ambient oxygen tested in PSI per fuel phase, against the Moon Base and the spacesuit, and the materials index are on the{" "}
            <a data-help="lenses-materials-link" href="/investigations/materials">
              Materials and oxygen
            </a>{" "}
            page.
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Evidence timeline</h2>
          <p className="muted">
            Each dot is an (oxygen, pressure) test point of a PSI investigation, shown from the year PSI gives for the end of that investigation. {tc.with_points} of{" "}
            {tc.investigations} investigations have both values in a test; {tc.undated} have no date in PSI and appear in the last frame. The Moon Base band (
            {band.vertices.map((v) => `${pct(v.o2)} % at ${round(v.kpa)} kPa`).join(", ")}) is the same band as on the Mission Planner.{" "}
            {inBand === 0
              ? "No PSI test point lies inside it."
              : `${inBand} PSI test points (${inBandAccs.join(", ")}) lie inside it in oxygen and pressure, tested in ${inBandGravity.join(" / ").replaceAll("_", " ")}.`}{" "}
            {lunar === 0 ? "None of them is in lunar (partial) gravity, so the band is drawn empty." : ""} The challenge says: &ldquo;{ch.partial_gravity.quote}&rdquo;. FM2&apos;s tests are planned, not in PSI (NTRS 20260001966{fm2.source?.page ? `, PDF p. ${fm2.source.page}` : ""}: &ldquo;{fm2.source?.quote}&rdquo;).
          </p>
        </div>
        <Timeline points={pts} frames={frames(timeline)} band={{ vertices: band.vertices, label: bandLabel }} fm2={fm2.points} names={names} yearLabel={timeline.rules.label} />
        <p className="muted lens-rule">
          {timeline.rules.placement} {band.convention}
        </p>
        <ul className="muted lens-rule">
          {timeline.investigations.map((i) => (
            <li key={i.accession}>
              {displayName(i)} ({i.accession}): start {i.dates.investigationStartDate || "not stated in PSI"}, end {i.dates.investigationEndDate || "not stated in PSI"}
              {i.date_note ? ` (${i.date_note})` : ""}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
