"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PRESETS } from "@/lib/presets";
import { layerColor, regimeLongName, regimeName, sameRegime } from "@/lib/layers";
import type { EnvelopeStatus } from "@/lib/summary";
import { ATM_KPA, fmt, kPa, pctO2, psia } from "@/lib/units";
import type { EnvelopeLayer, EnvelopePoint, Target } from "@/lib/types";

interface Props {
  layers: EnvelopeLayer[];
  target: Target;
  targetLabel: string;
  status: EnvelopeStatus;
  /** Accession hovered in the results list: its points are emphasized. */
  highlight: string | null;
  onPointSelect: (accession: string) => void;
}

const M = { top: 20, right: 20, bottom: 54, left: 66 };

function niceStep(span: number, count: number) {
  const raw = span / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}
function ticks(min: number, max: number, count: number) {
  const s = niceStep(max - min, count);
  const out: number[] = [];
  for (let v = Math.ceil(min / s - 1e-9) * s; v <= max + 1e-9; v += s) out.push(Number(v.toFixed(10)));
  return out;
}

function Marker({ phase, x, y, color, r = 4.5 }: { phase: string; x: number; y: number; color: string; r?: number }) {
  const common = { fill: color, stroke: "var(--surface)", strokeWidth: 2, paintOrder: "stroke" as const };
  if (phase === "solid") {
    const s = r * 1.8;
    return <rect x={x - s / 2} y={y - s / 2} width={s} height={s} rx={1.5} {...common} />;
  }
  if (phase === "gas") {
    const h = r * 1.15;
    return <path d={`M${x} ${y - h * 1.25}L${x + h * 1.15} ${y + h * 0.8}L${x - h * 1.15} ${y + h * 0.8}Z`} strokeLinejoin="round" {...common} />;
  }
  return <circle cx={x} cy={y} r={r} {...common} />;
}

/** Small inline glyph for the legend, matching the plot marker. */
function Glyph({ phase, color }: { phase: string; color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <Marker phase={phase} x={7} y={7.5} color={color} r={4} />
    </svg>
  );
}

interface Hover {
  layer: EnvelopeLayer;
  point: EnvelopePoint;
  x: number;
  y: number;
}

