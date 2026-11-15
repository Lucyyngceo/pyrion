"use client";

import Term from "./Term";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { EnvelopePoint, EvidenceMap, RegimeEnvelope } from "@/lib/engine";
import { envelopeLongName, envelopeName, fuelPhaseOf } from "@/lib/layers";
import type { EnvelopeStatus } from "@/lib/summary";
import StatusSymbol, { TONE_STATUS } from "./StatusSymbol";
import { levelPhrase } from "@/lib/plain";
import { ATM_KPA, axisLabel, fmt, kPa, kpaToPsi, pctO2, psia } from "@/lib/units";
import { NEVER_COMPARED } from "@/lib/engine";

export type LayerState = "match" | "open" | "dim";

export interface DomainSeed {
  o2: number[];
  pressure: number[];
}

interface Props {
  envelopes: RegimeEnvelope[];
  colors: Map<string, string>;
  /** Per layer, from the engine's cluster verdicts: comparable, undecided or across a barrier. */
  layerState: Map<string, LayerState>;
  target: { o2: number; pressure: number };
  targetLabel: string;
  /** Verdict tone of the target swept over pressure (O2 and regime fixed). */
  rail?: { pressure: number; tone: string }[];
  /** A second, pinned target drawn as a ghost marker for comparison. */
  pinned?: { o2: number; pressure: number; label: string; tone: string } | null;
  /** Points of a comparison (TARS "Compare atmospheres"), labelled; no verdict is drawn for them here. */
  overlay?: { o2: number; pressure: number; label: string }[] | null;
  status: EnvelopeStatus;
  /** Values the axes always include (presets), so switching presets never rescales the chart. */
  seed: DomainSeed;
  /** Accession hovered in the results list: its points are emphasized. */
  highlight: string | null;
  onPointSelect: (accession: string) => void;
  /** Click or drag on the plot to move the target (O2 mole fraction, kPa). */
  onTargetPick?: (o2: number, pressure: number) => void;
  /** Regime axes the target leaves open: the engine does not compare them. */
  openAxes: string[];
  /** The engine's evidence map for the selected regime: shaded under the chart. */
  evidence?: EvidenceMap | null;
  /** Changes with the regime selection: a new map fades in over 300 ms. */
  evidenceKey?: string;
  /** Full-screen view (state lives in the parent, which also draws the sidebar). */
  fs?: boolean;
  onToggleFs?: () => void;
  /** True while the view is zoomed: the parent then gives the arrow keys to the view (Alt+arrows move the target). */
  onZoomedChange?: (zoomed: boolean) => void;
}

const M0 = { top: 22, right: 34, bottom: 54, left: 66 };
const MAX_ZOOM = 40;
/** Evidence-map tones for extrapolation, by distance from the tested data. */
const EXTRA_TONE = {
  just_outside: "rgba(185, 139, 255, 0.40)",
  outside: "rgba(150, 105, 215, 0.25)",
  far_outside: "rgba(105, 80, 165, 0.15)",
} as const;
/** How far past the data a pan may go, as a fraction of the data window. */
const PAN_MARGIN = 0.1;

