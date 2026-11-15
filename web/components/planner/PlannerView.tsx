"use client";

import { useEffect, useRef, useState } from "react";
import AskTars from "@/components/AskTars";
import type { PlannerData } from "@/lib/planner/data";

type Cell = [number, number, 0 | 1];
type Phase = "solid" | "liquid" | "gas";
interface Pt {
  o2: number;
  pressure: number;
}
interface Designed {
  gain: { baseFraction: number; withFraction: number; cellsGained: number; gainPerTest: number; hullAreaFraction: number; tests: number; note: string };
  cells: Cell[];
  fraction: number;
  flag: string;
  shape: string;
}

const KPA_PER_PSI = 6.894757;
const pct = (x: number) => `${Math.round(x * 1000) / 10} %`;
const W = 640;
const H = 380;
const M = { l: 124, r: 16, t: 14, b: 44 };
const X0 = 0.24;
const X1 = 0.36;
const Y0 = 52;
const Y1 = 74;
const sx = (o2: number) => M.l + ((o2 - X0) / (X1 - X0)) * (W - M.l - M.r);
const sy = (p: number) => H - M.b - ((p - Y0) / (Y1 - Y0)) * (H - M.t - M.b);
const ox = (px: number) => X0 + ((px - M.l) / (W - M.l - M.r)) * (X1 - X0);
const oy = (py: number) => Y0 + ((H - M.b - py) / (H - M.t - M.b)) * (Y1 - Y0);

const LEVEL_TONE = ["none", "low", "mid", "mid", "high"];