export default function EnvelopeChart({ layers, target, targetLabel, status, highlight, onPointSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [hover, setHover] = useState<Hover | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = Math.round(Math.min(520, Math.max(340, width * 0.6)));
  const iw = width - M.left - M.right;
  const ih = height - M.top - M.bottom;

  // Domain: measured points and every preset, so presets never rescale the chart;
  // a custom target outside it extends the domain.
  const domain = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const l of layers) for (const p of l.points) {
      xs.push(p.o2);
      ys.push(p.pressure);
    }
    for (const p of PRESETS) {
      xs.push(p.target.o2_mole_fraction);
      ys.push(p.target.pressure);
    }
    xs.push(target.o2_mole_fraction);
    ys.push(target.pressure);
    const x0 = Math.max(0, Math.floor((Math.min(...xs) - 0.03) / 0.05) * 0.05);
    const x1 = Math.min(1, Math.ceil((Math.max(...xs) + 0.03) / 0.05) * 0.05);
    const yMaxRaw = Math.max(...ys) * 1.08;
    const ys1 = niceStep(yMaxRaw, 6);
    const y1 = Math.ceil(yMaxRaw / ys1) * ys1;
    return { x0, x1, y0: 0, y1 };
  }, [layers, target.o2_mole_fraction, target.pressure]);

  const sx = (v: number) => ((v - domain.x0) / (domain.x1 - domain.x0)) * iw;
  const sy = (v: number) => ih - ((v - domain.y0) / (domain.y1 - domain.y0)) * ih;

  const xTicks = ticks(domain.x0, domain.x1, Math.max(4, Math.floor(iw / 90)));
  const yTicks = ticks(domain.y0, domain.y1, Math.max(4, Math.floor(ih / 60)));

  const matchKey = layers.find((l) => sameRegime(l.regime, target))?.key ?? null;
  const tx = sx(target.o2_mole_fraction);
  const ty = sy(target.pressure);
  const calloutLeft = tx > iw * 0.58;

  const totalPoints = layers.reduce((n, l) => n + l.points.length, 0);
  const desc = `Scatter of ${totalPoints} measured test points, O₂ mole fraction against pressure, with one convex hull per regime combination (${layers
    .map((l) => regimeLongName(l.regime))
    .join("; ")}). Target ${targetLabel}: ${pctO2(target.o2_mole_fraction)}, ${kPa(target.pressure)}, ${regimeLongName(target)}. ${status.headline}. ${status.detail}`;

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <figure className="chart">
      <div className="legend" role="group" aria-label="Regime layers (click to show or hide)">
        {layers.map((l, i) => {
          const on = !hidden.has(l.key);
          return (
            <button
              key={l.key}
              type="button"
              className={`chip${l.key === matchKey ? " chip-match" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(l.key)}
              title={`${regimeLongName(l.regime)}: ${l.points.length} test points from ${l.accessions.length} investigation(s)`}
            >
              <Glyph phase={l.regime.fuel_phase} color={layerColor(i)} />
              <span>{regimeName(l.regime)}</span>
              <span className="chip-n">{l.points.length}</span>
            </button>
          );
        })}
        <span className="chip chip-static" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="5" fill="none" stroke="var(--ink)" strokeWidth="2" />
            <circle cx="7" cy="7" r="1.6" fill="var(--ink)" />
          </svg>
          <span>Target</span>
        </span>
      </div>

      <div className="plot-wrap" ref={wrapRef} style={{ height }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby="env-title env-desc"
          className="plot"
        >
          <title id="env-title">Evidence envelope: O₂ mole fraction vs pressure</title>
          <desc id="env-desc">{desc}</desc>
          <g transform={`translate(${M.left},${M.top})`}>
            {/* grid */}
            {yTicks.map((v) => (
              <line key={`gy${v}`} x1={0} x2={iw} y1={sy(v)} y2={sy(v)} className="grid" />
            ))}
            {xTicks.map((v) => (
              <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={0} y2={ih} className="grid" />
            ))}

            {/* reference: sea-level air */}
            {domain.y1 > ATM_KPA && (
              <g className="ref">
                <line x1={0} x2={iw} y1={sy(ATM_KPA)} y2={sy(ATM_KPA)} />
                <text x={iw - 4} y={sy(ATM_KPA) - 6} textAnchor="end">
                  1 atm
                </text>
              </g>
            )}
            {domain.x0 < 0.2095 && domain.x1 > 0.2095 && (
              <g className="ref">
                <line x1={sx(0.2095)} x2={sx(0.2095)} y1={0} y2={ih} />
                <text x={sx(0.2095) + 5} y={12}>
                  air
                </text>
              </g>
            )}

            {/* hulls */}
            {layers.map((l, i) => {
              if (hidden.has(l.key)) return null;
              const color = layerColor(i);
              const dim = matchKey !== l.key;
              const cls = `layer${dim ? " dim" : ""}`;
              const pts = l.hull.map(([o, p]) => [sx(o), sy(p)] as const);
              if (pts.length >= 3) {
                const d = `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;
                return (
                  <g key={`h${l.key}`} className={cls}>
                    <path d={d} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={2} strokeLinejoin="round" />
                  </g>
                );
              }
              if (pts.length === 2) {
                const [[x1, y1], [x2, y2]] = pts;
                return (
                  <g key={`h${l.key}`} className={cls}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeOpacity={0.14} strokeWidth={18} strokeLinecap="round" />
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} strokeLinecap="round" />
                  </g>
                );
              }
              if (pts.length === 1) {
                return (
                  <g key={`h${l.key}`} className={cls}>
                    <circle cx={pts[0][0]} cy={pts[0][1]} r={12} fill={color} fillOpacity={0.14} />
                  </g>
                );
              }
              return null;
            })}

            {/* points */}
            {layers.map((l, i) => {
              if (hidden.has(l.key)) return null;
              const color = layerColor(i);
              const dim = matchKey !== l.key;
              return (
                <g key={`p${l.key}`} className={`layer${dim ? " dim" : ""}`}>
                  {l.points.map((p) => {
                    const x = sx(p.o2);
                    const y = sy(p.pressure);
                    const hl = highlight !== null && p.accession === highlight;
                    const faded = highlight !== null && !hl;
                    return (
                      <g key={`${p.accession}|${p.test_id}`} className={faded ? "faded" : hl ? "hl" : undefined}>
                        <Marker phase={l.regime.fuel_phase} x={x} y={y} color={color} r={hl ? 6 : 4.5} />
                        <circle
                          cx={x}
                          cy={y}
                          r={11}
                          className="hit"
                          onPointerEnter={() => setHover({ layer: l, point: p, x, y })}
                          onPointerLeave={() => setHover((h) => (h?.point === p ? null : h))}
                          onClick={() => onPointSelect(p.accession)}
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* direct label on the comparable layer */}
            {matchKey &&
              !hidden.has(matchKey) &&
              (() => {
                const l = layers.find((x) => x.key === matchKey)!;
                const top = l.hull.reduce((a, b) => (b[1] > a[1] ? b : a), l.hull[0]);
                if (!top) return null;
                return (
                  <text x={sx(top[0])} y={sy(top[1]) - 12} textAnchor="middle" className="layer-label">
                    {regimeName(l.regime)}
                  </text>
                );
              })()}

            {/* target */}
            <g className="target-guides" aria-hidden="true">
              <line x1={0} x2={0} y1={0} y2={ih} style={{ transform: `translateX(${tx}px)` }} />
              <line x1={0} x2={iw} y1={0} y2={0} style={{ transform: `translateY(${ty}px)` }} />
            </g>
            <g className="target" style={{ transform: `translate(${tx}px, ${ty}px)` }} aria-hidden="true">
              <circle r={16} className="target-halo" />
              <circle r={10} className="target-ring" />
              <circle r={3} className="target-dot" />
              <line x1={-17} x2={-12} y1={0} y2={0} className="target-tick" />
              <line x1={12} x2={17} y1={0} y2={0} className="target-tick" />
              <line x1={0} x2={0} y1={-17} y2={-12} className="target-tick" />
              <line x1={0} x2={0} y1={12} y2={17} className="target-tick" />
            </g>

            {/* axes */}
            <line x1={0} x2={iw} y1={ih} y2={ih} className="axis" />
            <line x1={0} x2={0} y1={0} y2={ih} className="axis" />
            {xTicks.map((v) => (
              <text key={`tx${v}`} x={sx(v)} y={ih + 18} textAnchor="middle" className="tick">
                {fmt(v * 100, 0)}%
              </text>
            ))}
            {yTicks.map((v) => (
              <text key={`ty${v}`} x={-10} y={sy(v) + 4} textAnchor="end" className="tick">
                {fmt(v, 0)}
              </text>
            ))}
            <text x={iw / 2} y={ih + 42} textAnchor="middle" className="axis-title">
              O₂ mole fraction
            </text>
            <text transform={`translate(${-50},${ih / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">
              Pressure (kPa)
            </text>
          </g>
        </svg>

        {/* callout that travels with the target */}
        <div
          className={`callout callout-${status.tone}${calloutLeft ? " callout-left" : ""}`}
          style={{ transform: `translate(${M.left + tx}px, ${M.top + ty}px)` }}
          aria-live="polite"
        >
          <div className="callout-inner">
            <div className="callout-label">{targetLabel}</div>
            <div className="callout-head">
              <span className="callout-icon" aria-hidden="true">
                {status.tone === "inside" ? "✓" : status.tone === "outside" ? "↗" : "?"}
              </span>
              {status.headline}
            </div>
          </div>
        </div>

        {hover && (
          <div
            className="tooltip"
            style={{
              left: Math.min(M.left + hover.x + 14, width - 230),
              top: Math.max(4, M.top + hover.y - 12),
            }}
            role="status"
          >
            <div className="tt-title">
              {hover.point.accession} · test {hover.point.test_id}
            </div>
            <div>O₂ {pctO2(hover.point.o2)}</div>
            <div>
              {kPa(hover.point.pressure)} <span className="muted">({psia(hover.point.pressure)})</span>
            </div>
            <div className="muted">{regimeLongName(hover.layer.regime)}</div>
            <div className="tt-hint">Click: open its receipt</div>
          </div>
        )}
      </div>

      <figcaption className="chart-caption">
        <p className={`status status-${status.tone}`}>
          <strong>{status.headline}.</strong> {status.detail}
        </p>
        <p className="muted small">
          Each shaded area is the convex hull of measured test points for one regime: gravity regime · fuel phase · diluent.
          Regimes are barriers: a hull from another regime is shown faded and is never used for comparison.
        </p>
      </figcaption>

      <details className="table-view">
        <summary>Data table ({totalPoints} measured points)</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Regime</th>
                <th scope="col">Investigation</th>
                <th scope="col">Test</th>
                <th scope="col" className="num">O₂ (%)</th>
                <th scope="col" className="num">Pressure (kPa)</th>
              </tr>
            </thead>
            <tbody>
              {layers.flatMap((l) =>
                l.points.map((p) => (
                  <tr key={`${l.key}|${p.accession}|${p.test_id}`}>
                    <td>{regimeName(l.regime)}</td>
                    <td>
                      <button type="button" className="linklike" onClick={() => onPointSelect(p.accession)}>
                        {p.accession}
                      </button>
                    </td>
                    <td>{p.test_id}</td>
                    <td className="num">{fmt(p.o2 * 100, 2)}</td>
                    <td className="num">{fmt(p.pressure, 2)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
