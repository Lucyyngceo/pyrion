import type { Metadata } from "next";
import Link from "next/link";
import { loadFacts } from "@/lib/facts";
import "./landing.css";

export const metadata: Metadata = {
  title: "PYRION Ω · NASA fire experiments, and where the tested evidence ends",
  description:
    "Find the NASA fire experiments relevant to your habitat — and see where the tested evidence ends. NASA Space Apps 2026, Flame in Freefall.",
};

const CHALLENGE = "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/";
const PSI = (acc: string) => `https://psi.nasa.gov/physci/repo/data/investigations/${acc}`;
const MOON = "/envelope?preset=challenge-lunar-base";
const ISS = "/envelope?preset=iss-cabin-air";

/** Verbatim sentences from PSI investigation records (field named), checked by test against the PSI JSON. */
const NASA_SAYS = [
  {
    acc: "PSI-99",
    name: "Saffire-II",
    field: "researchImpacts",
    text: "Results determine microgravity flammability limits for several spacecraft materials",
    why: "Which cabin materials keep burning in microgravity, and at what conditions.",
  },
  {
    acc: "PSI-26",
    name: "BASS",
    field: "researchImpacts",
    text: "Using nitrogen as a flame suppressant in microgravity provides a direct link to current and planned extinguishment techniques",
    why: "How an inert gas puts out flames over solid materials: suppression research.",
  },
  {
    acc: "PSI-69",
    name: "FLEX",
    field: "approach",
    text: "A primary objective of the experiments is to determine the Limiting Oxygen Index (LOI) as a function of ambient pressure",
    why: "How much oxygen a flame needs, and how that changes with cabin pressure.",
  },
] as const;

/** Representative images from the PSI investigation records (credits in public/media/psi/CREDITS.json). */
const FLAMES = [
  { src: "/media/psi/acme-flame-design-in-space.webp", acc: "PSI-10", name: "ACME Flame Design", cap: "A flame aboard the ISS" },
  { src: "/media/psi/e-field-flames-blue.webp", acc: "PSI-22", name: "E-FIELD Flames", cap: "A flame shaped by an electric field" },
  { src: "/media/psi/cfi-g-cool-flames.webp", acc: "PSI-159", name: "CFI-G", cap: "A spherical flame on a porous burner" },
  { src: "/media/psi/bass-ii-flame-testing.webp", acc: "PSI-25", name: "BASS-II", cap: "A flame over a solid sample" },
] as const;

const SECTIONS = [
  { id: "about", label: "About" },
  { id: "found", label: "What NASA found" },
  { id: "edge", label: "The lunar edge" },
  { id: "how", label: "How it works" },
  { id: "users", label: "Who it's for" },
  { id: "faq", label: "FAQ" },
];

const DEEPER = [
  ["/investigations", "Investigations", "Every PSI study: summary in NASA's words, tests, hardware families, one-click comparisons."],
  ["/lenses", "Safety lenses", "Prevention, detection and suppression: each tag backed by a quote."],
  ["/more", "Equipment & Earth", "Detection, suppression and prevention research, and uses on Earth."],
  ["/tars", "TARS SI", "Ask in your own words; answers in labelled layers: engine, NASA quoted, and its own reasoning."],
  ["/data", "Data", "The extracted dataset, with the source of every row, ready to download."],
  ["/proof", "Proof", "The validator report and the scripted judge battery, read from the repository."],
] as const;