/** A window onto the O2-pressure plane. View state only: no engine call depends on it. */
interface Win {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Cabin view: the pressure band of every preset, with margin. */
const CABIN = { y0: 40, y1: 120 };

function niceStep(span: number, count: number) {
  const raw = span / Math.max(1, count);
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

function Marker({ phase, x, y, color, r = 4.5, hollow = false }: { phase: string; x: number; y: number; color: string; r?: number; hollow?: boolean }) {
  const common = hollow
    ? { fill: "var(--surface)", stroke: color, strokeWidth: 1.5 }
    : { fill: color, stroke: "var(--surface)", strokeWidth: 2, paintOrder: "stroke" as const };
  if (phase === "solid") {
    const s = r * 1.8;
    return <rect x={x - s / 2} y={y - s / 2} width={s} height={s} rx={1.5} {...common} />;
  }
  if (phase === "gas") {
    const h = r * 1.15;
    return <path d={`M${x} ${y - h * 1.25}L${x + h * 1.15} ${y + h * 0.8}L${x - h * 1.15} ${y + h * 0.8}Z`} strokeLinejoin="round" {...common} />;
  }
  if (phase === "liquid") return <circle cx={x} cy={y} r={r} {...common} />;
  const d = r * 1.3;
  return <path d={`M${x} ${y - d}L${x + d} ${y}L${x} ${y + d}L${x - d} ${y}Z`} strokeLinejoin="round" {...common} />;
}

function Glyph({ phase, color, hollow }: { phase: string; color: string; hollow: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <Marker phase={phase} x={7} y={7.5} color={color} r={4} hollow={hollow} />
    </svg>
  );
}

type Scale = (v: number) => number;

/** One convex hull (CCW, raw units) as SVG: polygon, capsule for 2 vertices, halo for 1. */
function hullShape(hull: readonly { o2_mole_fraction: number; pressure: number }[], color: string, complete: boolean, sx: Scale, sy: Scale, key: string) {
  const pts = hull.map((q) => [sx(q.o2_mole_fraction), sy(q.pressure)] as const);
  if (pts.length >= 3) {
    const d = `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`;
    return <path key={key} d={d} fill={color} fillOpacity={complete ? 0.12 : 0.06} stroke={color} strokeWidth={complete ? 1.75 : 1.25} strokeLinejoin="round" />;
  }
  if (pts.length === 2) {
    const [[x1, y1], [x2, y2]] = pts;
    return (
      <g key={key}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeOpacity={0.14} strokeWidth={16} strokeLinecap="round" />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      </g>
    );
  }
  if (pts.length === 1) return <circle key={key} cx={pts[0][0]} cy={pts[0][1]} r={11} fill={color} fillOpacity={0.14} />;
  return null;
}

/** Tests whose O2 or pressure is a range "lo..hi": the engine plots both ends; the chart joins them. */
function rangeSegments(points: readonly EnvelopePoint[]) {
  const byTest = new Map<string, EnvelopePoint[]>();
  for (const p of points) {
    if (!p.citations.some((c) => c.value.includes(".."))) continue;
    const k = `${p.accession}|${p.test_id}`;
    const list = byTest.get(k);
    if (list) list.push(p);
    else byTest.set(k, [p]);
  }
  const out: [EnvelopePoint, EnvelopePoint][] = [];
  for (const list of byTest.values()) {
    if (list.length < 2) continue;
    const sorted = list.toSorted((a, b) => a.o2_mole_fraction - b.o2_mole_fraction || a.pressure - b.pressure);
    out.push([sorted[0], sorted[sorted.length - 1]]);
  }
  return out;
}

interface Hover {
  env: RegimeEnvelope;
  point: EnvelopePoint;
  x: number;
  y: number;
}



/** The data table: rows are drawn only while it is open, and never because the view moved. */
const PointTable = memo(function PointTable({ envelopes, selectRef }: { envelopes: RegimeEnvelope[]; selectRef: React.RefObject<(accession: string) => void> }) {
  const [open, setOpen] = useState(false);
  const total = envelopes.reduce((n, e) => n + e.points.length, 0);
  return (
    <details className="table-view" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary data-help="chart-data-table">Data table ({total} plotted points)</summary>
      {open && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Regime</th>
                <th scope="col">Investigation</th>
                <th scope="col">Test</th>
                <th scope="col" className="num">
                  O₂ (%)
                </th>
                <th scope="col" className="num">
                  Pressure (kPa)
                </th>
              </tr>
            </thead>
            <tbody>
              {envelopes.flatMap((e) =>
                e.points.map((p, i) => (
                  <tr key={`${e.key}|${i}`}>
                    <td>{envelopeName(e)}</td>
                    <td>
                      <button data-help="chart-table-receipt" type="button" className="linklike" onClick={() => selectRef.current?.(p.accession)}>
                        {p.accession}
                      </button>
                    </td>
                    <td>{p.test_id}</td>
                    <td className="num">{fmt(p.o2_mole_fraction * 100, 2)}</td>
                    <td className="num">{fmt(p.pressure, 2)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
});

type Setter = (w: Win | null) => void;

/** Keeps the same object while the numbers are equal, so memoized layers do not re-render for nothing. */
function useStableWin(w: Win): Win {
  const r = useRef(w);
  if (r.current.x0 !== w.x0 || r.current.x1 !== w.x1 || r.current.y0 !== w.y0 || r.current.y1 !== w.y1) r.current = w;
  return r.current;
}

/** A window that follows the live view during a gesture (own state: only this small layer re-renders per frame). */
function useLiveWin(domain: Win, setters: React.RefObject<Set<Setter>>): Win {
  const [ov, setOv] = useState<Win | null>(null);
  useEffect(() => {
    const set = setters.current;
    set.add(setOv);
    return () => {
      set.delete(setOv);
    };
  }, [setters]);
  return ov ?? domain;
}

/** Grid and reference lines (1 atm, air): below the data. */
const GridLayer = memo(function GridLayer({ domain, iw, ih, setters }: { domain: Win; iw: number; ih: number; setters: React.RefObject<Set<Setter>> }) {
  const d = useLiveWin(domain, setters);
  const sx = (v: number) => ((v - d.x0) / (d.x1 - d.x0)) * iw;
  const sy = (v: number) => ih - ((v - d.y0) / (d.y1 - d.y0)) * ih;
  const xTicks = ticks(d.x0, d.x1, Math.max(4, Math.floor(iw / 80)));
  const yTicks = ticks(d.y0, d.y1, Math.max(4, Math.floor(ih / 56)));
  return (
    <>
      {yTicks.map((v) => (
        <line data-help="chart-grid" key={`gy${v}`} x1={0} x2={iw} y1={sy(v)} y2={sy(v)} className="grid" />
      ))}
      {xTicks.map((v) => (
        <line data-help="chart-grid" key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={0} y2={ih} className="grid" />
      ))}
      {d.y0 < ATM_KPA && d.y1 > ATM_KPA && (
        <g className="ref">
          <line x1={0} x2={iw} y1={sy(ATM_KPA)} y2={sy(ATM_KPA)} />
          <text x={iw - 4} y={sy(ATM_KPA) - 6} textAnchor="end">
            1 atm
          </text>
        </g>
      )}
      {d.x0 < 0.2095 && d.x1 > 0.2095 && (
        <g className="ref">
          <line x1={sx(0.2095)} x2={sx(0.2095)} y1={0} y2={ih} />
          <text x={sx(0.2095) + 5} y={12}>
            air
          </text>
        </g>
      )}
    </>
  );
});

/** Ruler, axes, tick labels and titles: above the data. */
const TickLayer = memo(function TickLayer({ domain, iw, ih, showPsi, setters }: { domain: Win; iw: number; ih: number; showPsi: boolean; setters: React.RefObject<Set<Setter>> }) {
  const d = useLiveWin(domain, setters);
  const sx = (v: number) => ((v - d.x0) / (d.x1 - d.x0)) * iw;
  const sy = (v: number) => ih - ((v - d.y0) / (d.y1 - d.y0)) * ih;
  const xTicks = ticks(d.x0, d.x1, Math.max(4, Math.floor(iw / 80)));
  const yTicks = ticks(d.y0, d.y1, Math.max(4, Math.floor(ih / 56)));
  return (
    <>
      {/* instrument frame: minor ruler ticks on both axes and corner reticles */}
      <g data-help="chart-axes" className="ruler" aria-hidden="true">
        {xTicks.slice(0, -1).flatMap((v, k) => {
          const nx = xTicks[k + 1];
          return [1, 2, 3, 4].map((j) => {
            const x = sx(v + ((nx - v) * j) / 5);
            return <line key={`rx${k}-${j}`} x1={x} x2={x} y1={ih} y2={ih + 4} />;
          });
        })}
        {yTicks.slice(0, -1).flatMap((v, k) => {
          const ny = yTicks[k + 1];
          return [1, 2, 3, 4].map((j) => {
            const y = sy(v + ((ny - v) * j) / 5);
            return <line key={`ry${k}-${j}`} x1={-4} x2={0} y1={y} y2={y} />;
          });
        })}
        {xTicks.map((v) => (
          <line key={`mx${v}`} className="major" x1={sx(v)} x2={sx(v)} y1={ih} y2={ih + 8} />
        ))}
        {yTicks.map((v) => (
          <line key={`my${v}`} className="major" x1={-8} x2={0} y1={sy(v)} y2={sy(v)} />
        ))}
        {[
          [0, 0, 1, 1],
          [iw, 0, -1, 1],
          [0, ih, 1, -1],
          [iw, ih, -1, -1],
        ].map(([x, y, dx, dy], k) => (
          <path key={`c${k}`} className="reticle" d={`M${x + dx * 16},${y} L${x},${y} L${x},${y + dy * 16}`} />
        ))}
      </g>
      <line x1={0} x2={iw} y1={ih} y2={ih} className="axis" />
      <line x1={0} x2={0} y1={0} y2={ih} className="axis" />
      {xTicks.map((v) => (
        <text key={`tx${v}`} x={sx(v)} y={ih + 18} textAnchor="middle" className="tick">
          {fmt(v * 100, d.x1 - d.x0 < 0.1 ? 1 : 0)}%
        </text>
      ))}
      {yTicks.map((v) => (
        <text key={`ty${v}`} x={-10} y={sy(v) + 4} textAnchor="end" className="tick">
          {showPsi ? `${fmt(v, d.y1 - d.y0 < 20 ? 1 : 0)} (${fmt(kpaToPsi(v), 1)})` : fmt(v, 0)}
        </text>
      ))}
      <text x={iw / 2} y={ih + 42} textAnchor="middle" className="axis-title">
        Oxygen (% by volume)
      </text>
      <text transform={`translate(${showPsi ? -88 : -50},${ih / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">
        {showPsi ? "Pressure (kPa; psia in brackets)" : "Pressure (kPa)"}
      </text>
    </>
  );
});

interface Cursor {
  x: number;
  y: number;
}

/** Crosshair and readout. Own state, so moving the pointer never re-renders the chart. */
const CursorLayer = memo(function CursorLayer({ domain, iw, ih, cursors }: { domain: Win; iw: number; ih: number; cursors: React.RefObject<Set<(c: Cursor | null) => void>> }) {
  const [c, setC] = useState<Cursor | null>(null);
  useEffect(() => {
    const set = cursors.current;
    set.add(setC);
    return () => {
      set.delete(setC);
    };
  }, [cursors]);
  if (!c) return null;
  return (
    <g className="cursor" aria-hidden="true">
      <line x1={c.x} x2={c.x} y1={0} y2={ih} />
      <line x1={0} x2={iw} y1={c.y} y2={c.y} />
      <g transform={`translate(${c.x},${ih})`}>
        <rect x={-34} y={2} width={68} height={18} rx={4} className="cursor-tag" />
        <text y={15} textAnchor="middle" className="cursor-text">
          {fmt((domain.x0 + (c.x / iw) * (domain.x1 - domain.x0)) * 100, 1)} % O₂
        </text>
      </g>
      <g transform={`translate(0,${c.y})`}>
        <rect x={-64} y={-9} width={62} height={18} rx={4} className="cursor-tag" />
        <text x={-33} y={4} textAnchor="middle" className="cursor-text">
          {fmt(domain.y1 - (c.y / ih) * (domain.y1 - domain.y0), 1)} kPa
        </text>
      </g>
    </g>
  );
});

/** What is under the cursor: the evidence-map cell and which investigations apply there. */
const MapTip = memo(function MapTip({ domain, iw, ih, evidence, left, top, maxLeft, cursors }: { domain: Win; iw: number; ih: number; evidence: EvidenceMap | null | undefined; left: number; top: number; maxLeft: number; cursors: React.RefObject<Set<(c: Cursor | null) => void>> }) {
  const [c, setC] = useState<Cursor | null>(null);
  useEffect(() => {
    const set = cursors.current;
    set.add(setC);
    return () => {
      set.delete(setC);
    };
  }, [cursors]);
  if (!c || !evidence || evidence.o2Values.length < 2) return null;
  const o2 = domain.x0 + (c.x / iw) * (domain.x1 - domain.x0);
  const pr = domain.y1 - (c.y / ih) * (domain.y1 - domain.y0);
  const o = evidence.o2Values;
  const p = evidence.pressureValues;
  const j = Math.round(((o2 - o[0]) / (o[o.length - 1] - o[0])) * (o.length - 1));
  const i = Math.round(((pr - p[0]) / (p[p.length - 1] - p[0])) * (p.length - 1));
  if (j < 0 || j >= o.length || i < 0 || i >= p.length) return null;
  const cell = evidence.cells[i * o.length + j];
  return (
    <div data-help="chart-map-tip" className="map-tip" role="status" style={{ left: Math.min(left + c.x + 14, maxLeft), top: Math.max(4, top + c.y - 10) }}>
      {cell.applicable.length > 0 ? (
        <>
          <strong>
            {cell.applicable.length} investigation{cell.applicable.length === 1 ? "" : "s"} apply here:
          </strong>{" "}
          {cell.applicable.slice(0, 4).join(", ")}
          {cell.applicable.length > 4 ? ` and ${cell.applicable.length - 4} more` : ""}
        </>
      ) : cell.extrapolation.length > 0 ? (
        <>No investigation applies here; {cell.extrapolation.length} would need extrapolation{cell.extrapolationLevel ? ` (nearest: ${levelPhrase(cell.extrapolationLevel)})` : ""}.</>
      ) : (
        <>No investigation of this regime covers this point.</>
      )}
    </div>
  );
});

interface LayerProps {
  domain: Win;
  iw: number;
  ih: number;
  visible: RegimeEnvelope[];
  colors: Map<string, string>;
  layerState: Map<string, LayerState>;
  highlight: string | null;
  gapHulls: readonly (readonly { o2_mole_fraction: number; pressure: number }[])[];
  evidence: EvidenceMap | null | undefined;
  mapImage: string | null;
  evidenceKey?: string;
  hoverRef: React.RefObject<(e: RegimeEnvelope | null, p?: EnvelopePoint) => void>;
  selectRef: React.RefObject<(accession: string) => void>;
}

/** The heavy layers: evidence map, evidence gap, hulls and ~1000 points. They render only when data or the committed view changes. */
const PlotLayers = memo(function PlotLayers({ domain, iw, ih, visible, colors, layerState, highlight, gapHulls, evidence, mapImage, evidenceKey, hoverRef, selectRef }: LayerProps) {
  const sx = (v: number) => ((v - domain.x0) / (domain.x1 - domain.x0)) * iw;
  const sy = (v: number) => ih - ((v - domain.y0) / (domain.y1 - domain.y0)) * ih;
  const mapBox = (() => {
    if (!evidence || evidence.o2Values.length < 2 || evidence.pressureValues.length < 2) return null;
    const o = evidence.o2Values;
    const p = evidence.pressureValues;
    const dx = (o[o.length - 1] - o[0]) / (o.length - 1) / 2;
    const dp = (p[p.length - 1] - p[0]) / (p.length - 1) / 2;
    const x = sx(o[0] - dx);
    const y = sy(p[p.length - 1] + dp);
    return { x, y, w: sx(o[o.length - 1] + dx) - x, h: sy(p[0] - dp) - y };
  })();
  return (
    <>
      <defs>
        <pattern id="gap-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" className="gap-line" />
        </pattern>
        <mask id="gap-mask" maskUnits="userSpaceOnUse" x={-iw} y={-ih} width={iw * 3} height={ih * 3}>
          <rect x={-iw} y={-ih} width={iw * 3} height={ih * 3} fill="white" />
          {gapHulls.map((h, i) => {
            const pts = h.map((q) => [sx(q.o2_mole_fraction), sy(q.pressure)] as const);
            if (pts.length >= 3) return <path key={i} d={`M${pts.map(([x, y]) => `${x},${y}`).join("L")}Z`} fill="black" />;
            if (pts.length === 2) return <line key={i} x1={pts[0][0]} y1={pts[0][1]} x2={pts[1][0]} y2={pts[1][1]} stroke="black" strokeWidth={16} strokeLinecap="round" />;
            if (pts.length === 1) return <circle key={i} cx={pts[0][0]} cy={pts[0][1]} r={11} fill="black" />;
            return null;
          })}
        </mask>
      </defs>
      {mapImage && mapBox && (
        <image data-help="chart-map" key={evidenceKey} className="emap-img" href={mapImage} x={mapBox.x} y={mapBox.y} width={mapBox.w} height={mapBox.h} preserveAspectRatio="none" pointerEvents="none" aria-hidden="true" />
      )}
      {gapHulls.length > 0 && <rect x={-iw} y={-ih} width={iw * 3} height={ih * 3} fill="url(#gap-hatch)" mask="url(#gap-mask)" className="gap" aria-hidden="true" />}
      {/* decision hulls: one per investigation, the exact hull its verdict uses */}
      {visible.map((e) => {
        const color = colors.get(e.key) ?? "var(--s-other)";
        return (
          <g data-help="chart-hulls" key={`h${e.key}`} className={`layer reveal-hull em-${layerState.get(e.key) ?? "dim"}`} pointerEvents="none">
            {e.investigations.map((inv) => {
              const faded = highlight !== null && inv.accession !== highlight;
              return (
                <g key={inv.accession} className={faded ? "faded" : undefined}>
                  {hullShape(inv.hull, color, e.regimeComplete, sx, sy, inv.accession)}
                </g>
              );
            })}
            {rangeSegments(e.points).map(([a, b], i) => (
              <line key={`r${i}`} x1={sx(a.o2_mole_fraction)} y1={sy(a.pressure)} x2={sx(b.o2_mole_fraction)} y2={sy(b.pressure)} stroke={color} strokeWidth={2} strokeLinecap="round" className="range-seg" />
            ))}
          </g>
        );
      })}
      {/* points */}
      {visible.map((e, li) => {
        const color = colors.get(e.key) ?? "var(--s-other)";
        const phase = fuelPhaseOf(e);
        return (
          <g data-help="chart-points" key={`p${e.key}`} className={`layer reveal-pts em-${layerState.get(e.key) ?? "dim"}`} style={{ "--i": Math.min(li, 10) } as React.CSSProperties}>
            {e.points.map((p, i) => {
              const x = sx(p.o2_mole_fraction);
              const y = sy(p.pressure);
              const hl = highlight !== null && p.accession === highlight;
              const faded = highlight !== null && !hl;
              return (
                <g key={i} className={faded ? "faded" : undefined}>
                  <Marker phase={phase} x={x} y={y} color={color} r={hl ? 6 : 4.5} hollow={!e.regimeComplete} />
                  <circle data-help="chart-point"
                    cx={x}
                    cy={y}
                    r={9}
                    className="hit"
                    onPointerEnter={() => hoverRef.current?.(e, p)}
                    onPointerLeave={() => hoverRef.current?.(null)}
                    onClick={() => selectRef.current?.(p.accession)}
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
});

function EnvelopeChart({ envelopes, colors, layerState, target, targetLabel, status, seed, highlight, onPointSelect, onTargetPick, openAxes, pinned, overlay, rail, evidence, evidenceKey, fs = false, onToggleFs, onZoomedChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState<Win | null>(null);
  // The window the data layers are drawn in. A pan never changes it: the layers are only moved. A zoom re-draws them once, when the scale has drifted.
  const [renderWin, setRenderWin] = useState<Win | null>(null);
  const [commitTick, setCommitTick] = useState(0);
  const [boxH, setBoxH] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const figRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const liveGroups = useRef<(SVGGElement | null)[]>([null, null]);
  const setters = useRef(new Set<Setter>());
  const cursors = useRef(new Set<(c: Cursor | null) => void>());
  const [width, setWidth] = useState(780);
  const [viewportH, setViewportH] = useState(900);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [hover, setHover] = useState<Hover | null>(null);
  const [view, setView] = useState<"all" | "cabin">("cabin");
  // No marker animation until the real width is known, so nothing slides in on page load.
  const [measured, setMeasured] = useState(false);
  const selectRef = useRef(onPointSelect);
  selectRef.current = onPointSelect;
  const hoverRef = useRef<(e: RegimeEnvelope | null, p?: EnvelopePoint) => void>(() => {});
  hoverRef.current = (e, p) => setHover(e && p ? { env: e, point: p, x: sx(p.o2_mole_fraction), y: sy(p.pressure) } : null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    const onWin = () => setViewportH(window.innerHeight);
    onWin();
    window.addEventListener("resize", onWin, { passive: true });
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(320, Math.round(entry.contentRect.width)));
      setBoxH(Math.round(entry.contentRect.height));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => requestAnimationFrame(() => setMeasured(true)));
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", onWin);
    };
  }, []);

  // Zoomed or panned, or full screen: ticks also give psia, so the left margin is wider.
  const showPsi = fs || zoom !== null;
  const M = showPsi ? { ...M0, left: 104 } : M0;
  // Fits a laptop screen: never taller than ~60% of the window, so chart and target panel share the first view.
  const height = fs && boxH > 120 ? boxH : Math.round(Math.max(320, Math.min(540, width * 0.6, viewportH * 0.54)));
  const iw = width - M.left - M.right;
  const ih = height - M.top - M.bottom;

  const base = useMemo(() => {
    const xs = [...seed.o2, target.o2];
    const ys = [...seed.pressure, target.pressure];
    for (const e of envelopes) for (const p of e.points) {
      xs.push(p.o2_mole_fraction);
      ys.push(p.pressure);
    }
    const x0 = Math.max(0, Math.floor((Math.min(...xs) - 0.02) / 0.05) * 0.05);
    const x1 = Math.min(1, Math.ceil((Math.max(...xs) + 0.02) / 0.05) * 0.05);
    const yLo = Math.min(...ys) * 0.88;
    const yHi = Math.max(...ys) * 1.06;
    if (view === "cabin") {
      return { x0, x1, y0: Math.min(CABIN.y0, Math.floor(target.pressure / 10) * 10), y1: Math.max(CABIN.y1, Math.ceil(target.pressure / 10) * 10) };
    }
    const step = niceStep(yHi - yLo, 6);
    return { x0, x1, y0: Math.max(0, Math.floor(yLo / step) * step), y1: Math.ceil(yHi / step) * step };
  }, [envelopes, seed, target.o2, target.pressure, view]);
  const baseStable = useStableWin(base);
  const domain = useStableWin(zoom ?? baseStable);
  const rWin = useStableWin(renderWin ?? baseStable);
  const kx = (baseStable.x1 - baseStable.x0) / (domain.x1 - domain.x0);
  const zoomed = zoom !== null;

  const viewRef = useRef({ base: baseStable, domain, rWin, kx, iw, ih, ml: M.left, mt: M.top, fs });
  viewRef.current = { base: baseStable, domain, rWin, kx, iw, ih, ml: M.left, mt: M.top, fs };

  // View (V) coordinates: what the reader sees. R coordinates: where the data layers were drawn.
  const sx = (v: number) => ((v - domain.x0) / (domain.x1 - domain.x0)) * iw;
  const sy = (v: number) => ih - ((v - domain.y0) / (domain.y1 - domain.y0)) * ih;
  const rx = (v: number) => ((v - rWin.x0) / (rWin.x1 - rWin.x0)) * iw;
  const ry = (v: number) => ih - ((v - rWin.y0) / (rWin.y1 - rWin.y0)) * ih;
  const xfOf = (R: Win, W: Win) => {
    const ax = (R.x1 - R.x0) / (W.x1 - W.x0);
    const ay = (R.y1 - R.y0) / (W.y1 - W.y0);
    return `matrix(${ax} 0 0 ${ay} ${(iw * (R.x0 - W.x0)) / (W.x1 - W.x0)} ${(ih * (W.y1 - R.y1)) / (W.y1 - W.y0)})`;
  };
  const xf = xfOf(rWin, domain);
  const xfRef = useRef(xf);
  xfRef.current = xf;

  // ---- The live view. A gesture never sets React state per event: it moves `live`, one requestAnimationFrame writes a
  // transform on the data layers and tells the small axis layers the window; the real view is committed once, when the gesture ends.
  const live = useRef<Win | null>(null);
  const paintRaf = useRef(0);
  const commitTimer = useRef(0);
  const paint = useCallback(() => {
    paintRaf.current = 0;
    const W = live.current;
    const v = viewRef.current;
    if (!W) return;
    const D = v.rWin;
    const ax = (D.x1 - D.x0) / (W.x1 - W.x0);
    const ay = (D.y1 - D.y0) / (W.y1 - W.y0);
    const bx = (v.iw * (D.x0 - W.x0)) / (W.x1 - W.x0);
    const by = (v.ih * (W.y1 - D.y1)) / (W.y1 - W.y0);
    const t = `matrix(${ax} 0 0 ${ay} ${bx} ${by})`;
    for (const g of liveGroups.current) g?.setAttribute("transform", t);
    for (const s of setters.current) s(W);
    if (figRef.current) figRef.current.dataset.gesture = "1";
  }, []);
  const liveWin = () => live.current ?? viewRef.current.domain;
  /** Zoom by `factor` about the fraction (fx, fy) of the plot, then pan by fractions of the window. Moves the live view only. */
  const applyView = useCallback(
    (factor: number, fx: number, fy: number, dfx = 0, dfy = 0) => {
      const b = viewRef.current.base;
      const d = liveWin();
      const bsx = b.x1 - b.x0;
      const bsy = b.y1 - b.y0;
      const k0 = bsx / (d.x1 - d.x0);
      const nk = Math.min(MAX_ZOOM, Math.max(1, k0 * factor));
      const nsx = bsx / nk;
      const nsy = bsy / nk;
      const px = d.x0 + fx * (d.x1 - d.x0);
      const py = d.y1 - fy * (d.y1 - d.y0);
      const mx = PAN_MARGIN * bsx;
      const my = PAN_MARGIN * bsy;
      const x0 = Math.min(b.x1 + mx - nsx, Math.max(b.x0 - mx, px - fx * nsx + dfx * nsx));
      const y1 = Math.min(b.y1 + my, Math.max(b.y0 - my + nsy, py + fy * nsy + dfy * nsy));
      live.current = { x0, x1: x0 + nsx, y0: y1 - nsy, y1 };
      if (!paintRaf.current) paintRaf.current = requestAnimationFrame(paint);
    },
    [paint],
  );
  /** Make the live view the real one: one render, then the transform is cleared. */
  const commit = useCallback(() => {
    window.clearTimeout(commitTimer.current);
    const w = live.current;
    if (!w) return;
    const b = viewRef.current.base;
    const same = Math.abs(w.x0 - b.x0) + Math.abs(w.x1 - b.x1) + Math.abs(w.y0 - b.y0) + Math.abs(w.y1 - b.y1) < 1e-9;
    setZoom(same ? null : w);
    // The data layers are only moved by a pan. After a zoom they are re-drawn once, when they are magnified by more than ~25 %.
    const ratio = (viewRef.current.rWin.x1 - viewRef.current.rWin.x0) / (w.x1 - w.x0);
    if (ratio > 1.25 || ratio < 0.8) setRenderWin(same ? null : w);
    setCommitTick((t) => t + 1);
  }, []);
  const scheduleCommit = useCallback(() => {
    window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(commit, 120);
  }, [commit]);
  const zoomBy = (f: number) => {
    applyView(f, 0.5, 0.5);
    commit();
  };
  const resetView = useCallback(() => {
    live.current = viewRef.current.base;
    commit();
  }, [commit]);
  // After a commit the layers are drawn at the real view: drop the temporary transform and the live axes.
  useLayoutEffect(() => {
    if (paintRaf.current) {
      cancelAnimationFrame(paintRaf.current);
      paintRaf.current = 0;
    }
    live.current = null;
    for (const g of liveGroups.current) g?.setAttribute("transform", xfRef.current);
    for (const s of setters.current) s(null);
    if (figRef.current) delete figRef.current.dataset.gesture;
  }, [commitTick]);
  // The pressure range toggle changes the data window: the old view would mean nothing.
  useEffect(() => {
    live.current = null;
    setZoom(null);
    setRenderWin(null);
    setCommitTick((t) => t + 1);
  }, [view]);

  useEffect(() => {
    onZoomedChange?.(zoomed);
  }, [zoomed, onZoomedChange]);

  // The view follows the target when it leaves the zoomed area (a preset, a route, "Take me there").
  useEffect(() => {
    const v = viewRef.current;
    if (!zoomed || dragging || live.current) return;
    const d = v.domain;
    const mx = (d.x1 - d.x0) * 0.08;
    const my = (d.y1 - d.y0) * 0.08;
    if (target.o2 >= d.x0 + mx && target.o2 <= d.x1 - mx && target.pressure >= d.y0 + my && target.pressure <= d.y1 - my) return;
    applyView(1, 0.5, 0.5, (target.o2 - (d.x0 + d.x1) / 2) / (d.x1 - d.x0), (target.pressure - (d.y0 + d.y1) / 2) / (d.y1 - d.y0));
    commit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.o2, target.pressure]);

  // Wheel / trackpad zoom around the cursor. Inline it needs Ctrl (a trackpad pinch sends it), so the page still scrolls; full screen takes the plain wheel.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const on = (e: WheelEvent) => {
      const v = viewRef.current;
      if (!v.fs && !(e.ctrlKey || e.metaKey)) return;
      const r = el.getBoundingClientRect();
      const fx = (e.clientX - r.left - v.ml) / v.iw;
      const fy = (e.clientY - r.top - v.mt) / v.ih;
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      applyView(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), fx, fy);
      scheduleCommit();
    };
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, [applyView, scheduleCommit]);

  // Keyboard: arrows pan, + and - zoom, 0 resets. Active in full screen, or while zoomed with the pointer over the chart.
  const overChart = useRef(false);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const v = viewRef.current;
      if (!(v.fs || (v.kx > 1.001 && overChart.current))) return;
      const step = e.shiftKey ? 0.3 : 0.1;
      if (e.key === "ArrowLeft") applyView(1, 0.5, 0.5, -step, 0);
      else if (e.key === "ArrowRight") applyView(1, 0.5, 0.5, step, 0);
      else if (e.key === "ArrowUp") applyView(1, 0.5, 0.5, 0, step);
      else if (e.key === "ArrowDown") applyView(1, 0.5, 0.5, 0, -step);
      else if (e.key === "+" || e.key === "=") applyView(1.5, 0.5, 0.5);
      else if (e.key === "-" || e.key === "_") applyView(1 / 1.5, 0.5, 0.5);
      else if (e.key === "0") {
        resetView();
        e.preventDefault();
        return;
      } else return;
      e.preventDefault();
      scheduleCommit();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [applyView, resetView, scheduleCommit]);

  // The evidence map as one image: brighter cyan = more investigations apply; faint violet = only extrapolation.
  const mapImage = useMemo(() => {
    if (!evidence || typeof document === "undefined" || evidence.cells.length === 0) return null;
    const nx = evidence.o2Values.length;
    const ny = evidence.pressureValues.length;
    const S = 4; // pixels per cell, so the hatch of 'combination' cells can be drawn
    const c = document.createElement("canvas");
    c.width = nx * S;
    c.height = ny * S;
    const g = c.getContext("2d");
    if (!g) return null;
    const max = Math.max(1, evidence.maxApplicable);
    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const cell = evidence.cells[i * nx + j];
        const x = j * S;
        const y = (ny - 1 - i) * S;
        if (cell.applicable.length > 0) {
          g.fillStyle = `rgba(0, 240, 255, ${0.18 + 0.62 * (cell.applicable.length / max)})`;
          g.fillRect(x, y, S, S);
        } else if (cell.extrapolation.length > 0) {
          // Three clear steps by distance from the tested data; never the bright applicable tone.
          const lvl = cell.extrapolationLevel ?? "outside";
          g.fillStyle = EXTRA_TONE[lvl === "combination" ? "just_outside" : lvl];
          g.fillRect(x, y, S, S);
          if (lvl === "combination") {
            g.strokeStyle = "rgba(255, 255, 255, 0.55)";
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(x, y + S);
            g.lineTo(x + S, y);
            g.stroke();
          }
        }
      }
    }
    return c.toDataURL();
  }, [evidence]);

  const tx = sx(target.o2);
  const ty = sy(target.pressure);
  const txyR = { x: rx(target.o2), y: ry(target.pressure) };

  // ---- Pointers (TradingView-style): a drag anywhere on the plot pans; a drag that starts on the target marker moves the target;
  // a click without movement (< 4 px) places the target there; two fingers pinch and pan. All of it on the svg root.
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gest = useRef<{ mode: "pending" | "pan" | "pinch" | "target"; sx: number; sy: number; x: number; y: number; onHit: boolean; mid?: { x: number; y: number }; dist?: number } | null>(null);
  const pickRaf = useRef(0);
  const pickAt = (clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const v = viewRef.current;
    const fx = Math.min(1, Math.max(0, (clientX - r.left - v.ml) / v.iw));
    const fy = Math.min(1, Math.max(0, (clientY - r.top - v.mt) / v.ih));
    const d = v.domain;
    onTargetPick?.(Math.round((d.x0 + fx * (d.x1 - d.x0)) * 1000) / 1000, Math.round((d.y1 - fy * (d.y1 - d.y0)) * 10) / 10);
  };
  const nearTarget = (clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    return !!r && Math.hypot(clientX - r.left - M.left - tx, clientY - r.top - M.top - ty) < 16;
  };
  const twoFingers = () => {
    const [a, b] = [...ptrs.current.values()];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  };
  const curPos = useRef<Cursor | null>(null);
  const curRaf = useRef(0);
  const flushCursor = () => {
    curRaf.current = 0;
    const c = curPos.current;
    for (const s of cursors.current) s(c);
  };
  const setCursorPos = (c: Cursor | null) => {
    curPos.current = c;
    if (!curRaf.current) curRaf.current = requestAnimationFrame(flushCursor);
  };
  const svgDown = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    const svg = ev.currentTarget;
    ptrs.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ptrs.current.size === 2) {
      setDragging(false);
      for (const id of ptrs.current.keys()) svg.setPointerCapture(id);
      gest.current = { mode: "pinch", sx: 0, sy: 0, x: 0, y: 0, onHit: false, ...twoFingers() };
      setCursorPos(null);
      return;
    }
    if (onTargetPick && nearTarget(ev.clientX, ev.clientY)) {
      svg.setPointerCapture(ev.pointerId);
      gest.current = { mode: "target", sx: ev.clientX, sy: ev.clientY, x: ev.clientX, y: ev.clientY, onHit: false };
      setDragging(true);
      pickAt(ev.clientX, ev.clientY);
      return;
    }
    gest.current = { mode: "pending", sx: ev.clientX, sy: ev.clientY, x: ev.clientX, y: ev.clientY, onHit: !!(ev.target as Element).closest?.(".hit") };
  };
  const svgMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    const svg = ev.currentTarget;
    if (ptrs.current.has(ev.pointerId)) ptrs.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const g = gest.current;
    if (!g) {
      // Hover readout: one small layer, throttled to a frame, off during gestures.
      const r = svg.getBoundingClientRect();
      const x = ev.clientX - r.left - M.left;
      const y = ev.clientY - r.top - M.top;
      if (x >= 0 && x <= iw && y >= 0 && y <= ih) setCursorPos({ x, y });
      else setCursorPos(null);
      if (figRef.current) {
        if (nearTarget(ev.clientX, ev.clientY)) figRef.current.dataset.near = "1";
        else delete figRef.current.dataset.near;
      }
      return;
    }
    if (g.mode === "pending") {
      if (Math.hypot(ev.clientX - g.sx, ev.clientY - g.sy) <= 4) return;
      g.mode = "pan";
      g.x = g.sx;
      g.y = g.sy;
      svg.setPointerCapture(ev.pointerId);
      setCursorPos(null);
      if (figRef.current) figRef.current.dataset.gesture = "1";
    }
    if (g.mode === "pan") {
      const dx = ev.clientX - g.x;
      const dy = ev.clientY - g.y;
      g.x = ev.clientX;
      g.y = ev.clientY;
      applyView(1, 0.5, 0.5, -dx / viewRef.current.iw, dy / viewRef.current.ih);
    } else if (g.mode === "target") {
      g.x = ev.clientX;
      g.y = ev.clientY;
      if (!pickRaf.current)
        pickRaf.current = requestAnimationFrame(() => {
          pickRaf.current = 0;
          if (gest.current?.mode === "target") pickAt(gest.current.x, gest.current.y);
        });
    } else if (ptrs.current.size >= 2 && g.mid && g.dist) {
      const t = twoFingers();
      const r = svg.getBoundingClientRect();
      const v = viewRef.current;
      const fx = Math.min(1, Math.max(0, (t.mid.x - r.left - v.ml) / v.iw));
      const fy = Math.min(1, Math.max(0, (t.mid.y - r.top - v.mt) / v.ih));
      applyView(t.dist / g.dist, fx, fy, -(t.mid.x - g.mid.x) / v.iw, (t.mid.y - g.mid.y) / v.ih);
      g.mid = t.mid;
      g.dist = t.dist;
    }
  };
  const svgUp = (ev: React.PointerEvent<SVGSVGElement>, finish: boolean) => {
    const g = gest.current;
    ptrs.current.delete(ev.pointerId);
    gest.current = null;
    if (!g) return;
    if (g.mode === "pan" || g.mode === "pinch") {
      commit();
    } else if (g.mode === "target") {
      if (finish) pickAt(ev.clientX, ev.clientY);
      setDragging(false);
    } else if (finish && !g.onHit) {
      // A click without movement places the target there.
      const r = svgRef.current?.getBoundingClientRect();
      const x = r ? ev.clientX - r.left - M.left : -1;
      const y = r ? ev.clientY - r.top - M.top : -1;
      if (x >= 0 && x <= iw && y >= 0 && y <= ih) pickAt(ev.clientX, ev.clientY);
    }
  };

  const CALLOUT_W = 290;
  const calloutSide =
    M.left + tx + 26 + CALLOUT_W <= width - 40 ? "right" : M.left + tx - 26 - CALLOUT_W >= 0 ? "left" : "below";

  const visible = useMemo(() => envelopes.filter((e) => !hidden.has(e.key)), [envelopes, hidden]);
  const totalPoints = useMemo(() => envelopes.reduce((n, e) => n + e.points.length, 0), [envelopes]);
  let offScale = 0;
  for (const e of visible) for (const p of e.points) if (p.pressure < domain.y0 || p.pressure > domain.y1) offScale++;
  const matched = useMemo(() => envelopes.filter((e) => layerState.get(e.key) === "match"), [envelopes, layerState]);
  // Evidence gap: everything outside the hulls of the layers the engine compares with the target.
  const gapHulls = useMemo(() => matched.filter((e) => !hidden.has(e.key)).flatMap((e) => e.investigations.map((i) => i.hull)), [matched, hidden]);

  const desc = `Scatter of ${totalPoints} measured test points, oxygen (% by volume) against pressure, with one convex hull per regime combination: ${envelopes
    .map((e) => `${envelopeLongName(e)} (${e.points.length} points)`)
    .join("; ")}. Target ${targetLabel}: ${pctO2(target.o2)}, ${kPa(target.pressure)}. ${status.headline}. ${status.detail}`;

  const incomplete = envelopes.filter((e) => e.points.length > 0 && colors.get(e.key) === "var(--s-other)");
  const toggleIncomplete = () =>
    setHidden((prev) => {
      const next = new Set(prev);
      const anyOn = incomplete.some((e) => !next.has(e.key));
      for (const e of incomplete) {
        if (anyOn) next.add(e.key);
        else next.delete(e.key);
      }
      return next;
    });

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <figure data-help="chart"
      ref={figRef}
      className={`chart tone-${status.tone}${measured && !dragging ? " anim" : ""}${dragging ? " dragging" : ""}${zoomed ? " zoomed" : ""}`}
      onPointerEnter={() => (overChart.current = true)}
      onPointerLeave={() => (overChart.current = false)}
    >
      <div data-help="chart-legend" className="legend" role="group" aria-label="Regime layers (click to show or hide)">
        {envelopes
          .filter((e) => colors.get(e.key) !== "var(--s-other)")
          .map((e) => {
            const on = !hidden.has(e.key);
            const em = layerState.get(e.key) ?? "dim";
            return (
              <button data-help="chart-layer-chip"
                key={e.key}
                type="button"
                className={`chip chip-${em}`}
                aria-pressed={on}
                onClick={() => toggle(e.key)}
                title={`${envelopeLongName(e)}: ${e.points.length} plotted points from ${e.investigations.map((i) => i.accession).join(", ")}${e.regimeComplete ? "" : ". Hollow: some regime axis is not stated in the extracted records."}`}
              >
                <Glyph phase={fuelPhaseOf(e)} color={colors.get(e.key) ?? "var(--s-other)"} hollow={!e.regimeComplete} />
                <span>{envelopeName(e)}</span>
                <span className="chip-n">({e.points.length} points)</span>
              </button>
            );
          })}
        {incomplete.length > 0 && (
          <button data-help="chart-layer-regime-not-stated"
            type="button"
            className="chip chip-open"
            aria-pressed={incomplete.some((e) => !hidden.has(e.key))}
            onClick={toggleIncomplete}
            title={`Tests whose regime is not fully stated in the extracted records (${incomplete.length} layers): ${incomplete
              .map((e) => `${envelopeName(e)} (${e.points.length})`)
              .join(", ")}`}
          >
            <Glyph phase="unknown" color="var(--s-other)" hollow />
            <span>Regime not stated</span>
            <span className="chip-n">({incomplete.reduce((n, e) => n + e.points.length, 0)} points)</span>
          </button>
        )}
        <span className="chip chip-static" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="5" fill="none" stroke="var(--ink)" strokeWidth="2" />
            <circle cx="7" cy="7" r="1.6" fill="var(--ink)" />
          </svg>
          <span>Target</span>
        </span>
        <div className="seg" role="group" aria-label="Pressure range shown">
          <button data-help="chart-view-all" type="button" aria-pressed={view === "all"} onClick={() => setView("all")}>
            All pressures
          </button>
          <button data-help="chart-view-cabin" type="button" aria-pressed={view === "cabin"} onClick={() => setView("cabin")}>
            Cabin range
          </button>
        </div>
        <div className="chart-tools" role="group" aria-label="View: zoom and full screen">
          <button data-help="chart-zoom-out" type="button" onClick={() => zoomBy(1 / 1.5)} disabled={!zoomed} aria-label="Zoom out" title="Zoom out (−)">
            −
          </button>
          <button data-help="chart-zoom-in" type="button" onClick={() => zoomBy(1.5)} aria-label="Zoom in" title="Zoom in (+)">
            +
          </button>
          <button data-help="chart-reset" type="button" onClick={resetView} disabled={!zoomed} title="Reset the view (0)">
            Reset
          </button>
          {onToggleFs && (
            <button data-help="chart-fullscreen" type="button" className="fs-btn" aria-pressed={fs} onClick={onToggleFs} title={fs ? "Back to the page (Esc)" : "Open the chart full screen"}>
              {fs ? "Exit full screen" : "Full screen"}
            </button>
          )}
        </div>
      </div>

      <div className="plot-wrap" ref={wrapRef} style={fs ? undefined : { height }}>
        {zoomed && (
          <button data-help="chart-zoom-badge" type="button" className="zoom-badge" onClick={resetView} title="Reset the view (0)">
            {kx > 1.001 ? `Zoomed ×${fmt(kx, 1)}` : "Panned"} · Reset
          </button>
        )}
        <svg data-help="chart-plot"
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby="env-title env-desc"
          className="plot"
          onPointerDown={svgDown}
          onPointerMove={svgMove}
          onPointerLeave={() => setCursorPos(null)}
          onPointerUp={(ev) => svgUp(ev, true)}
          onPointerCancel={(ev) => svgUp(ev, false)}
          onDoubleClick={(ev) => {
            const r = ev.currentTarget.getBoundingClientRect();
            applyView(2, Math.min(1, Math.max(0, (ev.clientX - r.left - M.left) / iw)), Math.min(1, Math.max(0, (ev.clientY - r.top - M.top) / ih)));
            commit();
          }}
        >
          <title id="env-title">Evidence envelope: oxygen (% by volume) vs pressure</title>
          <desc id="env-desc">{desc}</desc>
          <defs>
            <clipPath id="plot-clip">
              <rect x={-6} y={-6} width={iw + 12} height={ih + 12} />
            </clipPath>
          </defs>
          <g transform={`translate(${M.left},${M.top})`}>
            <GridLayer domain={domain} iw={iw} ih={ih} setters={setters} />
            <g clipPath="url(#plot-clip)">
              <g ref={(g) => void (liveGroups.current[0] = g)} transform={xf}>
                <PlotLayers
                  domain={rWin}
                  iw={iw}
                  ih={ih}
                  visible={visible}
                  colors={colors}
                  layerState={layerState}
                  highlight={highlight}
                  gapHulls={gapHulls}
                  evidence={evidence}
                  mapImage={mapImage}
                  evidenceKey={evidenceKey}
                  hoverRef={hoverRef}
                  selectRef={selectRef}
                />
              </g>
            </g>
            <g ref={(g) => void (liveGroups.current[1] = g)} transform={xf}>
              {/* technical leader label on each comparable layer: anchor on a hull vertex, elbow, underline */}
              {matched.map((e) => {
                const verts = e.investigations.flatMap((i) => i.hull).filter((q) => q.pressure >= rWin.y0 && q.pressure <= rWin.y1);
                if (hidden.has(e.key) || verts.length === 0) return null;
                const anchor = verts.reduce((a, b) => (ry(b.pressure) - rx(b.o2_mole_fraction) < ry(a.pressure) - rx(a.o2_mole_fraction) ? b : a), verts[0]);
                const ax = rx(anchor.o2_mole_fraction);
                const ay = ry(anchor.pressure);
                const name = envelopeName(e);
                const w = name.length * 6.6 + 8;
                const goLeft = ax + 22 + w > iw;
                const ex = goLeft ? ax - 22 : ax + 22;
                const ey = Math.max(16, ay - 26);
                const lx2 = goLeft ? ex - w : ex + w;
                if (Math.abs(ey - txyR.y) < 40 && Math.min(ex, lx2) < txyR.x + 300 && Math.max(ex, lx2) > txyR.x - 30) return null;
                return (
                  <g key={`l${e.key}`} className="leader" aria-hidden="true">
                    <circle cx={ax} cy={ay} r={3} />
                    <path d={`M${ax},${ay} L${ex},${ey} L${lx2},${ey}`} />
                    <text x={goLeft ? ex - 4 : ex + 4} y={ey - 5} textAnchor={goLeft ? "end" : "start"} className="layer-label">
                      {name}
                    </text>
                  </g>
                );
              })}
              {pinned && (
                <g className={`pinned tone-${pinned.tone}`} transform={`translate(${rx(pinned.o2)},${ry(pinned.pressure)})`} aria-hidden="true">
                  <line x1={0} y1={0} x2={txyR.x - rx(pinned.o2)} y2={txyR.y - ry(pinned.pressure)} className="pin-link" />
                  <circle r={9} className="pin-ring" />
                  <circle r={2.5} className="pin-dot" />
                  <text x={13} y={-10} className="pin-label">
                    {pinned.label}
                  </text>
                </g>
              )}
              {overlay?.map((p, i) => (
                <g key={i} data-help="chart-compare-overlay" className="compare-pt" transform={`translate(${rx(p.o2)},${ry(p.pressure)})`} aria-hidden="true">
                  <rect x={-5} y={-5} width={10} height={10} transform="rotate(45)" className="compare-mark" />
                  <text x={9} y={-8} className="pin-label">
                    {i + 1}. {p.label}
                  </text>
                </g>
              ))}
              {/* target */}
              <g className="target-guides" aria-hidden="true">
                <line x1={0} x2={0} y1={-3 * ih} y2={4 * ih} style={{ transform: `translateX(${txyR.x}px)` }} />
                <line x1={-3 * iw} x2={4 * iw} y1={0} y2={0} style={{ transform: `translateY(${txyR.y}px)` }} />
              </g>
              <g data-help="chart-target" className="target" style={{ transform: `translate(${txyR.x}px, ${txyR.y}px)` }} aria-hidden="true">
                <circle r={17} className="target-halo" />
                <circle r={10} className="target-ring" />
                <circle r={3} className="target-dot" />
                <line x1={-18} x2={-13} y1={0} y2={0} className="target-tick" />
                <line x1={13} x2={18} y1={0} y2={0} className="target-tick" />
                <line x1={0} x2={0} y1={-18} y2={-13} className="target-tick" />
                <line x1={0} x2={0} y1={13} y2={18} className="target-tick" />
                {/* outer reticle: 24 degree ticks; turns with the target's O2 so a move reads as a rotation */}
                <g className="reticle-ring" style={{ transform: `rotate(${(target.o2 * 1440 + target.pressure * 2).toFixed(1)}deg)` }}>
                  <circle r={24} className="reticle-track" />
                  {Array.from({ length: 24 }, (_, i) => {
                    const a = (i / 24) * Math.PI * 2;
                    const r0 = i % 6 === 0 ? 20 : 22;
                    return (
                      <line
                        key={i}
                        x1={Math.round(Math.cos(a) * r0 * 100) / 100}
                        y1={Math.round(Math.sin(a) * r0 * 100) / 100}
                        x2={Math.round(Math.cos(a) * 24 * 100) / 100}
                        y2={Math.round(Math.sin(a) * 24 * 100) / 100}
                        className={i % 6 === 0 ? "reticle-major" : "reticle-minor"}
                      />
                    );
                  })}
                </g>
                {/* lock flash: replays when the target settles at a new point */}
                {!dragging && <circle key={`lock-${target.o2}-${target.pressure}`} r={24} className="target-lock" />}
              </g>
            </g>

            {rail && rail.length > 1 && (
              <g data-help="chart-rail" className="rail" aria-label="Verdict along pressure at this O2">
                {rail.map((r, i) => {
                  const step = rail[1].pressure - rail[0].pressure;
                  const y0 = sy(Math.min(domain.y1, r.pressure + step / 2));
                  const y1 = sy(Math.max(domain.y0, r.pressure - step / 2));
                  if (y1 <= y0) return null;
                  return <rect key={i} x={iw + 6} y={y0} width={7} height={y1 - y0 + 0.5} className={`rail-${TONE_STATUS[r.tone] ?? "standby"}`} />;
                })}
                <line x1={iw + 3} x2={iw + 16} y1={ty} y2={ty} className="rail-tick" />
                <text transform={`translate(${iw + 23},${ih / 2}) rotate(90)`} textAnchor="middle" className="rail-label">
                  verdict vs. pressure at this O₂
                </text>
                <title>Verdict along pressure at this O₂ and regime: green inside, amber outside, gray undetermined</title>
              </g>
            )}
            <CursorLayer domain={domain} iw={iw} ih={ih} cursors={cursors} />
            <TickLayer domain={domain} iw={iw} ih={ih} showPsi={showPsi} setters={setters} />
            {hover && (() => {
              const tipLeft = Math.min(M.left + hover.x + 34, width - 236) - M.left;
              const tipTop = Math.max(4, M.top + hover.y - 34) - M.top;
              const elbowX = hover.x + 12;
              return (
                <g className="tt-link" aria-hidden="true">
                  <circle cx={hover.x} cy={hover.y} r={8} />
                  <path d={`M${hover.x + 6},${hover.y - 6} L${elbowX},${tipTop + 12} L${tipLeft},${tipTop + 12}`} />
                </g>
              );
            })()}
          </g>
        </svg>

        <div data-help="chart-callout"
          className={`callout callout-${status.tone} callout-${calloutSide}`}
          style={{ transform: `translate(${M.left + tx}px, ${M.top + ty}px)` }}
          aria-live="polite"
        >
          <div className="callout-inner">
            <div className="callout-label">{targetLabel}</div>
            <div className="callout-head">
              <StatusSymbol level={TONE_STATUS[status.tone]} size={14} />
              {status.headline}
            </div>
            <div className="callout-sub">{status.sub}</div>
          </div>
        </div>

        {!hover && <MapTip domain={domain} iw={iw} ih={ih} evidence={evidence} left={M.left} top={M.top} maxLeft={width - 250} cursors={cursors} />}
        {hover && (
          <div data-help="chart-tooltip"
            className="tooltip"
            style={{ left: Math.min(M.left + hover.x + 34, width - 236), top: Math.max(4, M.top + hover.y - 34) }}
            role="status"
          >
            <div className="tt-title">
              {hover.point.accession} · test {hover.point.test_id}
            </div>
            <div>O₂ {pctO2(hover.point.o2_mole_fraction, 2)}</div>
            {hover.point.citations
              .filter((c) => c.value.includes(".."))
              .map((c) => (
                <div key={`${c.variable}${c.value}`} className="muted">
                  one end of the range {c.variable === "pressure" ? `${c.value} kPa` : c.value}
                </div>
              ))}
            <div>
              {kPa(hover.point.pressure)} <span className="muted">({psia(hover.point.pressure)})</span>
            </div>
            <div className="muted">{envelopeLongName(hover.env)}</div>
            <div className="muted">
              file and location given
            </div>
            <div className="tt-hint">Click: open its receipt</div>
          </div>
        )}
      </div>

      <figcaption data-help="chart-caption" className="chart-caption">
        <p className={`status status-${status.tone}`}>
          <strong>{status.headline}.</strong> {status.detail}
        </p>
        {openAxes.length > 0 && (
          <p className="small open-axes">
            Not compared, left open by the target: {openAxes.map((a) => axisLabel(a).toLowerCase()).join(", ")}. Set{" "}
            {openAxes.length === 1 ? "it" : "them"} in the target panel to compare.
          </p>
        )}
        <p data-help="not-compared-note" className="small muted">
          A verdict compares recorded conditions; it does not mean a test was run at this exact condition. Not compared: {NEVER_COMPARED.join("; ")}.
        </p>
        {offScale > 0 && (
          <p className="muted small">
            {offScale} plotted point{offScale === 1 ? " is" : "s are"} outside the pressure range shown ({fmt(domain.y0, 0)}–{fmt(domain.y1, 0)} kPa).
            Hulls are still computed from every point.
          </p>
        )}
        {mapImage && (
          <p data-help="chart-map-legend" className="small emap-legend">
            <i className="emap-ramp" aria-hidden="true" /> Bright: NASA investigations apply here (same regime, inside what they tested); brighter = more of them.{" "}
            Extrapolation, by distance from the tested data:{" "}
            <i className="emap-l emap-l1" aria-hidden="true" /> just outside,{" "}
            <i className="emap-l emap-l2" aria-hidden="true" /> outside,{" "}
            <i className="emap-l emap-l3" aria-hidden="true" /> far outside,{" "}
            <i className="emap-l emap-l1 emap-lc" aria-hidden="true" /> hatched: inside each tested range but this combination was not tested. A distance, not a pass: even
            &quot;just outside&quot; is an extrapolation. Dark: no investigation of this regime covers the point. Hover the chart to see which.
          </p>
        )}
        <p className="muted small">
          {gapHulls.length > 0 && "Hatching marks the O₂–pressure plane outside every measured hull of the target's regime: no PSI test there, in the extracted records. "}
          Each shaded area is the <Term k="convex hull">convex hull</Term> of one investigation&apos;s measured test points: the exact outline its verdict
          uses. Color is the regime (gravity · fuel phase · diluent · flame type). A different <Term k="regime barrier">regime</Term> is faded and never used for
          comparison. A line joins the two ends of a measured range. Hollow markers are tests with some regime axis not stated in the extracted records; gray ones
          lack gravity or fuel phase.
        </p>
      </figcaption>

      <PointTable envelopes={envelopes} selectRef={selectRef} />
    </figure>
  );
}

export default memo(EnvelopeChart);
