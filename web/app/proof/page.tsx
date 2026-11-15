import type { Metadata } from "next";
import { GITHUB, loadProof } from "@/lib/proof";
import { slug } from "@/lib/proof";
import "../bridge.css";

export const metadata: Metadata = {
  title: "Proof · PYRION Ω",
  description: "One screen of evidence of rigor: every number here is read from a file of the repository when the site is built.",
};

const n = (x: number) => x.toLocaleString("en-US");
const Src = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a data-help="proof-source-link" href={href} target="_blank" rel="noreferrer">
    {children}
  </a>
);

export default async function ProofPage() {
  const p = await loadProof();
  return (
    <main className="page bridge">
      <header className="hero br-hero">
        <h1 data-help="page-proof">Proof: how PYRION is checked</h1>
      </header>
      <section className="card br-card">
        <p>
          Claims are cheap. This page shows the checks behind PYRION and where to verify them yourself. <strong>Every number below is read from a file of the repository when this site is built; none is typed in.</strong> Each item
          says what it means in plain words first, then links to the file for experts.
        </p>
      </section>

      <section className="card br-card" aria-labelledby="pf-battery">
        <h2 id="pf-battery">Questions we threw at it</h2>
        {p.battery ? (
          <>
            <p>
              A scripted &quot;judge battery&quot; asks the app {n(p.battery.questions)} questions, including {n(p.battery.traps)} traps (a gauge pressure, an oxygen partial pressure given as total pressure, harmful requests) that it must refuse or
              handle correctly. The latest run recorded <strong>{p.battery.failures === null ? "an unreadable failure count" : `${n(p.battery.failures)} failure${p.battery.failures === 1 ? "" : "s"}`}</strong>
              {p.battery.startedAt ? `, started ${p.battery.startedAt.replace("T", " ").slice(0, 16)} UTC` : ""}.
            </p>
            <p className="small muted">
              Result file: <Src href={`${GITHUB}/validation/judge_battery/results/${p.battery.file}`}>{p.battery.file}</Src>. Questions: <Src href={`${GITHUB}/validation/judge_battery/questions.json`}>questions.json</Src>.
            </p>
          </>
        ) : (
          <p className="muted">The battery results are not available in this build.</p>
        )}
      </section>

      <section className="card br-card" aria-labelledby="pf-located">
        <h2 id="pf-located">Every value is found in the NASA source, by code</h2>
        {p.validation ? (
          <>
            <p>
              PYRION extracted <strong>{n(p.validation.records)}</strong> records into the files (the engine uses the ones its validator does not reject; see /data). A validator then looks each one up in the source file: <strong>{n(p.validation.cells)}</strong> table cells at their row and column and{" "}
              <strong>{n(p.validation.quotes)}</strong> quotations word for word, across {n(p.validation.textFiles)} text files. A value it cannot find is rejected.
              {!p.validation.traceRan && " (The last report was written without the source trace; the numbers above are from the last full one.)"}
            </p>
            <p className="small muted">
              Report generated {p.validation.generatedAt.replace("T", " ").slice(0, 16)} UTC: <Src href={`${GITHUB}/validation/reports/latest.md`}>latest.md</Src> · <Src href={`${GITHUB}/validation/reports/latest.json`}>latest.json</Src> ·{" "}
              <Src href={`${GITHUB}/validation/run_all.py`}>run_all.py</Src>
            </p>
          </>
        ) : (
          <p className="muted">The validation report is not available in this build.</p>
        )}
      </section>

      <section className="card br-card" aria-labelledby="pf-sev">
        <h2 id="pf-sev">What the validator found wrong</h2>
        {p.validation ? (
          <p>
            Findings are graded. <strong>{n(p.validation.blocker)} blocker{p.validation.blocker === 1 ? "" : "s"}</strong> (would invalidate a result), <strong>{n(p.validation.major)} major</strong> and {n(p.validation.minor)} minor (wording or notes). The minor ones are
            listed openly in the report rather than hidden.
          </p>
        ) : (
          <p className="muted">Not available in this build.</p>
        )}
      </section>

      <section className="card br-card" aria-labelledby="pf-audits">
        <h2 id="pf-audits">Reviews by separate AI reviewer agents</h2>
        <p>Separate AI reviewer agents, run apart from the sessions that wrote the code, attacked the language-model layer in rounds. They are not NASA review or expert validation. Each round lists what they found and how it was closed. Sections of the audit report:</p>
        {p.audits.length > 0 ? (
          <ul>
            {p.audits.map((a) => (
              <li key={a.anchor}>
                <Src href={`${GITHUB}/validation/reports/phase1-llm-audit.md#${a.anchor}`}>{a.title}</Src>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">The audit report is not available in this build.</p>
        )}
      </section>

      <section className="card br-card" aria-labelledby="pf-tests">
        <h2 id="pf-tests">Automated tests</h2>
        {p.tests ? (
          <p>
            The engine has <strong>{n(p.tests.engine)}</strong> declared test cases and the web app <strong>{n(p.tests.web)}</strong>, counted from the test files. They cover units, regimes, the four verdicts, determinism and the safety checks. Counting declarations
            is not the same as running them: they run before every push.{" "}
            <Src href={`${GITHUB}/engine/test`}>engine/test</Src> · <Src href={`${GITHUB}/web/test`}>web/test</Src>
          </p>
        ) : (
          <p className="muted">Not available in this build.</p>
        )}
      </section>

      <section className="card br-card" aria-labelledby="pf-sealed">
        <h2 id="pf-sealed">Predictions sealed before the experiment</h2>
        {p.sealed ? (
          <>
            <p>
              Before FM2 has flown (it is a planned experiment), PYRION wrote down what it will and will not say about it and recorded the fingerprint (SHA-256) of that text.{" "}
              {p.sealed.height !== null ? (
                <>
                  The fingerprint is anchored in the Bitcoin blockchain at <strong>block {n(p.sealed.height)}</strong>, read from the proof file itself.
                </>
              ) : (
                <>The proof file exists but the Bitcoin confirmation is still pending.</>
              )}{" "}
              Anyone can check it without trusting GitHub or us:
            </p>
            <pre className="small">
              <code>{"git clone https://github.com/Lucyyngceo/pyrion\ncd pyrion/predictions\nots verify SHA256SUMS.ots"}</code>
            </pre>
            <p className="small muted">
              <Src href={`${GITHUB}/predictions/README.md`}>predictions/README.md</Src> · <Src href={`${GITHUB}/predictions/SHA256SUMS`}>SHA256SUMS</Src> · <Src href={`${GITHUB}/predictions/SHA256SUMS.ots`}>SHA256SUMS.ots</Src> · tool:{" "}
              <Src href="https://opentimestamps.org">opentimestamps.org</Src>
            </p>
          </>
        ) : (
          <p className="muted">The sealed predictions are not available in this build.</p>
        )}
      </section>

      <section className="card br-card" aria-labelledby="pf-stamps">
        <h2 id="pf-stamps">The code existed when we say it did</h2>
        <p>Git dates can be edited, so the repository state is also stamped with OpenTimestamps from time to time. Each stamp records a commit and a time:</p>
        {p.stamps.length > 0 ? (
          <ul>
            {p.stamps.map((s) => (
              <li key={s.file}>
                <Src href={`${GITHUB}/provenance/${s.file}`}>{s.file}</Src>: commit {s.commit?.slice(0, 10) ?? "?"}, {s.utc ?? "?"}
                {s.height !== null ? `, anchored in Bitcoin block ${n(s.height)}` : ", Bitcoin confirmation pending"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No provenance stamps in this build.</p>
        )}
      </section>

      <section className="card br-card" aria-labelledby="pf-ai">
        <h2 id="pf-ai">How AI was used</h2>
        {p.ai ? (
          <p>
            The full declaration of the AI tools used to build PYRION, and what each did, is in the project README under &quot;{p.ai.heading}&quot;. Every AI-assisted commit names the model in a Co-Authored-By line, so the trail is in git.{" "}
            <Src href={`${GITHUB}/README.md#${slug(p.ai.heading)}`}>Read the declaration</Src>
          </p>
        ) : (
          <p className="muted">Not available in this build.</p>
        )}
      </section>
    </main>
  );
}
