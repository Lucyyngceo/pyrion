import type { Metadata } from "next";
import Link from "next/link";
import { evaluateOnServer, serverData } from "@/lib/server-eval";
import { ISS_PRESET } from "@/lib/presets";
import { KPA_PER_PSI, PRESETS, evaluate, levelSentence, verdictLabel, type ClusterVerdict, type ConditionRecord, type Target } from "@/lib/engine";
import { loadPlanner } from "@/lib/planner/data";
import { evidenceGaps } from "@/lib/gaps";
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

const psia = (kpa: number) => Math.round((kpa / KPA_PER_PSI) * 10) / 10;
const gravityOf = (v: ClusterVerdict) => v.regime.find((r) => r.axis === "gravity_regime")?.values.join(" / ").replaceAll("_", " ") ?? "not stated";

export default async function Example() {
  // Part A — the Moon Base condition from the challenge, solid materials.
  const moon = PRESETS.find((x) => x.id === "challenge-lunar-base")!;
  const mO2 = moon.continuous.o2_mole_fraction!.value;
  const mP = moon.continuous.pressure!.value;
  const lunar = await evaluateOnServer({ regime: { gravity_regime: "partial_gravity", fuel_phase: "solid" }, continuous: { o2_mole_fraction: mO2, pressure: mP } });
  // The same oxygen and pressure with gravity left open: the nearest solid-fuel evidence in any regime PSI has.
  const anyG = await evaluateOnServer({ regime: { fuel_phase: "solid" }, continuous: { o2_mole_fraction: mO2, pressure: mP } });
  const nearest = anyG.evaluation.ranked.filter((v, i, a) => a.findIndex((x) => x.accession === v.accession) === i).slice(0, 3);
  const planner = await loadPlanner();
  const fm2 = planner.experiments.find((e) => e.id === "fm2");

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

  // What-if (PYRION assumption, never evidence): the Saffire flights have measured oxygen but no pressure in the
  // NASA sources found. In memory only, for this section: add 1 atm for each Saffire test that has oxygen and no pressure.
  const ASSUMED_KPA = 101.325;
  const { records } = await serverData();
  const SAFFIRE = ["PSI-98", "PSI-99", "PSI-100"];
  const hypo: ConditionRecord[] = [];
  for (const acc of SAFFIRE) {
    const mine = records.filter((r) => r.accession === acc && r.status !== "insufficient_evidence");
    const withO2 = new Set(mine.filter((r) => r.variable === "o2_mole_fraction").map((r) => r.test_id));
    const withP = new Set(mine.filter((r) => r.variable === "pressure").map((r) => r.test_id));
    for (const t of withO2) {
      if (withP.has(t)) continue;
      hypo.push({
        accession: acc,
        test_id: t,
        variable: "pressure",
        value: String(ASSUMED_KPA),
        unit: "kPa",
        value_original: "1",
        unit_original: "atm",
        method: "document",
        source_file: "PYRION assumption (not a NASA source)",
        source_location: "not stated in the downloaded NASA sources",
        quote: "",
        status: "extracted",
        note: "ASSUMPTION, not evidence: cabin pressure taken as 1 atm because no NASA source found states it for this flight.",
        origin: { file: "what-if", line: 0 },
      });
    }
  }
  const whatIf = evaluate([...records, ...hypo], target);
  const gaps = await evidenceGaps(target);
  const useful = gaps.filter((g) => g.reachable);
  const fmt = (axis: string, x: number) => (axis === "pressure" ? `${Math.round(x * 10) / 10} kPa (${psia(x)} psia)` : pct(x));
  const missingCorners = planner.minimumTest.missing;
  const verdictFor = (ev: typeof evaluation, acc: string) => {
    const v = [...ev.ranked, ...ev.unranked].find((x) => x.accession === acc);
    return v ? (v.extrapolationLevel ? levelSentence(v.extrapolationLevel) : verdictLabel(v.verdict)) : "—";
  };
  const reasonFor = (ev: typeof evaluation, acc: string) => [...ev.ranked, ...ev.unranked].find((x) => x.accession === acc)?.reasons.find((r) => !r.informational)?.message ?? "";

  return (
    <main className="page landing">
      <section className="ld-hero" aria-labelledby="ex-h">
        <p className="ld-kicker">Worked examples · computed by the engine on the server, no AI</p>
        <h1 id="ex-h" className="ld-title">Two questions, answered step by step, with NASA&apos;s sources</h1>
        <p className="ld-answer">
          Using NASA&apos;s Physical Sciences Informatics (PSI) database, this page runs two complete questions through PYRION — the Moon Base, then ISS cabin air — and prints every step, so it can be checked without clicking anything.
          Both are live on the{" "}
          <Link data-help="example-link" href="/envelope?preset=challenge-lunar-base">
            dashboard
          </Link>{" "}
          (Moon Base and ISS cabin air presets; set the fuel phase to solid).
        </p>
      </section>

      <section className="ld-section" aria-labelledby="ex-a">
        <p className="ld-kicker">Example A · the Moon Base</p>
        <h2 id="ex-a">NASA&apos;s Moon Base at {pct(mO2)} oxygen and {psia(mP)} psi: what has NASA tested near it?</h2>
        <ol className="ld-steps-list">
          <li>
            <strong>The condition.</strong> The challenge expects the Moon Base at &ldquo;30% or greater, with a corresponding pressure of
            10.2 psi or less&rdquo;; PYRION checks the corner ({pct(mO2)}, {psia(mP)} psi) at lunar gravity (0.16 g), for solid cabin
            materials.
          </li>
          <li>
            <strong>In lunar gravity: nothing in PSI.</strong>{" "}
            {lunar.evaluation.regimeUntested
              ? `No PSI test was run in partial gravity; the investigations state only ${lunar.evaluation.regimeUntested.testedValues.map((x) => x.replaceAll("_", " ")).join(" and ")}.`
              : `${lunar.evaluation.counts.investigations.APPLICABLE} investigations are applicable.`}{" "}
            NASA&apos;s challenge says the same: &ldquo;there is currently no partial-gravity combustion data available in PSI.&rdquo;
          </li>
          <li>
            <strong>The nearest evidence, in other gravities.</strong> With gravity left open, the closest solid-fuel tests to this
            oxygen and pressure are:{" "}
            {nearest.length === 0
              ? "none with comparable oxygen and pressure."
              : nearest.map((v, i) => (
                  <span key={v.accession}>
                    {i > 0 ? "; " : ""}
                    <Link data-help="example-link" href={`/investigations/${v.accession}`}>
                      {v.accession} {name(v.accession)}
                    </Link>{" "}
                    ({gravityOf(v)}: {(v.reasons.find((r) => !r.informational)?.message ?? verdictLabel(v.verdict)).replace(/\.$/, "")}) · DOI{" "}
                    <a data-help="example-link" href={`https://doi.org/${doi(v.accession)}`}>
                      {doi(v.accession)}
                    </a>
                  </span>
                ))}
            . Microgravity and normal-gravity results could bound what happens in between (challenge statement); they do not
            replace a lunar test.
          </li>
          <li>
            <strong>Why that matters for materials.</strong> NASA selects cabin materials with a ground (1 g) test. NASA researchers
            write: &ldquo;Recent research has shown that current normal gravity materials flammability results are not conservative
            when compared to flammability in ventilated microgravity&rdquo; (Olson &amp; Ferkul,{" "}
            <a data-help="example-link" href="https://ntrs.nasa.gov/citations/20150008961">
              NTRS 20150008961
            </a>
            , p. 1). So reduced-gravity evidence is what checks the ground test, and for the Moon there is none in PSI yet.
          </li>
          <li>
            <strong>What comes next.</strong>{" "}
            {fm2 && fm2.points.length > 0
              ? `NASA's planned FM2 experiment would burn one fabric at ${fm2.points.map((x) => pct(x.o2_mole_fraction)).join(", ")} oxygen, nominally at ${psia(fm2.points[0].pressure_kpa)} psia — below the challenge's 10.2 psi upper bound (planned, not in PSI).`
              : "NASA's planned FM2 experiment is described on the Mission Planner."}{" "}
            <Link data-help="example-link" href="/planner">
              See which parts of the Moon Base band no planned test reaches
            </Link>
            .
          </li>
        </ol>
        <p className="ld-src small">
          Fingerprint of the lunar computation (SHA-256): <code>{lunar.sha256}</code>
        </p>
      </section>

      <section className="ld-section" aria-labelledby="ex-b">
        <p className="ld-kicker">Example B · the ISS cabin, step by step</p>
        <h2 id="ex-b">The same engine on ISS cabin air, with every receipt</h2>
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
          {c.APPLICABLE} inside the tested range · {c.EXTRAPOLATION} outside the tested range · {c.INSUFFICIENT_EVIDENCE} insufficient evidence ·{" "}
          {c.REGIME_BARRIER} not comparable (different gravity, fuel or atmosphere). Ordered by how close their tested conditions are (not by importance).
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
                    {v.extrapolationLevel ? levelSentence(v.extrapolationLevel) : verdictLabel(v.verdict)}
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

      <section className="ld-section ld-whatif" aria-labelledby="ex-wi">
        <p className="ld-kicker">What if · a PYRION assumption, not evidence</p>
        <h2 id="ex-wi">If the Saffire flights were at 1 atm, how would they compare?</h2>
        <p>
          The Saffire experiments burned large samples aboard Cygnus spacecraft, and their oxygen is recorded, but no NASA source we
          downloaded states the cabin pressure. Here, and only here, PYRION assumes <strong>1 atm (101.3 kPa)</strong> for the{" "}
          {hypo.length} Saffire tests that have oxygen and no pressure, and runs the same engine again. Nothing on the rest of the site
          uses this assumption, and it never counts as evidence. A NASA statement of the cabin pressure would replace it.
        </p>
        <div className="tars-cmptable">
          <table>
            <thead>
              <tr>
                <th>Investigation</th>
                <th>With NASA&apos;s records only</th>
                <th>If the cabin was at 1 atm (assumption)</th>
                <th>Why, in one line (assumption case)</th>
              </tr>
            </thead>
            <tbody>
              {SAFFIRE.map((acc) => (
                <tr key={acc}>
                  <td>
                    <Link data-help="example-link" href={`/investigations/${acc}`}>
                      {acc} {name(acc)}
                    </Link>
                  </td>
                  <td>{verdictFor(evaluation, acc)}</td>
                  <td>{verdictFor(whatIf, acc)}</td>
                  <td className="small">{reasonFor(whatIf, acc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Why it matters: if a NASA document confirms the pressure, these large-scale cabin-material tests would join BASS and BASS-II
          as the closest evidence for ISS cabin air. Finding that statement, or measuring it in a future flight, is a concrete next step.
        </p>
      </section>

      <section className="ld-section" aria-labelledby="ex-gaps">
        <p className="ld-kicker">Evidence gaps that matter · computed, nothing assumed</p>
        <h2 id="ex-gaps">Which missing number would make the most of NASA&apos;s data comparable?</h2>
        <p>
          For ISS cabin air (solid materials), PYRION lists every value that is not stated in PSI and blocks a comparison. For each, the
          engine tries candidate values in memory and reports the range the NASA record would need to state for the investigation to
          become comparable under PYRION&apos;s stated rule. Nothing is assumed and nothing is added to the data.
        </p>
        <div className="tars-cmptable">
          <table>
            <thead>
              <tr>
                <th>Investigation</th>
                <th>Not stated in PSI</th>
                <th>Tests</th>
                <th>Would become comparable if PSI stated</th>
                <th>Result then</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => (
                <tr key={`${g.accession}|${g.axis}`}>
                  <td>
                    <Link data-help="example-link" href={`/investigations/${g.accession}`}>
                      {g.accession} {name(g.accession)}
                    </Link>
                  </td>
                  <td>{g.axis === "pressure" ? "pressure" : "oxygen"}</td>
                  <td>{g.tests.length}</td>
                  <td>{g.range ? (g.range[0] === g.range[1] ? fmt(g.axis, g.range[0]) : `${fmt(g.axis, g.range[0])} to ${fmt(g.axis, g.range[1])}`) : "no value would (see why)"}</td>
                  <td className="small">
                    {g.reachable ? (g.reachableLevel ? levelSentence(g.reachableLevel as Parameters<typeof levelSentence>[0]) : verdictLabel(g.reachable)) : ""}
                    {g.reason ? ` — ${g.reason}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong>Reading it:</strong> {useful.length} of the {gaps.length} gaps could make an investigation comparable to ISS cabin air if a
          NASA document stated the value; the rest would still be blocked by another missing value. Asking PSI for these few numbers is
          the cheapest way to add evidence. Why it matters: large-scale tests of cabin materials in microgravity are the evidence that
          checks NASA&apos;s ground test (Olson &amp; Ferkul, NTRS 20150008961).
        </p>
        {missingCorners.length > 0 && (
          <p>
            <strong>For the Moon, no number in PSI can help:</strong> no test was run in lunar gravity. The new tests that would span the
            Moon Base band under PYRION&apos;s convention are{" "}
            {missingCorners.map((m) => `${pct(m.o2_mole_fraction)} O₂ at ${psia(m.pressure_kpa)} psia`).join("; ")} (
            <Link data-help="example-link" href="/planner">
              Mission Planner
            </Link>
            ).
          </p>
        )}
        <p className="ld-src small">
          &ldquo;Comparable&rdquo; means inside or just outside the tested range under PYRION&apos;s stated rule (0.5 % tolerance); it does not
          predict how a flame behaves.
        </p>
      </section>

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
