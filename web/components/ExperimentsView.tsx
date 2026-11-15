"use client";

import { EXPERIMENT_LABEL, type ExperimentsNeeded } from "@/lib/engine";
import { fmt, kpaToPsi } from "@/lib/units";

const where = (file: string, page: number | null | undefined) => `${file}${page ? `, p. ${page}` : ""}`;

/** "What would close this gap": the engine's experiments-needed plan, rendered whole. Used by the TARS skill and by the scenario tiles. */
export default function ExperimentsView({ ex, fingerprint, detailed = true }: { ex: ExperimentsNeeded; fingerprint?: string; detailed?: boolean }) {
  const hasMargin = ex.testMatrix.points.some((p) => p.marginPoint);
  return (
    <div className="tars-answer tars-exp">
      <p className="tars-label">{EXPERIMENT_LABEL}</p>

      <section className="tars-block">
        <h4>The gap</h4>
        <p>{ex.gap.sentence}</p>
        {detailed && ex.gap.detail.length > 0 && <p className="small muted">{ex.gap.detail.join(" ")}</p>}
      </section>

      <section className="tars-block">
        <h4>Test matrix ({ex.testMatrix.pointCount} points)</h4>
        <p>{ex.testMatrix.sentence}</p>
        {ex.testMatrix.points.length > 0 && (
          <div className="table-scroll">
            <table className="tars-matrix">
              <thead>
                <tr>
                  <th scope="col">Oxygen (%)</th>
                  <th scope="col">Pressure (kPa · psia)</th>
                  <th scope="col">Point</th>
                </tr>
              </thead>
              <tbody>
                {ex.testMatrix.points.map((p, i) => (
                  <tr key={i} className={p.isTarget ? "mx-target" : p.marginPoint ? "mx-margin" : undefined}>
                    <td className="num">{p.o2_mole_fraction !== undefined ? fmt(p.o2_mole_fraction * 100, 1) : "—"}</td>
                    <td className="num">{p.pressure_kpa !== undefined ? `${fmt(p.pressure_kpa, 1)} · ${fmt(kpaToPsi(p.pressure_kpa), 2)}` : "—"}</td>
                    <td>{p.isTarget ? "target" : p.marginPoint ? "margin point" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasMargin && <p className="small muted">Margin points: the oxygen partial pressure (oxygen × pressure) is higher than the target&apos;s.</p>}
        {detailed && <p className="small muted">{ex.testMatrix.note}</p>}
      </section>

      {ex.additionalAxes.length > 0 && (
        <section className="tars-block">
          <h4>Other axes to set</h4>
          <ul className="small">
            {ex.additionalAxes.map((a) => (
              <li key={a.axis}>
                <strong>{a.label}.</strong> {a.sentence}
                {a.options?.map((o) => (
                  <span key={`${o.value}${o.source}`} className="tars-opt" title={o.quote ? `${o.source}: “${o.quote}”` : o.source}>
                    {" "}
                    [{o.value} {o.unit}: {o.source}]
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tars-block">
        <h4>Measurements</h4>
        <p>{ex.measurements.sentence}</p>
        <ul className="small">
          {ex.measurements.testingMeasures.map((m) => (
            <li key={m.measure} title={where(m.file, m.page)}>
              {m.measure}: <q>{m.quote}</q>
              {m.qualifier ? ` [${m.qualifier}]` : ""}
            </li>
          ))}
        </ul>
        <p className="small muted">
          Standard:{" "}
          <a href={ex.measurements.standard.url} target="_blank" rel="noreferrer">
            {ex.measurements.standard.title}
          </a>{" "}
          ({ex.measurements.standard.note})
        </p>
      </section>

      <section className="tars-block">
        <h4>Solids first</h4>
        <p>{ex.solidsRationale.sentence}</p>
        <ul className="small">
          {ex.solidsRationale.sources.map((s) => (
            <li key={s.measure} title={where(s.file, s.page)}>
              {s.measure}: <q>{s.quote}</q>
              {s.qualifier ? ` [${s.qualifier}]` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="tars-block">
        <h4>What NASA&apos;s planned experiments cover</h4>
        <ul className="small">
          {ex.plannedCoverage.sources.map((s) => (
            <li key={s.id} title={where(s.file, s.page)}>
              <strong>{s.name}</strong>
              {s.qualifier ? ` [${s.qualifier}]` : ""}: <q>{s.quote}</q>
            </li>
          ))}
        </ul>
        {ex.plannedCoverage.statements.map((s) => (
          <p key={s.source} className="small">
            <strong>{s.source}</strong> ({s.material}): {s.sentence}
          </p>
        ))}
      </section>

      <section className="tars-block">
        <h4>Remaining gap</h4>
        <p>{ex.remainingGap.sentence}</p>
      </section>

      <section className="tars-block">
        <h4>Priority</h4>
        <ol>
          {ex.priority.map((p) => (
            <li key={p.rank}>{p.sentence}</li>
          ))}
        </ol>
      </section>

      {fingerprint && (
        <p className="tars-fp small muted">
          Engine fingerprint (SHA-256): <code>{fingerprint}</code>
        </p>
      )}
    </div>
  );
}
