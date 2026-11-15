import type { Metadata } from "next";
import Link from "next/link";
import StatusSymbol from "@/components/StatusSymbol";

export const metadata: Metadata = {
  title: "Method · PYRION Ω",
  description: "How PYRION decides whether a NASA PSI combustion test applies to a target condition.",
};

/** Schematic only: shapes, no data values. */
function HullDiagram() {
  const hull = "M70,150 L150,70 L260,60 L330,120 L290,190 L140,200 Z";
  const pts: [number, number][] = [
    [70, 150], [150, 70], [260, 60], [330, 120], [290, 190], [140, 200],
    [160, 130], [210, 110], [240, 150], [190, 170], [120, 165], [280, 130],
  ];
  return (
    <svg viewBox="0 0 560 250" width="100%" role="img" aria-labelledby="hd-t hd-d" className="method-svg">
      <title id="hd-t">Schematic of a measured envelope</title>
      <desc id="hd-d">
        Measured points of one regime, their convex hull, one target inside (applicable) and one outside (extrapolation), and
        a second regime drawn dashed: not comparable.
      </desc>
      <rect x="0.5" y="0.5" width="559" height="249" rx="10" fill="none" stroke="var(--border)" />
      <path d={hull} fill="var(--s1)" fillOpacity="0.12" stroke="var(--s1)" strokeWidth="1.75" strokeLinejoin="round" className="draw" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.5" fill="var(--s1)" stroke="var(--surface)" strokeWidth="2" />
      ))}
      <path d="M400,40 L520,60 L500,140 L410,120 Z" fill="none" stroke="var(--muted)" strokeDasharray="5 4" strokeWidth="1.5" />
      <text x="460" y="30" textAnchor="middle" className="m-lbl">other regime</text>
      <text x="460" y="160" textAnchor="middle" className="m-lbl muted-fill">not comparable</text>

      <g transform="translate(215,140)">
        <circle r="10" fill="none" stroke="var(--ink)" strokeWidth="2" />
        <circle r="3" fill="var(--ink)" />
      </g>
      <line x1="225" y1="132" x2="250" y2="40" stroke="var(--ink)" strokeWidth="1" />
      <text x="254" y="38" className="m-lbl">APPLICABLE</text>

      <g transform="translate(375,210)">
        <circle r="10" fill="none" stroke="var(--ink)" strokeWidth="2" strokeDasharray="3 3" />
        <circle r="3" fill="var(--ink)" />
      </g>
      <text x="392" y="214" className="m-lbl">EXTRAPOLATION</text>

      <text x="280" y="242" textAnchor="middle" className="m-axis">O₂ mole fraction →</text>
      <text x="14" y="125" className="m-axis" transform="rotate(-90 14 125)" textAnchor="middle">pressure →</text>
    </svg>
  );
}

