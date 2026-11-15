import type { Metadata } from "next";
import "./lenses.css";
import LensMatrix from "@/components/lenses/LensMatrix";
import Timeline from "@/components/lenses/Timeline";
import { loadLenses, loadTimeline } from "@/lib/lenses/data";
import { displayName, fm2Planned, frames, inPolygon, moonBand, pct, round, slimPoints, sourceLabel } from "@/lib/lenses/model";
import { LENS_LEGS, lensFilterHref, parseLeg } from "@/lib/lenses/equipment";

export const metadata: Metadata = {
  title: "Lenses · PYRION Ω",
  description: "PSI investigations by safety leg and phenomenon, each tag with a verbatim quote, and the evidence timeline.",
};

export default async function LensesPage({ searchParams }: { searchParams: Promise<{ leg?: string | string[] }> }) {
  const leg = parseLeg((await searchParams).leg);
  const lenses = loadLenses();
  const timeline = loadTimeline();
  const band = moonBand();
  const fm2 = fm2Planned();
  const ch = lenses.challenge;
  const names = Object.fromEntries(lenses.investigations.map((i) => [i.accession, displayName(i)]));
  const c = lenses.counts;
  // ?leg=prevention|detection|suppression keeps the rows with at least one quote for that leg; anything else shows all.
  const rows = leg ? lenses.investigations.filter((i) => (i.legs[leg] ?? []).length > 0) : lenses.investigations;
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
          This page is for finding, in one table, which of the 24 PSI combustion investigations speak to fire prevention, detection or suppression, using only their own
          PSI records and NASA&apos;s challenge statement as evidence.
        </p>
        <p className="muted">
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
        <p className="lens-filter" role="group" aria-label="Filter by safety leg">
          Show:{" "}
          <a data-help="lenses-leg-filter" href="/lenses" aria-current={leg === null ? "true" : undefined}>
            all {lenses.investigations.length}
          </a>
          {LENS_LEGS.map((l) => (
            <span key={l}>
              {" · "}
              <a data-help="lenses-leg-filter" href={lensFilterHref(l)} aria-current={leg === l ? "true" : undefined}>
                {l} ({c.legs[l]})
              </a>
            </span>
          ))}
        </p>
        {leg && (
          <p className="muted lens-rule" role="status">
            Showing the {rows.length} investigations with at least one {leg} quote. The other columns are still shown for these rows.
          </p>
        )}
        <LensMatrix rows={rows} legs={lenses.axes.legs} phenomena={lenses.axes.phenomena} />
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
