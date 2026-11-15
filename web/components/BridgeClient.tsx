"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Fm2Panel from "./Fm2Panel";
import {
  DENSITY_FACTOR_PMMA_AIR,
  GRAVITY_TARGETS,
  TRANSFER_LIMITS,
  parseCsv,
  transferHypotheses,
  transferTestsFromFlowSteps,
  withGravity,
  type Target,
  type TransferHypothesis,
} from "@/lib/engine";
import { fmt } from "@/lib/units";

const STOPS = [
  { id: "micro", short: "Microgravity", sub: "0 g", g: 0 },
  { id: "moon", short: "Moon", sub: "0.165 g", g: 0.165 },
  { id: "mars", short: "Mars", sub: "1/3 g", g: 1 / 3 },
  { id: "earth", short: "Earth", sub: "1 g", g: 1 },
] as const;

const M = { top: 34, right: 18, bottom: 48, left: 58 };
const key = (h: { accession: string; test_id: string }) => `${h.accession}|${h.test_id}`;

const LIMIT_COLS = ["limit_type", "last_stable_flow_cm_s", "extinction_flow_cm_s", "interpretation_status"];

type Rod = "rod_tip" | "cylinder";

interface Props {
  csv: string | null;
  gravitySource: { file: string; location: string; quote: string; status: string } | null;
}

const band = (b: { lo: number; hi: number }) => (b.lo === b.hi ? fmt(b.lo, 1) : `${fmt(b.lo, 1)} to ${fmt(b.hi, 1)}`);