export default function MethodPage() {
  return (
    <main className="page">
      <header className="hero">
        <h1 data-help="page-method">How PYRION decides</h1>
        <p className="lede">
          A deterministic rule set, not a model. Given a target condition, each NASA PSI combustion investigation gets one of
          four verdicts, and every input to that verdict is a value you can trace to a file.
        </p>
      </header>

      <div className="prose">
        <h2 data-help="method-axes">Two kinds of axes</h2>
        <p>
          <strong>Regime axes</strong> change the physics: gravity regime (microgravity, partial, normal), fuel phase (solid,
          liquid, gas), diluent (N₂, He, CO₂, …) and flame type. They are <em>barriers</em>: a test in another regime is not
          a worse match, it is not comparable, and no distance is defined across it.
        </p>
        <p>
          <strong>Continuous axes</strong> are compared only inside what was measured: ambient O₂ mole fraction and pressure, and,
          where the extracted records carry them, burner O₂, flow velocity, sample thickness, initial droplet diameter and
          ambient temperature. Only O₂ and pressure have a joint check: the engine builds the convex hull of each
          investigation&apos;s (O₂, pressure) test points, and a target inside it lies between measured test points (no test was necessarily run at that exact
          condition, and no value is computed there), while a target outside it would need extrapolation. The other axes are checked one at a time against their measured range.
        </p>
        <p data-help="method-coverage-honesty" className="honesty">
          Covered means the condition lies between measured PSI test points (inside the outline around them, within the 0.5 % tolerance). No test was necessarily run at that exact condition, other axes are checked one at a time so that exact combination may never have been tested, and PYRION computes no value there. It does not mean flammability behaves the same there: combustion can change abruptly near limits, so coverage is evidence, not a prediction or a safety assessment.
        </p>
      </div>

      <figure className="card figure-card">
        <HullDiagram />
        <figcaption>Schematic, not data. The live chart on the Envelope page draws the same shapes from PSI records.</figcaption>
      </figure>

      <div className="prose">
        <h2 data-help="method-verdicts">The four verdicts</h2>
        <table className="vtable">
          <thead>
            <tr>
              <th scope="col">Verdict</th>
              <th scope="col">Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span className="badge v-app"><StatusSymbol level="normal" /> APPLICABLE</span></td>
              <td>Same regime, and the target is inside the measured envelope.</td>
            </tr>
            <tr>
              <td><span className="badge v-ext"><StatusSymbol level="caution" /> EXTRAPOLATION</span></td>
              <td>Same regime, but the target is outside the measured envelope.</td>
            </tr>
            <tr>
              <td><span className="badge v-ins"><StatusSymbol level="standby" /> INSUFFICIENT_EVIDENCE</span></td>
              <td>The extracted records do not state enough (a regime axis, or O₂ / pressure) to compare. PYRION does not guess.</td>
            </tr>
            <tr>
              <td><span className="badge v-bar"><StatusSymbol level="off" /> REGIME_BARRIER</span></td>
              <td>Different physical regime: not comparable. Not a low score.</td>
            </tr>
          </tbody>
        </table>

        <h2 data-help="method-ranking">Ranking</h2>
        <p>
          Within a regime, investigations are ordered by the normalized distance from the target to the nearest measured
          point. The order is condition similarity on the axes you set, not scientific relevance or importance for fire
          safety. Across a regime barrier there is no ranking. A barrier means not directly applicable, not irrelevant: the
          challenge statement notes that microgravity and normal-gravity results could bound what occurs at intermediate
          gravity levels. The same records and the same target always give the same verdicts and the same order.
        </p>

        <h2 data-help="method-receipt">The receipt</h2>
        <p>
          Every number in a verdict links to its source: the investigation DOI and PSI version, the file, the row and column
          or the page and quoted sentence, the original text and unit, and the conversion applied.
        </p>

        <h2 data-help="method-checks">What the checks cover, and what they do not</h2>
        <ul>
          <li>Automated gates on every change: schema, provenance (file checksums), cell trace, unit recomputation, physical bounds, consistency, citations, and banned public claims.</li>
          <li>Milestone reviews by a separate process that did not write the records, with a fixed round limit. Values still in doubt are marked insufficient evidence.</li>
          <li>This is not a review by NASA and not a validation by combustion experts. Values are extracted from the NASA files and located in them by code; the Envelope page says how many were located.</li>
        </ul>

        <h2 data-help="method-llm">What an LLM does here</h2>
        <p>
          No language model decides a verdict: the engine is plain TypeScript rules over the extracted records, and the verdict
          lines on the page are written by code. When a model is configured, it does two small things in the question box: it
          copies the quantities your question states (with their units) into a target, which code checks against your question and
          the engine converts; and it may add a short description of that target. That description is kept only sentence by
          sentence, and only where a code check finds nothing but the target&apos;s own numbers, units and words; anything else is dropped.
          Without a key the page works the same, in structured mode. AI tools were also used to build the project; the repository
          README lists the AI tools used to build the project and what each did.
        </p>

        <p>
          <Link data-help="method-back" href="/">Back to the envelope</Link> · <Link data-help="method-data" href="/data">See the data coverage</Link>
        </p>
      </div>
    </main>
  );
}