export default function PlannerView({ data }: { data: PlannerData }) {
  const [showFm2, setShowFm2] = useState(false);
  const [showFm2o, setShowFm2o] = useState(false);
  const [showLuci, setShowLuci] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [pts, setPts] = useState<Pt[]>([]);
  const [phase, setPhase] = useState<Phase>("solid");
  const [designed, setDesigned] = useState<Designed | null>(null);
  const [derr, setDerr] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);

  const fm2 = data.experiments.find((e) => e.id === "fm2") ?? data.experiments[0];
  const fm2o = data.experiments.find((e) => e.id === "fm2-with-tolerance-bounds") ?? data.experiments[1];
  const luci = data.experiments.find((e) => e.id === "luci") ?? data.experiments[2];
  const cells: Cell[] = designed && pts.length > 0 ? designed.cells : showFm2o ? data.layers.fm2o.cells : showFm2 ? data.layers.fm2.cells : data.coverage.cells;
  const fraction = designed && pts.length > 0 ? designed.fraction : showFm2o ? data.layers.fm2o.fraction : showFm2 ? data.layers.fm2.fraction : data.coverage.fraction;
  const cellW = (W - M.l - M.r) / 8;
  const cellH = (H - M.t - M.b) / 8;

  // Live coverage for the designer (the engine decides; this only asks).
  useEffect(() => {
    if (pts.length === 0) {
      setDesigned(null);
      setDerr(null);
      return;
    }
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      fetch("/api/planner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points: pts, fuelPhase: phase }), signal: ctl.signal })
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? "the request failed");
          setDesigned(j as Designed);
          setDerr(null);
        })
        .catch((e) => e.name !== "AbortError" && setDerr(e instanceof Error ? e.message : "the request failed"));
    }, 250);
    return () => {
      ctl.abort();
      window.clearTimeout(t);
    };
  }, [pts, phase]);

  const toPt = (e: { clientX: number; clientY: number }): Pt | null => {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return null;
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    const o2 = Math.min(X1, Math.max(X0, ox(px)));
    const pressure = Math.min(Y1, Math.max(Y0, oy(py)));
    return { o2: Math.round(o2 * 1000) / 1000, pressure: Math.round(pressure * 10) / 10 };
  };

  const poly = data.band.vertices.filter((v) => !v.edge).map((v) => `${sx(v.o2)},${sy(v.kpa)}`).join(" ");
  const v = hover !== null ? data.band.vertices[hover] : null;
  const askQ = `Explain the Mission Planner for the Moon Base band: PSI covers ${pct(data.coverage.fraction)} of it; FM2 as planned covers ${pct(data.layers.fm2.fraction)} (a line); with tolerance ${pct(data.layers.fm2o.fraction)}. What does that mean?`;
  const layerNote = showFm2o ? `FM2 optimistic ±0.3 psi: ${pct(data.layers.fm2o.fraction)} (optimistic, planned, not in PSI)` : showFm2 ? `FM2 as planned: ${pct(data.layers.fm2.fraction)} of the grid cells, ${data.layers.fm2.covered} of ${data.layers.fm2.total} (planned, not in PSI)` : null;

  return (
    <>
      <p data-help="planner-label" className="tars-label" role="note">
        {data.label}.
      </p>

      <section className="card" aria-labelledby="pl-chart">
        <h2 id="pl-chart">The Moon Base band</h2>
        <p data-help="planner-coverage" className="lede">
          <strong>{pct(data.coverage.fraction)} of the band lies inside the region spanned by PSI test points.</strong> ({data.coverage.covered} of {data.coverage.total} grid cells, partial gravity {data.band.gravityLevel} g.){" "}
          <span data-help="planner-erl-badge" className="chip" title={data.erl.atCentre.reason}>
            ERL {data.erl.atCentre.level} · {data.erl.atCentre.name}
          </span>{" "}
          <AskTars q={askQ} />
        </p>
        {data.coverage.fraction === 0 && (
          <p data-help="planner-zero-expected" className="small">
            The 0 % is expected, not a finding: this page counts only tests run at the band&apos;s gravity, and NASA&apos;s
            challenge statement says there is currently no partial-gravity combustion data in PSI, so 0 % follows by
            construction. What this page adds is below: what FM2 as planned would measure, which corners of the band
            stay unmeasured, and the nearest PSI evidence, which is in microgravity or normal gravity (open the{" "}
            <a data-help="planner-zero-expected" href="/?preset=challenge-lunar-base">Envelope with the Moon Base condition</a>).
          </p>
        )}
        <p data-help="planner-honesty" className="honesty">
          Covered means the condition lies between measured PSI test points (inside the outline around them, within the 0.5 % tolerance). No test was necessarily run at that exact condition, other axes are checked one at a time so that exact combination may never have been tested, and PYRION computes no value there. It does not mean flammability behaves the same there: combustion can change abruptly near limits, so coverage is evidence, not a prediction or a safety assessment.
        </p>
        <div className="pl-controls" role="group" aria-label="Layers">
          <label className="small">
            <input data-help="planner-layer-fm2" type="checkbox" checked={showFm2} onChange={(e) => { setShowFm2(e.target.checked); if (e.target.checked) setShowFm2o(false); }} /> FM2 as planned (a line, planned, not in PSI)
          </label>
          <label className="small">
            <input data-help="planner-layer-fm2o" type="checkbox" checked={showFm2o} onChange={(e) => { setShowFm2o(e.target.checked); if (e.target.checked) setShowFm2(false); }} /> FM2 optimistic ±0.3 psi
          </label>
          <label className="small">
            <input data-help="planner-layer-luci" type="checkbox" checked={showLuci} onChange={(e) => setShowLuci(e.target.checked)} /> LUCI
          </label>
        </div>
        {layerNote && <p className="small">{layerNote}</p>}
        {showLuci && (
          <p className="small" role="note">
            LUCI cannot be placed: pressure not stated in its source. {luci.reason}
          </p>
        )}
        <svg
          data-help="planner-chart"
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="pl-chart"
          role="img"
          aria-label={`Oxygen against total pressure. The Moon Base band, ${pct(fraction)} covered. Click to add a hypothetical test point.`}
          onPointerDown={(e) => {
            const target = e.target as Element;
            const idx = target.getAttribute("data-pt");
            if (idx !== null) {
              drag.current = Number(idx);
              (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
              return;
            }
            if (pts.length >= 20) return;
            const p = toPt(e);
            if (p) setPts((a) => [...a, p]);
          }}
          onPointerMove={(e) => {
            if (drag.current === null) return;
            const p = toPt(e);
            if (p) setPts((a) => a.map((x, i) => (i === drag.current ? p : x)));
          }}
          onPointerUp={() => (drag.current = null)}
        >
          {Array.from({ length: 5 }, (_, i) => X0 + (i * (X1 - X0)) / 4).map((o) => (
            <g key={o}>
              <line x1={sx(o)} x2={sx(o)} y1={M.t} y2={H - M.b} className="pl-grid" />
              <text x={sx(o)} y={H - M.b + 16} textAnchor="middle" className="pl-tick">{Math.round(o * 1000) / 10} %</text>
            </g>
          ))}
          {Array.from({ length: 5 }, (_, i) => Y0 + (i * (Y1 - Y0)) / 4).map((p) => (
            <g key={p}>
              <line x1={M.l} x2={W - M.r} y1={sy(p)} y2={sy(p)} className="pl-grid" />
              <text x={M.l - 6} y={sy(p) + 4} textAnchor="end" className="pl-tick">{Math.round(p * 10) / 10} kPa ({Math.round((p / KPA_PER_PSI) * 10) / 10} psia)</text>
            </g>
          ))}
          <text x={(W + M.l) / 2} y={H - 6} textAnchor="middle" className="pl-axis">Oxygen (mole fraction, %)</text>
          {cells.map(([o, p, c], i) => (
            <rect key={i} x={sx(o) - cellW / 2} y={sy(p) - cellH / 2} width={cellW} height={cellH} className={c ? "pl-cell pl-cell-on" : "pl-cell"} aria-hidden="true" />
          ))}
          <polygon points={poly} className="pl-band" />
          {(showFm2 || showFm2o) && (showFm2o ? fm2o : fm2).points.map((p, i) => <path key={`f${i}`} d={`M ${sx(p.o2_mole_fraction)} ${sy(p.pressure_kpa) - 6} l 6 6 l -6 6 l -6 -6 z`} className="pl-fm2" aria-hidden="true" />)}
          {pts.map((p, i) => (
            <g key={`m${i}`}>
              <circle data-pt={i} cx={sx(p.o2)} cy={sy(p.pressure)} r={7} className="pl-mine" />
              <text x={sx(p.o2) + 10} y={sy(p.pressure) - 8} className="pl-tick">{i + 1}</text>
            </g>
          ))}
          {data.band.vertices.map((vx, i) => (
            <g key={i} tabIndex={0} role="img" aria-label={`${vx.label}: ${vx.sourced ? "sourced" : "PYRION closing convention, not stated by any source"}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onPointerDown={(e) => e.stopPropagation()}>
              <circle cx={sx(vx.o2)} cy={sy(vx.kpa)} r={8} className={vx.sourced ? "pl-v pl-v-src" : "pl-v pl-v-conv"} />
            </g>
          ))}
        </svg>
        <div data-help="planner-vertex-detail" className="small pl-detail" aria-live="polite">
          {v ? (
            <>
              <strong>{v.label}</strong> · {Math.round(v.o2 * 1000) / 10} % O2, {Math.round(v.psia * 10) / 10} psia ({Math.round(v.kpa * 10) / 10} kPa).{" "}
              {v.sourced && v.source ? (
                <>Source: {v.source.title}: <q>{v.source.quote}</q> (as written: {v.asWritten}).</>
              ) : (
                <>PYRION closing convention: not stated by any source. {v.asWritten}.</>
              )}
            </>
          ) : (
            <span className="muted">Hover or focus a vertex to see its source. Filled = stated by a source; hollow = a closing corner chosen by PYRION. Click the plot to add a hypothetical test point.</span>
          )}
        </div>
        <p className="small muted">{data.band.convention}</p>
      </section>

      <section className="card" aria-labelledby="pl-min">
        <h2 id="pl-min">Minimum test points (PYRION&apos;s geometric convention)</h2>
        <p data-help="planner-min-set" className="small">
          The fewest test points whose outline covers the band under PYRION&apos;s convention: not a test programme. It holds for
          one material, flow velocity and sample thickness at a time; repeats and flammability thresholds are not included.{" "}
          {data.minimumTest.points.length} points (the corners of the band). {data.minimumTest.fm2Contributes.length} are already contributed by FM2 as planned; {data.minimumTest.missing.length} are missing{data.minimumTest.missing.length > 0 ? `: ${data.minimumTest.missing.map((m) => `${Math.round(m.o2_mole_fraction * 1000) / 10} % at ${Math.round((m.pressure_kpa / KPA_PER_PSI) * 10) / 10} psia`).join("; ")}` : ""}.
        </p>
        <div className="tars-cmptable">
          <table>
            <thead>
              <tr>
                <th>Corner</th>
                <th>O₂</th>
                <th>Pressure</th>
                <th>Stated by</th>
                <th>Covered by</th>
              </tr>
            </thead>
            <tbody>
              {data.minimumTest.points.map((p) => (
                <tr key={p.vertex}>
                  <td>{p.vertex}</td>
                  <td>{Math.round(p.o2_mole_fraction * 1000) / 10} %</td>
                  <td>{Math.round((p.pressure_kpa / KPA_PER_PSI) * 10) / 10} psia</td>
                  <td>{p.sourced ? "a source" : "PYRION convention"}</td>
                  <td>{p.coveredBy.length ? p.coveredBy.join(", ") : <strong>missing</strong>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">{data.minimumTest.rule}</p>
        <h3 data-help="planner-rank">Coverage gained per test</h3>
        <div className="tars-cmptable">
          <table>
            <thead>
              <tr>
                <th>Experiment</th>
                <th>Tests</th>
                <th>Shape</th>
                <th>Coverage</th>
                <th>Cells gained</th>
                <th>Gain per test</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {data.rank.map((g) => (
                <tr key={g.experiment}>
                  <td>{g.experiment}</td>
                  <td>{g.tests}</td>
                  <td>{g.placeable ? g.shape : "cannot be placed"}</td>
                  <td>{pct(g.baseFraction)} → {pct(g.withFraction)}</td>
                  <td>{g.cellsGained}</td>
                  <td>{Math.round(g.gainPerTest * 100) / 100}</td>
                  <td className="small">{g.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">Planned experiments are hypothetical: {fm2.flag}</p>
      </section>

      <section className="card" aria-labelledby="pl-design">
        <h2 id="pl-design">Design your experiment</h2>
        <p data-help="planner-design" className="tars-label" role="note">
          Hypothetical — not a measurement. Click the plot above to add test points (drag a point to move it); the engine recomputes the coverage.
        </p>
        <label className="small" htmlFor="pl-phase">
          Fuel phase{" "}
        </label>
        <select data-help="planner-phase" id="pl-phase" value={phase} onChange={(e) => setPhase(e.target.value as Phase)}>
          <option value="solid">solid</option>
          <option value="liquid">liquid</option>
          <option value="gas">gas</option>
        </select>{" "}
        <button data-help="planner-clear" type="button" className="chip" disabled={pts.length === 0} onClick={() => setPts([])}>
          Clear points
        </button>
        {derr && <p className="tars-err" role="alert">{derr}</p>}
        {pts.length === 0 ? (
          <p className="small muted">No points yet.</p>
        ) : (
          <ul className="small">
            {pts.map((p, i) => (
              <li key={i}>
                {i + 1}. {Math.round(p.o2 * 1000) / 10} % O2, {Math.round((p.pressure / KPA_PER_PSI) * 10) / 10} psia ({phase}){" "}
                <button data-help="planner-remove-point" type="button" className="linklike" onClick={() => setPts((a) => a.filter((_, j) => j !== i))}>
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {designed && pts.length > 0 && (
          <p data-help="planner-design-result" className="small" role="status">
            Hypothetical coverage with your {designed.gain.tests} point{designed.gain.tests === 1 ? "" : "s"}: {pct(designed.gain.baseFraction)} → <strong>{pct(designed.gain.withFraction)}</strong> ({designed.gain.cellsGained} cells gained, {Math.round(designed.gain.gainPerTest * 100) / 100} per test; shape: {designed.shape}; hull area {pct(designed.gain.hullAreaFraction)} of the band). {designed.flag}
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="pl-report">
        <h2 id="pl-report">Gap report</h2>
        <p className="small">
          <a data-help="planner-report-html" href="/api/planner/report" target="_blank" rel="noreferrer">
            Open the print view (save as PDF)
          </a>{" · "}
          <a data-help="planner-report-md" href="/api/planner/report?format=md">
            Download .md
          </a>
        </p>
        <p data-help="planner-fingerprint" className="small muted">
          Fingerprint (SHA-256 of the report data, {data.engine.name} {data.engine.version}): <code>{data.fingerprint}</code>
        </p>
      </section>

      <section className="card" aria-labelledby="pl-erl">
        <h2 id="pl-erl">Evidence readiness (ERL) by habitat and fuel phase</h2>
        <p data-help="planner-erl-note" className="small muted">{data.erl.note}</p>
        <div data-help="planner-erl-board" className="tars-cmptable">
          <table>
            <thead>
              <tr>
                <th>Habitat</th>
                {(["solid", "liquid", "gas"] as Phase[]).map((p) => (
                  <th key={p}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...new Set(data.habitats.map((h) => h.label))].map((label) => (
                <tr key={label}>
                  <td>{label}</td>
                  {(["solid", "liquid", "gas"] as Phase[]).map((p) => {
                    const id = data.habitats.find((h) => h.label === label && h.id.endsWith(`|${p}`))!.id;
                    const c = data.erl.board.cells.find((x) => x.habitat === id && x.material === null);
                    return (
                      <td key={p} title={c?.reason}>
                        {c ? <span className={`tars-badge tars-badge-${LEVEL_TONE[c.level]}`}>ERL {c.level} · {c.name}</span> : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td>Spacesuit</td>
                <td colSpan={3} className="small muted">Outside PSI: no investigation in the extracted records concerns a suit atmosphere, so it is not evaluated here.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul data-help="planner-erl-scale" className="small muted">
          {data.erl.scale.map((s) => (
            <li key={s.level}>ERL {s.level} · {s.name}: {s.means}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
