import type { Metadata } from "next";
import Link from "next/link";
import { loadFacts } from "@/lib/facts";
import { loadPlanner } from "@/lib/planner/data";
import "./landing.css";

export const metadata: Metadata = {
  title: "PYRION Ω · Which NASA combustion tests apply to your cabin",
  description: "Which NASA combustion tests apply to your cabin condition, and where the measured evidence ends. NASA Space Apps 2026, Flame in Freefall.",
};

const pct = (x: number) => `${Math.round(x * 1000) / 10} %`;
const CHALLENGE = "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/";
const MOON = "/envelope?preset=challenge-lunar-base";

export default async function Landing() {
  const [facts, planner] = await Promise.all([loadFacts(), loadPlanner()]);
  const fm2 = planner.experiments.find((e) => e.id === "fm2");
  const fm2Psia = fm2 && fm2.points.length > 0 ? Math.round((fm2.points[0].pressure_kpa / 6.894757) * 10) / 10 : null;

  return (
    <main className="page landing">
      {/* 1 · First screen: the problem, the answer, two buttons. */}
      <section className="ld-hero" aria-labelledby="ld-h">
        <p className="ld-kicker">NASA Space Apps 2026 · Flame in Freefall · team NDMLM</p>
        <h1 id="ld-h" className="ld-title">
          Which NASA combustion tests apply to your cabin condition, and where the measured evidence ends.
        </h1>
        <p className="ld-problem">
          <strong>The problem.</strong> NASA&apos;s planned Moon Base air has more oxygen at lower pressure than Earth, and
          lunar gravity. Flammability depends strongly on oxygen and gravity, yet the NASA combustion data in PSI is hard to
          find, compare and interpret.
        </p>
        <p className="ld-answer">
          <strong>The answer.</strong> PYRION compares your condition with every extracted NASA test in PSI, by rules, and
          shows which tests apply, the source of each one, and where the measurements stop.
        </p>
        <div className="ld-cta">
          <Link data-help="landing-start" href={MOON} className="ld-btn ld-btn-primary">
            Start: Moon Base
          </Link>
          <Link data-help="landing-explore" href="/envelope" className="ld-btn">
            Explore the dashboard
          </Link>
        </div>
        <p className="ld-facts small muted">
          {facts.sentence}, from {facts.investigationsWithData} of {facts.investigationsTotal} PSI combustion investigations.
        </p>
      </section>

      {/* 2 · The finding, with its definition next to the number. */}
      <section className="ld-section ld-finding" aria-labelledby="ld-finding-h">
        <h2 id="ld-finding-h">The finding</h2>
        <div className="ld-finding-grid">
          <div className="ld-big">
            <span className="ld-num">{pct(planner.coverage.fraction)}</span>
            <p>
              PSI covers {pct(planner.coverage.fraction)} of the Moon Base design band ({planner.coverage.covered} of{" "}
              {planner.coverage.total} grid cells, lunar gravity). <em>&ldquo;Covered&rdquo; means inside the region spanned by measured test points (interpolated between tests, not necessarily a test at that exact condition), not that fire behaves the same there.</em>
            </p>
          </div>
          <div className="ld-finding-text">
            <p>
              NASA&apos;s Moon Base condition (30 % O₂ or more at 10.2 psi or less, lunar gravity) has no test in PSI in that
              gravity regime. NASA states it in the challenge resources: &ldquo;there is currently no partial-gravity
              combustion data available in PSI&rdquo; (
              <a data-help="landing-source" href={CHALLENGE} target="_blank" rel="noreferrer">
                challenge statement
              </a>
              ).
            </p>
            {fm2Psia !== null && (
              <p>
                FM2 as planned measures a single line at {fm2Psia} psia ({pct(planner.layers.fm2.fraction)} of the band); the
                challenge&apos;s 10.2 psi condition stays unmeasured.
              </p>
            )}
            <Link data-help="landing-planner" href="/planner" className="ld-link">
              Open the Mission Planner →
            </Link>
          </div>
        </div>
      </section>

      {/* 3 · Why this matters. */}
      <section className="ld-section" aria-labelledby="ld-why-h">
        <h2 id="ld-why-h">Why this matters</h2>
        <div className="ld-grid3">
          <article className="ld-card">
            <h3>Fire in a spacecraft is close</h3>
            <p>
              &ldquo;[If] you want to get somebody&apos;s attention really quick, make the fire alarm go off in your spacecraft
              when you&apos;re still about 80,000 miles from home.&rdquo; Artemis II commander, quoted in the challenge statement.
            </p>
          </article>
          <article className="ld-card">
            <h3>Flames change without gravity</h3>
            <p>
              Without buoyancy, &ldquo;a candle flame becomes a ghostly blue sphere reliant on diffusion for its oxygen&rdquo;
              (challenge statement). Results from one gravity level do not carry over by default.
            </p>
          </article>
          <article className="ld-card">
            <h3>The Moon Base air is different</h3>
            <p>
              The challenge statement expects increased oxygen and reduced pressure in the planned Moon Base and rovers.
              Flammability is highly dependent on oxygen concentration.
            </p>
          </article>
        </div>
      </section>

      {/* 4 · How it works, with the rule visible. */}
      <section className="ld-section" aria-labelledby="ld-how-h">
        <h2 id="ld-how-h">How it works</h2>
        <ol className="ld-steps">
          <li>
            <span className="ld-step-n">1</span>
            <h3>Pick a condition</h3>
            <p>Choose a scenario such as the Moon Base, set oxygen, pressure and gravity, or ask in plain English.</p>
          </li>
          <li>
            <span className="ld-step-n">2</span>
            <h3>The engine compares</h3>
            <p>A deterministic engine compares it with every extracted NASA test, field by field.</p>
          </li>
          <li>
            <span className="ld-step-n">3</span>
            <h3>You get a verdict with its receipt</h3>
            <p>Each verdict comes with its DOI, the nearest evidence, and what experiment would close the gap.</p>
          </li>
        </ol>
        <p className="ld-rule">The verdict comes from code, not from AI.</p>
      </section>

      {/* 5 · What makes it different. */}
      <section className="ld-section" aria-labelledby="ld-diff-h">
        <h2 id="ld-diff-h">What makes it different</h2>
        <div className="ld-grid3">
          <article className="ld-card">
            <h3>Verdicts by rules</h3>
            <p>The applicability verdict is computed by code. A language model can read your question and explain, never decide.</p>
          </article>
          <article className="ld-card">
            <h3>Every value located</h3>
            <p>Every extracted value carries its file and location in the NASA source, checked by code.</p>
          </article>
          <article className="ld-card">
            <h3>It shows where evidence ends</h3>
            <p>When PSI has no test for a condition, it says so, and marks it insufficient evidence instead of guessing.</p>
          </article>
        </div>
      </section>

      {/* 6 · Who it is for. */}
      <section className="ld-section" aria-labelledby="ld-who-h">
        <h2 id="ld-who-h">Who it is for</h2>
        <div className="ld-grid3">
          <article className="ld-card">
            <h3>Fire-safety engineers</h3>
            <p>Which tests apply to a cabin atmosphere, with the source of each value.</p>
          </article>
          <article className="ld-card">
            <h3>Mission planners</h3>
            <p>How much of a design band PSI measures, and which planned tests would add to it.</p>
          </article>
          <article className="ld-card">
            <h3>Researchers and students</h3>
            <p>Comparable investigations side by side, with the conditions quoted from NASA.</p>
          </article>
        </div>
      </section>

      {/* 7 · The AI assistant. */}
      <section className="ld-section ld-tars" aria-labelledby="ld-tars-h">
        <h2 id="ld-tars-h">The AI assistant (TARS SI)</h2>
        <p>
          An AI assistant that answers in three labelled layers: what the engine computed, what NASA wrote (quoted and checked),
          and its own reasoning, marked as such.
        </p>
        <Link data-help="landing-tars" href="/tars" className="ld-link">
          Ask TARS SI →
        </Link>
      </section>

      {/* 8 · On Earth, quoted only. */}
      <section className="ld-section" aria-labelledby="ld-earth-h">
        <h2 id="ld-earth-h">On Earth</h2>
        <blockquote className="ld-quote">
          &ldquo;Fine-water-mist extinguishers developed for use on the ISS have practical applications here on Earth, and NASA
          technology has similarly led to improvements in terrestrial smoke detection and firefighter gear, including protective
          clothing and air tanks.&rdquo;
          <cite>Flame in Freefall challenge statement, NASA Space Apps 2026</cite>
        </blockquote>
        <Link data-help="landing-card" href="/more" className="ld-link">
          Earth applications as stated in PSI records →
        </Link>
      </section>

      {/* 9 · Go deeper: the pages that left the main menu. */}
      <section className="ld-section" aria-labelledby="ld-deeper-h">
        <h2 id="ld-deeper-h">Go deeper</h2>
        <div className="ld-grid3 ld-links">
          <Link data-help="landing-card" href="/method" className="ld-card ld-card-link">
            <h3>Method</h3>
            <p>How the engine decides whether a NASA test applies to a target condition.</p>
          </Link>
          <Link data-help="landing-card" href="/proof" className="ld-card ld-card-link">
            <h3>Proof</h3>
            <p>One screen of evidence of rigor, every number read from a repository file at build time.</p>
          </Link>
          <Link data-help="landing-card" href="/data" className="ld-card ld-card-link">
            <h3>Data</h3>
            <p>Lineage and coverage: where each value comes from and how code checks it.</p>
          </Link>
          <Link data-help="landing-card" href="/bridge" className="ld-card ld-card-link">
            <h3>Bridge</h3>
            <p>A labelled hypothesis relating microgravity tests to other gravity levels. Not evidence.</p>
          </Link>
          <Link data-help="landing-card" href="/lenses" className="ld-card ld-card-link">
            <h3>Lenses and timeline</h3>
            <p>Investigations by safety leg and phenomenon, each tag with a verbatim quote.</p>
          </Link>
          <Link data-help="landing-card" href="/help" className="ld-card ld-card-link">
            <h3>Help</h3>
            <p>Every control and term on the site, explained.</p>
          </Link>
        </div>
      </section>

      {/* 10 · FAQ, all visible. */}
      <section className="ld-section" aria-labelledby="ld-faq-h">
        <h2 id="ld-faq-h">Questions</h2>
        <dl className="ld-faq">
          <div>
            <dt>Does PYRION say a cabin is safe?</dt>
            <dd>No. It reports evidence coverage: which measured tests apply to a condition. It is not a safety assessment.</dd>
          </div>
          <div>
            <dt>Where does the AI come in?</dt>
            <dd>It reads plain-English questions and explains results. The verdict itself is computed by the engine.</dd>
          </div>
          <div>
            <dt>What if a value cannot be checked?</dt>
            <dd>The record is marked insufficient evidence and shown as such, never filled in.</dd>
          </div>
          <div>
            <dt>Is this a NASA product?</dt>
            <dd>No. It is a hackathon project that uses public NASA data.</dd>
          </div>
        </dl>
      </section>

      {/* 11 · Sources. */}
      <section className="ld-section" aria-labelledby="ld-src-h">
        <h2 id="ld-src-h">Sources</h2>
        <p>
          NASA Physical Sciences Informatics (PSI): {facts.investigationsTotal} combustion investigations, each listed with its
          DOI on the{" "}
          <Link data-help="landing-card" href="/investigations">
            Investigations
          </Link>{" "}
          page. Challenge statement:{" "}
          <a data-help="landing-source" href={CHALLENGE} target="_blank" rel="noreferrer">
            Flame in Freefall
          </a>
          .
        </p>
      </section>
    </main>
  );
}