export default function BridgeClient({ csv, gravitySource }: Props) {
  const id = useId();
  const [stop, setStop] = useState(1);
  const [rod, setRod] = useState<Rod>("rod_tip");
  const [selected, setSelected] = useState<string | null>(null);
  // The PSI table labels rods "clear rod" / "black rod"; NASA states they are cast PMMA (NTRS 20150008961, p. 1).
  const opts = useMemo(() => ({ densityFactor: { lo: DENSITY_FACTOR_PMMA_AIR.lo, hi: DENSITY_FACTOR_PMMA_AIR.hi } }), []);

  const parsed = useMemo(
    () => (csv ? transferTestsFromFlowSteps(csv, { gravityRegime: gravitySource ? "microgravity" : undefined, rodFormula: rod }) : { tests: [], skipped: [] }),
    [csv, gravitySource, rod],
  );

  // Optional interpreted columns of the derived table: read only if present.
  const extras = useMemo(() => {
    const m = new Map<string, Record<string, string>>();
    if (!csv) return m;
    const rows = parseCsv(csv);
    if (rows.length === 0) return m;
    const h = rows[0].cells.map((x) => x.trim());
    const col = (n: string) => h.indexOf(n);
    const cols = h.filter((c) => c === "flow_min_with_flame" || c === "ended_in_extinction" || LIMIT_COLS.includes(c) || /limit/i.test(c));
    for (const r of rows.slice(1)) {
      const o: Record<string, string> = {};
      for (const c of cols) {
        const v = (r.cells[col(c)] ?? "").trim();
        if (v !== "") o[c] = v;
      }
      m.set(`${(r.cells[col("accession")] ?? "").trim()}|${(r.cells[col("test_id")] ?? "").trim()}`, o);
    }
    return m;
  }, [csv]);

  const hasLimits = [...extras.values()].some((e) => e.interpretation_status === "verified" && (e.limit_type === "quench" || e.limit_type === "blowoff"));
  const g = STOPS[stop];
  const target: Target = useMemo(
    () => (stop === 0 ? { regime: { gravity_regime: "microgravity" }, continuous: {} } : withGravity({ regime: {}, continuous: {} }, g.id as "moon" | "mars" | "earth")),
    [stop, g.id],
  );
  const stopTarget = stop > 0 ? GRAVITY_TARGETS[g.id as "moon" | "mars" | "earth"] : null;

  // Stretch of each test does not depend on gravity: take it from any target; the band comes from the selected one.
  const base = useMemo(() => transferHypotheses(withGravity({ regime: {}, continuous: {} }, "moon"), parsed.tests, opts), [parsed.tests, opts]);
  const report = useMemo(() => transferHypotheses(target, parsed.tests, opts), [target, parsed.tests, opts]);
  const rel = useMemo(() => new Map(report.hypotheses.map((h) => [key(h), h])), [report]);

  const analogs = report.hypotheses.filter((h) => h.isAnalog);
  const partial = report.hypotheses.filter((h) => !h.isAnalog && h.relation === "overlap");
  const sel = selected ? (rel.get(selected) ?? base.hypotheses.find((h) => key(h) === selected)) : undefined;

  return (
    <>
      <header className="hero br-hero">
        <h1>Bridge: relating gravity levels through flame stretch rate</h1>
        <span className="hyp-tag" role="note">
          HYPOTHESIS — NOT EVIDENCE
        </span>
      </header>

      <section className="card br-card" aria-labelledby="br-intro">
        <h2 id="br-intro" className="sr-only">
          Why this page exists
        </h2>
        <p>
          In PYRION, gravity is a <strong>regime barrier</strong>: a microgravity test and a lunar-gravity target are not
          comparable, and the verdict says so. NASA&apos;s own literature relates gravity levels through the{" "}
          <strong>flame stretch rate</strong>. Olson &amp; T&apos;ien write that the effect of partial gravity{" "}
          <q>such as those found on the Moon (1/6 g) or Mars (1/3 g) on material flammability can be examined at Earth&apos;s gravity
          through equivalence of flame stretch rates</q>{" "}
          (<a href="https://ntrs.nasa.gov/citations/20000004509" target="_blank" rel="noreferrer">NTRS 20000004509</a>, <em>Combustion and
          Flame</em> 121(3), 2000, p. 3). This page uses that idea to point at the PSI tests whose stretch rate is closest. It
          does not change any verdict, and nothing here is a prediction of flame behavior on the Moon.
        </p>
      </section>

      <section className="card br-card" aria-labelledby="dial-h">
        <div className="card-head">
          <h2 id="dial-h">Gravity dial</h2>
          <p className="muted small">One control for everything below. Four stops, not a continuous scale.</p>
        </div>
        <div className="dial">
          <input
            type="range"
            min={0}
            max={STOPS.length - 1}
            step={1}
            value={stop}
            aria-label="Gravity stop"
            aria-valuetext={`${g.short}, ${g.sub}`}
            list={`${id}-stops`}
            onChange={(e) => setStop(Number(e.target.value))}
          />
          <datalist id={`${id}-stops`}>
            {STOPS.map((s, i) => (
              <option key={s.id} value={i} label={s.short} />
            ))}
          </datalist>
          <ol className="dial-stops">
            {STOPS.map((s, i) => (
              <li key={s.id}>
                <button type="button" tabIndex={-1} className={i === stop ? "on" : ""} onClick={() => setStop(i)} aria-label={`${s.short}, ${s.sub}`}>
                  <span className="dial-name">{s.short}</span>
                  <span className="dial-sub">{s.sub}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <p className="muted small">
          {stopTarget ? (
            <>
              Gravity level {fmt(stopTarget.level, 3)} g. {"file" in stopTarget.source ? <>Source: <q>{stopTarget.source.quote}</q> ({stopTarget.source.file.split("/")[0]}, p. {stopTarget.source.page}).</> : stopTarget.source.note}
            </>
          ) : (
            "Microgravity: PSI tests are directly comparable here, so there is nothing to transfer."
          )}
        </p>
      </section>

      <section className="card br-card" aria-labelledby="map-h">
        <div className="card-head">
          <h2 id="map-h">Stretch map</h2>
          <p className="muted small">
            Stretch rate (s⁻¹, log scale) against ambient O₂. Solid lines: the forced stretch of PSI BASS-II PMMA rod tests, from
            each test&apos;s flow readings and rod radius. Hatched magenta band: the <em>hypothesised</em> buoyant stretch at the
            selected gravity, one band per rod radius.
          </p>
        </div>

        <div className="br-controls">
          <fieldset className="seg" aria-label="Forced-stretch formula for rods">
            <button type="button" aria-pressed={rod === "rod_tip"} onClick={() => setRod("rod_tip")}>
              Rod tip, 3/2 U/R
            </button>
            <button type="button" aria-pressed={rod === "cylinder"} onClick={() => setRod("cylinder")}>
              Cylinder, 2 U/R
            </button>
          </fieldset>
        </div>
        <p className="muted small">
          The PSI table itself labels these rods only &quot;clear rod&quot; and &quot;black rod&quot;. NASA states what they are: <q>Microgravity experiments burning cast PMMA
          cylindrical rods in axial flow have been conducted aboard the International Space Station</q> <q>as part of the BASS-II experiment</q> (
          <a href="https://ntrs.nasa.gov/citations/20150008961" target="_blank" rel="noreferrer">NTRS 20150008961</a>, Olson &amp; Ferkul, p. 1). So the PMMA-in-air
          density factor applies (T* 865–990 K, Olson &amp; T&apos;ien), and axial flow is why the rod-tip formula is the default. The table does not say how each individual rod sat in the flow, so the formula stays a choice, shown with every result.
        </p>

        {!csv && <p className="banner">data/derived/bass2_flow_steps.csv was not found, so no stretch map can be drawn.</p>}
        {csv && !gravitySource && (
          <p className="banner">No PSI-25 record states the gravity regime of BASS-II; without it the engine excludes every test.</p>
        )}

        <StretchMap
          hyps={base.hypotheses}
          rel={rel}
          extras={extras}
          rodK={rod === "rod_tip" ? 1.5 : 2}
          g={g}
          selected={selected}
          onSelect={setSelected}
        />

        <div className="map-legend small" aria-hidden="true">
          <span>
            <i className="lg lg-line" /> PSI test, forced stretch (flow readings)
          </span>
          <span>
            <i className="lg lg-an" /> transfer analog: stretch inside the band
          </span>
          <span>
            <i className="lg lg-part" /> only partly overlaps the band
          </span>
          <span>
            <i className="lg lg-band" /> hypothesised buoyant stretch band
          </span>
          {hasLimits && (
            <span>
              <i className="lg-tri" /> limit read from the test notes (interpreted, verified): ▽ quench, △ blowoff
            </span>
          )}
        </div>

        {report.notComputable && <p className="status">{report.notComputable}</p>}
        {!report.notComputable && (
          <p className="status">
            <strong>
              {analogs.length} transfer {analogs.length === 1 ? "analog" : "analogs"}
            </strong>{" "}
            at {g.short} ({g.sub}); {partial.length} more only partly overlap the band. Analogs are hypotheses: they are never
            counted as APPLICABLE.
          </p>
        )}
        <p className="muted small">
          {base.hypotheses.length} of {parsed.tests.length + parsed.skipped.length} BASS-II tests in the derived table have a stated
          rod radius and a parsed flow. The others are not guessed (films and sheets have no radius; some flow cells are ambiguous).
        </p>

        {sel && <Receipt h={sel} rel={rel.get(key(sel))} extras={extras.get(key(sel))} onClose={() => setSelected(null)} gravitySource={gravitySource} />}

        {analogs.length > 0 && (
          <div className="analogs">
            <h3 className="br-h3">Transfer analogs at {g.short}</h3>
            <ul>
              {analogs.map((h) => (
                <li key={key(h)}>
                  <button type="button" className="linklike" onClick={() => setSelected(key(h))}>
                    {h.accession} {h.test_id}
                  </button>{" "}
                  <span className="muted">
                    {h.material}: stretch {band(h.testStretch.value)} s⁻¹ inside {band(h.targetStretch.value)} s⁻¹ · O₂{" "}
                    {h.atmosphere.o2_mole_fraction.test !== null ? `${fmt(h.atmosphere.o2_mole_fraction.test * 100, 1)} %` : "not stated"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {partial.length > 0 && (
          <details className="analogs partials">
            <summary>
              {partial.length} test{partial.length === 1 ? "" : "s"} whose flow sweep only passes through the band at {g.short}
            </summary>
            <p className="muted small">
              Their stretch rate falls inside the band for part of the flow readings and outside for the rest: not analogs by the
              engine&apos;s rule (the whole range must lie inside), shown so nothing is hidden.
            </p>
            <ul>
              {partial.map((h) => (
                <li key={key(h)}>
                  <button type="button" className="linklike" onClick={() => setSelected(key(h))}>
                    {h.accession} {h.test_id}
                  </button>{" "}
                  <span className="muted">
                    {h.material}: stretch {band(h.testStretch.value)} s⁻¹, band {band(h.targetStretch.value)} s⁻¹
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card br-card limits" aria-labelledby="lim-h">
        <h2 id="lim-h">Limits</h2>
        <ul>
          {TRANSFER_LIMITS.map((l) => {
            const [head, ...rest] = l.split(". ");
            return (
              <li key={l}>
                <strong>{head}.</strong> {rest.join(". ")}
              </li>
            );
          })}
        </ul>
      </section>

      <Fm2Panel />
    </>
  );
}

// ------------------------------------------------------------------ map

function StretchMap({
  hyps,
  rel,
  extras,
  rodK,
  g,
  selected,
  onSelect,
}: {
  hyps: TransferHypothesis[];
  rel: Map<string, TransferHypothesis>;
  extras: Map<string, Record<string, string>>;
  rodK: number;
  g: (typeof STOPS)[number];
  selected: string | null;
  onSelect: (k: string | null) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(820);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const h = Math.round(Math.max(300, Math.min(420, w * 0.46)));
  const iw = w - M.left - M.right;
  const ih = h - M.top - M.bottom;

  const bands = useMemo(() => {
    const m = new Map<number, { lo: number; hi: number }>();
    for (const x of rel.values()) m.set(x.targetStretch.inputs.R.value.lo, x.targetStretch.value);
    return [...m.entries()].toSorted((a, b) => a[0] - b[0]);
  }, [rel]);

  const dom = useMemo(() => {
    const v: number[] = [];
    for (const x of hyps) {
      if (x.testStretch.value.lo > 0) v.push(x.testStretch.value.lo);
      if (x.testStretch.value.hi > 0) v.push(x.testStretch.value.hi);
    }
    for (const [, b] of bands) if (b.lo > 0) v.push(b.lo, b.hi);
    const lo = 10 ** Math.floor(Math.log10(Math.min(...v, 1)) - 0.05);
    const hi = 10 ** Math.ceil(Math.log10(Math.max(...v, 10)) + 0.05);
    const o = hyps.map((x) => (x.atmosphere.o2_mole_fraction.test ?? 0.21) * 100);
    return { x0: lo, x1: hi, y0: Math.floor((Math.min(...o, 20) - 2) / 5) * 5, y1: Math.ceil((Math.max(...o, 30) + 2) / 5) * 5 };
  }, [hyps, bands]);

  const lx0 = Math.log10(dom.x0);
  const lx1 = Math.log10(dom.x1);
  const sx = (v: number) => ((Math.log10(Math.max(v, dom.x0)) - lx0) / (lx1 - lx0)) * iw;
  const sy = (v: number) => ih - ((v - dom.y0) / (dom.y1 - dom.y0)) * ih;
  const xt: number[] = [];
  for (let e = Math.ceil(lx0); e <= lx1; e++) for (const m of [1, 2, 5]) if (10 ** e * m >= dom.x0 && 10 ** e * m <= dom.x1) xt.push(10 ** e * m);
  const yt: number[] = [];
  for (let v = dom.y0; v <= dom.y1; v += 5) yt.push(v);

  return (
    <div className="map-wrap" ref={wrap} style={{ height: h }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-labelledby="sm-t sm-d" className="plot stretch-map">
        <title id="sm-t">Stretch map: stretch rate against ambient O₂</title>
        <desc id="sm-d">
          {hyps.length} PSI BASS-II PMMA rod tests as horizontal segments over their forced stretch range. At {g.short} ({g.sub}), a hatched
          band per rod radius marks the hypothesised buoyant stretch. Hypothesis, not evidence.
        </desc>
        <defs>
          <pattern id="br-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--neon-2)" strokeWidth="1.4" strokeOpacity="0.55" />
          </pattern>
        </defs>
        <g transform={`translate(${M.left},${M.top})`}>
          {yt.map((v) => (
            <line key={`y${v}`} x1={0} x2={iw} y1={sy(v)} y2={sy(v)} className="grid" />
          ))}
          {xt.map((v) => (
            <line key={`x${v}`} x1={sx(v)} x2={sx(v)} y1={0} y2={ih} className="grid" />
          ))}

          {bands.map(([r, b], i) => (
            <g key={r} className="tband">
              <rect x={sx(b.lo)} y={0} width={Math.max(2, sx(b.hi) - sx(b.lo))} height={ih} fill="url(#br-hatch)" stroke="var(--neon-2)" strokeDasharray="5 4" strokeWidth={1.25} />
              <text x={sx(b.lo) + 3} y={-6 - (i % 2) * 12} className="tband-lbl">
                R {fmt(r * 10, 2)} mm
              </text>
            </g>
          ))}

          {hyps.map((x) => {
            const k = key(x);
            const hh = rel.get(k);
            const y = sy((x.atmosphere.o2_mole_fraction.test ?? 0.21) * 100);
            const a = sx(x.testStretch.value.lo);
            const b = sx(x.testStretch.value.hi);
            const cls = hh?.isAnalog ? "tm tm-an" : hh?.relation === "overlap" ? "tm tm-part" : "tm";
            const fm = extras.get(k)?.flow_min_with_flame;
            const ex = extras.get(k);
            const limU = ex && ex.interpretation_status === "verified" && (ex.limit_type === "quench" || ex.limit_type === "blowoff") ? Number(ex.extinction_flow_cm_s) : NaN;
            const limX = limU > 0 ? sx((rodK * limU) / x.targetStretch.inputs.R.value.lo) : null;
            const fmV = fm !== undefined && Number(fm) > 0 ? sx((rodK * Number(fm)) / x.targetStretch.inputs.R.value.lo) : null;
            return (
              <g key={k} className={`${cls}${selected === k ? " tm-sel" : ""}`}>
                <line x1={a} x2={b} y1={y} y2={y} className="tm-line" />
                <circle cx={a} cy={y} r={3.5} className="tm-dot" />
                <circle cx={b} cy={y} r={3.5} className="tm-dot" />
                {limX !== null && (
                  <path
                    d={ex?.limit_type === "quench" ? `M${limX - 6} ${y - 7}h12l-6 12z` : `M${limX - 6} ${y + 7}h12l-6 -12z`}
                    className={`tm-lim tm-lim-${ex?.limit_type}`}
                  >
                    <title>{`${ex?.limit_type} limit read from the test notes: ${ex?.extinction_flow_cm_s} cm/s (interpreted, verified)`}</title>
                  </path>
                )}
                {fmV !== null && <path d={`M${fmV} ${y - 6}l4 6l-4 6l-4 -6z`} className="tm-fm" />}
                <rect x={a - 6} y={y - 9} width={Math.max(12, b - a + 12)} height={18} className="hit" tabIndex={0} role="button" aria-label={`${x.accession} ${x.test_id}, ${band(x.testStretch.value)} per second, O2 ${fmt((x.atmosphere.o2_mole_fraction.test ?? 0) * 100, 1)} percent`} onClick={() => onSelect(selected === k ? null : k)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(selected === k ? null : k))} />
              </g>
            );
          })}

          <line x1={0} x2={iw} y1={ih} y2={ih} className="axis" />
          <line x1={0} x2={0} y1={0} y2={ih} className="axis" />
          {xt.map((v) => (
            <text key={`tx${v}`} x={sx(v)} y={ih + 16} textAnchor="middle" className="tick">
              {v}
            </text>
          ))}
          {yt.map((v) => (
            <text key={`ty${v}`} x={-8} y={sy(v) + 4} textAnchor="end" className="tick">
              {v}%
            </text>
          ))}
          <text x={iw / 2} y={ih + 38} textAnchor="middle" className="axis-title">
            Stretch rate (s⁻¹, log scale)
          </text>
          <text transform={`translate(${-44},${ih / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">
            Ambient O₂ (initial)
          </text>
        </g>
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------ receipt

function Receipt({
  h,
  rel,
  extras,
  onClose,
  gravitySource,
}: {
  h: TransferHypothesis;
  rel: TransferHypothesis | undefined;
  extras: Record<string, string> | undefined;
  onClose: () => void;
  gravitySource: Props["gravitySource"];
}) {
  const x = rel ?? h;
  return (
    <div className="br-receipt" role="region" aria-label={`Receipt for ${h.accession} ${h.test_id}`}>
      <div className="br-rhead">
        <strong>
          {h.accession} · test {h.test_id}
        </strong>
        <span className="hyp-tag small-tag">HYPOTHESIS — NOT EVIDENCE</span>
        <button type="button" className="linklike small" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="small">
        {h.material}, geometry: {h.geometry === "rod_tip" ? "rod tip" : "cylinder"}. {h.geometryBasis}.
      </p>
      <p className="small">
        <strong>Stretch of the test (no gravity term):</strong> {band(h.testStretch.value)} s⁻¹ (<code>{h.testStretch.formulaId}</code>: {h.testStretch.formula}).
        {rel && rel.targetGravity.level > 0 && (
          <>
            {" "}
            <strong>Buoyant stretch band at {fmt(rel.targetGravity.level, 3)} g, same radius:</strong> {band(x.targetStretch.value)} s⁻¹ (<code>{x.targetStretch.formulaId}</code>: {x.targetStretch.formula}).{" "}
            <strong>{rel.isAnalog ? "Analog: inside the band." : rel.relation === "overlap" ? "Only partly overlaps the band." : "Outside the band."}</strong>
          </>
        )}
      </p>
      <details open className="receipt-box">
        <summary>Receipt: inputs, sources, limits</summary>
        <h4 className="br-h4">Condition records</h4>
        <ul className="small">
          {h.inputRecords.map((r) => (
            <li key={r.location}>
              <code className="path">{r.file}</code>, {r.location}. {r.note}
            </li>
          ))}
          {gravitySource && (
            <li>
              Gravity regime (microgravity): <code className="path">{gravitySource.file}</code>, {gravitySource.location}, {gravitySource.status}: <q>{gravitySource.quote}</q>
            </li>
          )}
          {extras && Object.keys(extras).length > 0 && (
            <li>
              Interpreted columns of the derived table:{" "}
              {Object.entries(extras)
                .map(([k, v]) => `${k} = ${v}`)
                .join("; ")}
              . <span className="muted">An interpretation by PYRION&apos;s parser, not stated by NASA.</span>
            </li>
          )}
        </ul>
        <h4 className="br-h4">Formula inputs</h4>
        <ul className="small">
          {Object.entries((rel ?? h).targetStretch === x.targetStretch && rel ? x.targetStretch.inputs : h.testStretch.inputs).map(([k, v]) => (
            <li key={k}>
              {k}: {band(v.value)} {v.unit}
            </li>
          ))}
        </ul>
        <h4 className="br-h4">Sources</h4>
        <ul className="small">
          {(rel ? rel.sources : h.testStretch.sources).map((s) => (
            <li key={s.file + s.page + s.quote}>
              {s.file.split("/")[0]}, p. {s.page}: <q>{s.quote}</q> <span className="muted">({s.supports})</span>
            </li>
          ))}
        </ul>
        <h4 className="br-h4">Assumptions</h4>
        <ul className="small">
          {x.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <h4 className="br-h4">Limits</h4>
        <ul className="small">
          {x.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