export default async function Landing() {
  const facts = await loadFacts();

  return (
    <div className="landing-root">
      <header className="ld-bar">
        <div className="ld-bar-inner">
          <Link data-help="nav-home" href="/" className="ld-brand">
            PYRION <span className="omega">Ω</span>
          </Link>
          <nav aria-label="On this page" className="ld-anchors">
            {SECTIONS.map((s) => (
              <a key={s.id} data-help="landing-nav" href={`#${s.id}`}>
                {s.label}
              </a>
            ))}
          </nav>
          <Link data-help="landing-explore" href="/envelope" className="ld-btn ld-btn-primary ld-bar-cta">
            Explore the dashboard →
          </Link>
        </div>
      </header>

      <main className="page landing">
        <section className="ld-hero ld-hero-split" aria-labelledby="ld-h">
          <div className="ld-hero-text">
          <p className="ld-kicker">NASA Space Apps 2026 · Flame in Freefall · team MLMP</p>
          <h1 id="ld-h" className="ld-title">
            Find the NASA fire experiments relevant to your habitat — and see where the tested evidence ends.
          </h1>
          <p className="ld-answer">
            PYRION reads NASA&apos;s 24 combustion investigations in PSI. Set a cabin condition and it shows which tests come close,
            what NASA set out to learn there, and the source of every value.
          </p>
          <div className="ld-cta">
            <Link data-help="landing-start" href={ISS} className="ld-btn ld-btn-primary">
              Try it: ISS cabin air
            </Link>
            <Link data-help="landing-start" href={MOON} className="ld-btn">
              Try it: the Moon Base condition
            </Link>
            <Link data-help="landing-planner" href="/planner" className="ld-btn">
              Plan lunar tests
            </Link>
          </div>
          <p className="ld-facts small muted">{facts.sentence}</p>
          </div>
          <figure className="ld-hero-fig">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/media/psi/acme-flame-design-in-space.webp" alt="A flame burning aboard the International Space Station, ACME Flame Design" width={1094} height={804} />
            <figcaption className="small muted">
              A flame aboard the ISS. NASA PSI,{" "}
              <a data-help="landing-source" href={PSI("PSI-10")}>
                PSI-10
              </a>{" "}
              representative image.
            </figcaption>
          </figure>
        </section>

        <section className="ld-section ld-flames" aria-labelledby="ld-flames-h">
          <p className="ld-kicker">Real flames, real data</p>
          <h2 id="ld-flames-h">Fire without gravity, from NASA&apos;s own records</h2>
          <div className="ld-flame-strip">
            {FLAMES.map((f) => (
              <figure key={f.src} className="ld-flame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.src} alt={`${f.cap}, ${f.name}`} loading="lazy" />
                <figcaption className="small">
                  <strong>{f.name}</strong> · {f.cap}.{" "}
                  <a data-help="landing-source" href={PSI(f.acc)}>
                    NASA PSI {f.acc}
                  </a>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section id="about" className="ld-section" aria-labelledby="ld-about-h">
          <p className="ld-kicker">Why this matters</p>
          <h2 id="ld-about-h">More oxygen, lower pressure, a new gravity</h2>
          <div className="ld-grid3">
            <div className="ld-card">
              <h3>Richer air on the Moon</h3>
              <p>
                NASA expects the Moon Base and pressurized rovers at an oxygen concentration &ldquo;30% or greater, with a
                corresponding pressure of 10.2 psi or less&rdquo;, &ldquo;making materials much more flammable&rdquo;.
              </p>
              <p className="ld-src small">
                <a data-help="landing-source" href={CHALLENGE}>NASA Space Apps 2026 challenge statement</a>
              </p>
            </div>
            <div className="ld-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ld-card-img" src="/media/nasa/iss-2000.webp" alt="The International Space Station over Earth" loading="lazy" />
              <p className="ld-src small muted">
                ISS, 2000. Image:{" "}
                <a data-help="landing-source" href="https://images.nasa.gov/details/s97e5104">
                  NASA
                </a>
              </p>
              <h3>Data that is hard to use</h3>
              <p>
                NASA publishes its microgravity fire experiments in PSI, but the challenge notes the data &ldquo;can be hard to
                find, harder to compare, and harder yet to interpret&rdquo;.
              </p>
              <p className="ld-src small">
                <a data-help="landing-source" href={CHALLENGE}>NASA Space Apps 2026 challenge statement</a>
              </p>
            </div>
            <div className="ld-card">
              <h3>A gravity no PSI test has reached</h3>
              <p>
                &ldquo;There is currently no partial-gravity combustion data available in PSI.&rdquo; Microgravity and
                normal-gravity results could bound what happens in between.
              </p>
              <p className="ld-src small">
                <a data-help="landing-source" href={CHALLENGE}>NASA Space Apps 2026 challenge statement</a>
              </p>
            </div>
          </div>
        </section>

        <section id="found" className="ld-section" aria-labelledby="ld-found-h">
          <p className="ld-kicker">In NASA&apos;s words</p>
          <h2 id="ld-found-h">What NASA set out to learn, linked to the tests behind it</h2>
          <div className="ld-grid3">
            {NASA_SAYS.map((q) => (
              <div key={q.acc} className="ld-card">
                <h3>{q.name}</h3>
                <blockquote className="ld-quote">&ldquo;{q.text}&rdquo;</blockquote>
                <p className="ld-src small">
                  <a data-help="landing-source" href={PSI(q.acc)}>
                    PSI record {q.acc}, field &ldquo;{q.field}&rdquo;
                  </a>
                </p>
                <p>{q.why}</p>
                <p>
                  <Link data-help="landing-card" href={`/investigations/${q.acc}`} className="ld-link">
                    Open {q.name}: tests, conditions, DOI →
                  </Link>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="edge" className="ld-section ld-finding" aria-labelledby="ld-edge-h">
          <p className="ld-kicker">Where to test next</p>
          <h2 id="ld-edge-h">The lunar edge of the evidence</h2>
          <div className="ld-finding-grid">
            <div className="ld-big">
              <p>
                <strong>NASA&apos;s planned FM2 lunar experiment</strong> burns one fabric at several oxygen levels, nominally at{" "}
                <strong>8.2 psia</strong> — below the challenge&apos;s <strong>10.2 psi</strong> upper bound.
              </p>
              <p className="ld-src small">Planned, not in PSI. Source: NTRS 20260001966, cited on the Mission Planner.</p>
              <figure className="ld-edge-fig">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/media/nasa/lunar-south-pole.webp" alt="Mosaic of the lunar south pole from the Lunar Reconnaissance Orbiter" loading="lazy" />
                <figcaption className="small muted">
                  The lunar south pole. Image:{" "}
                  <a data-help="landing-source" href="https://images.nasa.gov/details/PIA13523">
                    NASA/GSFC/Arizona State University
                  </a>
                </figcaption>
              </figure>
            </div>
            <div className="ld-finding-text">
              <p>
                PYRION draws the Moon Base atmospheres on the oxygen-pressure plane, places the PSI tests and the planned FM2 points,
                and shows which parts of that region no planned test reaches. That is where new lunar-gravity tests would add the
                most evidence.
              </p>
              <p>Evidence for research and test planning — not a safety assessment, and not a prediction of how fire behaves on the Moon.</p>
              <Link data-help="landing-planner" href="/planner" className="ld-link">
                Open the Mission Planner →
              </Link>
            </div>
          </div>
        </section>

        <section id="how" className="ld-section" aria-labelledby="ld-how-h">
          <p className="ld-kicker">How it works</p>
          <h2 id="ld-how-h">Three steps, one rule</h2>
          <ol className="ld-steps">
            <li>
              <h3>1 · Set a condition</h3>
              <p>Pick a cabin preset (ISS air, the Moon Base condition, NASA exploration atmospheres) or set oxygen, pressure, gravity and fuel yourself.</p>
            </li>
            <li>
              <h3>2 · Compare with NASA&apos;s tests</h3>
              <p>
                A fixed-rule engine compares it with the tests extracted from PSI. Gravity, fuel phase and diluent are barriers; oxygen
                and pressure are compared with the region the tests span.
              </p>
            </li>
            <li>
              <h3>3 · Read the verdict and its receipt</h3>
              <p>Each investigation: applicable, extrapolation, insufficient evidence, or another regime — with the quote, the file location and the DOI.</p>
            </li>
          </ol>
          <p className="ld-rule">
            <strong>The rule:</strong> the same condition always gives the same verdict, from NASA&apos;s own records. AI helps read your
            question and explain the result; it never decides.{" "}
            <Link data-help="landing-card" href="/method" className="ld-link">
              Method →
            </Link>
          </p>
        </section>

        <section id="users" className="ld-section" aria-labelledby="ld-users-h">
          <p className="ld-kicker">Our users</p>
          <h2 id="ld-users-h">Who it&apos;s for</h2>
          <div className="ld-grid3">
            <div className="ld-card">
              <h3>Fire-safety researchers</h3>
              <p>See which PSI tests are comparable to a condition, and where a new experiment would add evidence.</p>
            </div>
            <div className="ld-card">
              <h3>Habitat and spacecraft engineers</h3>
              <p>Find the NASA evidence behind a cabin atmosphere, with receipts you can cite.</p>
            </div>
            <div className="ld-card">
              <h3>Professors and students</h3>
              <p>The 24 PSI combustion investigations in one place: objectives, tests, variables, hardware, publications.</p>
            </div>
          </div>
        </section>

        <section className="ld-section" aria-labelledby="ld-more-h">
          <p className="ld-kicker">Go deeper</p>
          <h2 id="ld-more-h">Everything else in PYRION</h2>
          <div className="ld-grid3">
            {DEEPER.map(([href, title, text]) => (
              <Link key={href} data-help="landing-card" href={href} className="ld-card ld-card-link">
                <h3>{title}</h3>
                <p>{text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section id="faq" className="ld-section" aria-labelledby="ld-faq-h">
          <p className="ld-kicker">Questions</p>
          <h2 id="ld-faq-h">Common questions</h2>
          <dl className="ld-faq">
            <dt>Is this a safety assessment?</dt>
            <dd>No. It shows which NASA tests are comparable to a condition and where the tested evidence ends. It never calls a condition safe.</dd>
            <dt>Where does the data come from?</dt>
            <dd>
              NASA Physical Sciences Informatics (PSI): the 24 combustion investigations, each cited with its DOI. Every value used as
              evidence is located by code in its NASA file.{" "}
              <Link data-help="landing-card" href="/data">
                Data →
              </Link>
            </dd>
            <dt>Does the AI decide the verdict?</dt>
            <dd>No. Fixed rules decide. The AI reads questions and explains; numbers come from code and NASA quotes are checked on their page.</dd>
            <dt>What does &ldquo;applicable&rdquo; mean?</dt>
            <dd>
              The condition lies between measured test points in the same regime (within a 0.5 % tolerance). No test was necessarily run
              at that exact condition, and PYRION computes no value there.
            </dd>
            <dt>Why the Moon?</dt>
            <dd>
              NASA&apos;s challenge asks about habitats including bases on the Moon and Mars. PSI holds no partial-gravity combustion
              data, so for those gravities PYRION shows the nearest evidence in other regimes and where new tests would add it. Try{" "}
              <Link data-help="landing-start" href={MOON}>
                the Moon Base condition
              </Link>{" "}
              or{" "}
              <Link data-help="landing-start" href="/envelope?preset=nesc-8.2psia-34o2-mars">
                a NASA exploration atmosphere at Mars gravity
              </Link>
              .
            </dd>
          </dl>
        </section>
      </main>
    </div>
  );
}
