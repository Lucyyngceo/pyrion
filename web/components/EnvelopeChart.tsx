"use client";

import Term from "./Term";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EnvelopePoint, EvidenceMap, RegimeEnvelope } from "@/lib/engine";
import { envelopeLongName, envelopeName, fuelPhaseOf } from "@/lib/layers";
import type { EnvelopeStatus } from "@/lib/summary";
import StatusSymbol, { TONE_STATUS } from "./StatusSymbol";
import { ATM_KPA, axisLabel, fmt, kPa, kpaToPsi, pctO2, psia } from "@/lib/units";

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


function EnvelopeChart({ envelopes, colors, layerState, target, targetLabel, status, seed, highlight, onPointSelect, onTargetPick, openAxes, pinned, rail, evidence, evidenceKey, fs = false, onToggleFs, onZoomedChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState<Win | null>(null);
  const [boxH, setBoxH] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(780);
  const [viewportH, setViewportH] = useState(900);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [hover, setHover] = useState<Hover | null>(null);
  const [view, setView] = useState<"all" | "cabin">("cabin");
  // No marker animation until the real width is known, so nothing slides in on page load.
  const [measured, setMeasured] = useState(false);

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

  // Fits a laptop screen: never taller than ~60% of the window, so chart and target panel share the first view.
  // Zoomed or full screen: ticks also give psia, so the left margin is wider.
  const showPsi = fs || zoom !== null;
  const M = showPsi ? { ...M0, left: 104 } : M0;
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

  const domain = zoom ?? base;
  const kx = (base.x1 - base.x0) / (domain.x1 - domain.x0);
  const zoomed = kx > 1.001;
  const viewRef = useRef({ base, domain, kx, iw, ih, ml: M.left, mt: M.top, fs });
  viewRef.current = { base, domain, kx, iw, ih, ml: M.left, mt: M.top, fs };

  /** The one place the view changes: zoom by `factor` about the fraction (fx, fy) of the plot, then pan by fractions of the window. */
  const applyView = useCallback((factor: number, fx: number, fy: number, dfx = 0, dfy = 0) => {
    const v = viewRef.current;
    const b = v.base;
    const d = v.domain;
    const bsx = b.x1 - b.x0;
    const bsy = b.y1 - b.y0;
    const nk = Math.min(MAX_ZOOM, Math.max(1, v.kx * factor));
    if (nk <= 1.001) {
      viewRef.current = { ...v, domain: b, kx: 1 };
      setZoom(null);
      return;
    }
    const nsx = bsx / nk;
    const nsy = bsy / nk;
    const px = d.x0 + fx * (d.x1 - d.x0);
    const py = d.y1 - fy * (d.y1 - d.y0);
    const mx = 0.05 * bsx;
    const my = 0.05 * bsy;
    const x0 = Math.min(b.x1 + mx - nsx, Math.max(b.x0 - mx, px - fx * nsx + dfx * nsx));
    const y1 = Math.min(b.y1 + my, Math.max(b.y0 - my + nsy, py + fy * nsy + dfy * nsy));
    const w = { x0, x1: x0 + nsx, y0: y1 - nsy, y1 };
    viewRef.current = { ...v, domain: w, kx: nk };
    setZoom(w);
  }, []);
  const resetView = useCallback(() => {
    viewRef.current = { ...viewRef.current, domain: viewRef.current.base, kx: 1 };
    setZoom(null);
  }, []);

  useEffect(() => {
    onZoomedChange?.(zoomed);
  }, [zoomed, onZoomedChange]);

  // The view follows the target when it leaves the zoomed area (a preset, a route, "Take me there").
  useEffect(() => {
    const v = viewRef.current;
    if (v.kx <= 1.001 || dragging) return;
    const d = v.domain;
    const mx = (d.x1 - d.x0) * 0.08;
    const my = (d.y1 - d.y0) * 0.08;
    if (target.o2 >= d.x0 + mx && target.o2 <= d.x1 - mx && target.pressure >= d.y0 + my && target.pressure <= d.y1 - my) return;
    const dfx = (target.o2 - (d.x0 + d.x1) / 2) / (d.x1 - d.x0);
    const dfy = (target.pressure - (d.y0 + d.y1) / 2) / (d.y1 - d.y0);
    applyView(1, 0.5, 0.5, dfx, dfy);
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
    };
    el.addEventListener("wheel", on, { passive: false });
    return () => el.removeEventListener("wheel", on);
  }, [applyView]);

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
      else if (e.key === "0") resetView();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [applyView, resetView]);

  const sx = (v: number) => ((v - domain.x0) / (domain.x1 - domain.x0)) * iw;
  const sy = (v: number) => ih - ((v - domain.y0) / (domain.y1 - domain.y0)) * ih;

  const xTicks = ticks(domain.x0, domain.x1, Math.max(4, Math.floor(iw / 80)));
  const yTicks = ticks(domain.y0, domain.y1, Math.max(4, Math.floor(ih / 56)));

  const pick = (ev: React.PointerEvent<SVGRectElement>) => {
    const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    const fy = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
    const o2 = domain.x0 + fx * (domain.x1 - domain.x0);
    const pr = domain.y1 - fy * (domain.y1 - domain.y0);
    onTargetPick?.(Math.round(o2 * 1000) / 1000, Math.round(pr * 10) / 10);
  };

  // The evidence map as one image: brighter cyan = more investigations apply; faint violet = only extrapolation.
  const mapImage = useMemo(() => {
    if (!evidence || typeof document === "undefined" || evidence.cells.length === 0) return null;
    const nx = evidence.o2Values.length;
    const ny = evidence.pressureValues.length;
    const c = document.createElement("canvas");
    c.width = nx;
    c.height = ny;
    const g = c.getContext("2d");
    if (!g) return null;
    const max = Math.max(1, evidence.maxApplicable);
    for (let i = 0; i < ny; i++) {
      for (let j = 0; j < nx; j++) {
        const cell = evidence.cells[i * nx + j];
        if (cell.applicable.length > 0) g.fillStyle = `rgba(0, 240, 255, ${0.18 + 0.62 * (cell.applicable.length / max)})`;
        else if (cell.extrapolation.length > 0) g.fillStyle = "rgba(185, 139, 255, 0.13)";
        else continue;
        g.fillRect(j, ny - 1 - i, 1, 1);
      }
    }
    return c.toDataURL();
  }, [evidence]);
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
  // What is under the cursor: the cell, and which investigations apply there.
  const cellUnder = (() => {
    if (!evidence || !cursor || evidence.o2Values.length < 2) return null;
    const o2 = domain.x0 + (cursor.x / iw) * (domain.x1 - domain.x0);
    const pr = domain.y1 - (cursor.y / ih) * (domain.y1 - domain.y0);
    const o = evidence.o2Values;
    const p = evidence.pressureValues;
    const j = Math.round(((o2 - o[0]) / (o[o.length - 1] - o[0])) * (o.length - 1));
    const i = Math.round(((pr - p[0]) / (p[p.length - 1] - p[0])) * (p.length - 1));
    if (j < 0 || j >= o.length || i < 0 || i >= p.length) return null;
    return evidence.cells[i * o.length + j];
  })();

  const tx = sx(target.o2);
  const ty = sy(target.pressure);
  // Pointers: a drag that starts on the target (or any drag, when not zoomed) moves the target; when zoomed, a drag elsewhere pans.
  // Two fingers pinch and pan. A click without movement still places the target.
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gest = useRef<{ mode: "target" | "pan" | "pinch"; moved: number; x: number; y: number; mid?: { x: number; y: number }; dist?: number } | null>(null);
  const twoFingers = () => {
    const [a, b] = [...ptrs.current.values()];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  };
  const surfDown = (ev: React.PointerEvent<SVGRectElement>) => {
    const el = ev.currentTarget;
    el.setPointerCapture(ev.pointerId);
    ptrs.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (ptrs.current.size === 2) {
      setDragging(false);
      gest.current = { mode: "pinch", moved: 9, x: 0, y: 0, ...twoFingers() };
      return;
    }
    const r = el.getBoundingClientRect();
    const near = !zoomed || Math.hypot(ev.clientX - r.left - tx, ev.clientY - r.top - ty) < 26;
    if (near) {
      gest.current = { mode: "target", moved: 0, x: ev.clientX, y: ev.clientY };
      setDragging(true);
      pick(ev);
    } else gest.current = { mode: "pan", moved: 0, x: ev.clientX, y: ev.clientY };
  };
  const surfMove = (ev: React.PointerEvent<SVGRectElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    setCursor({ x: ((ev.clientX - r.left) / r.width) * iw, y: ((ev.clientY - r.top) / r.height) * ih });
    if (ptrs.current.has(ev.pointerId)) ptrs.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const g = gest.current;
    if (!g) return;
    if (g.mode === "target") pick(ev);
    else if (g.mode === "pan") {
      const dx = ev.clientX - g.x;
      const dy = ev.clientY - g.y;
      g.moved += Math.abs(dx) + Math.abs(dy);
      g.x = ev.clientX;
      g.y = ev.clientY;
      if (g.moved > 4) applyView(1, 0.5, 0.5, -dx / iw, dy / ih);
    } else if (ptrs.current.size >= 2 && g.mid && g.dist) {
      const t = twoFingers();
      const fx = Math.min(1, Math.max(0, (t.mid.x - r.left) / r.width));
      const fy = Math.min(1, Math.max(0, (t.mid.y - r.top) / r.height));
      applyView(t.dist / g.dist, fx, fy, -(t.mid.x - g.mid.x) / iw, (t.mid.y - g.mid.y) / ih);
      g.mid = t.mid;
      g.dist = t.dist;
    }
  };
  const surfUp = (ev: React.PointerEvent<SVGRectElement>, commit: boolean) => {
    const g = gest.current;
    ptrs.current.delete(ev.pointerId);
    if (commit && g?.mode === "pan" && g.moved <= 4) pick(ev);
    gest.current = null;
    setDragging(false);
  };

  const CALLOUT_W = 290;
  const calloutSide =
    M.left + tx + 26 + CALLOUT_W <= width - 40 ? "right" : M.left + tx - 26 - CALLOUT_W >= 0 ? "left" : "below";

  const visible = envelopes.filter((e) => !hidden.has(e.key));
  const totalPoints = envelopes.reduce((n, e) => n + e.points.length, 0);
  let offScale = 0;
  for (const e of visible) for (const p of e.points) if (p.pressure < domain.y0 || p.pressure > domain.y1) offScale++;
  const matched = envelopes.filter((e) => layerState.get(e.key) === "match");
  // Evidence gap: everything outside the hulls of the layers the engine compares with the target.
  const gapHulls = matched.filter((e) => !hidden.has(e.key)).flatMap((e) => e.investigations.map((i) => i.hull));

  const desc = `Scatter of ${totalPoints} measured test points, O₂ mole fraction against pressure, with one convex hull per regime combination: ${envelopes
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
    <figure
      className={`chart tone-${status.tone}${measured && !dragging ? " anim" : ""}${dragging ? " dragging" : ""}${zoomed ? " zoomed" : ""}`}
      onPointerEnter={() => (overChart.current = true)}
      onPointerLeave={() => (overChart.current = false)}
    >
      <div className="legend" role="group" aria-label="Regime layers (click to show or hide)">
        {envelopes
          .filter((e) => colors.get(e.key) !== "var(--s-other)")
          .map((e) => {
            const on = !hidden.has(e.key);
            const em = layerState.get(e.key) ?? "dim";
            return (
              <button
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
          <button
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
          <button type="button" aria-pressed={view === "all"} onClick={() => setView("all")}>
            All pressures
          </button>
          <button type="button" aria-pressed={view === "cabin"} onClick={() => setView("cabin")}>
            Cabin range
          </button>
        </div>
        <div className="chart-tools" role="group" aria-label="View: zoom and full screen">
          <button type="button" onClick={() => applyView(1 / 1.5, 0.5, 0.5)} disabled={!zoomed} aria-label="Zoom out" title="Zoom out (−)">
            −
          </button>
          <button type="button" onClick={() => applyView(1.5, 0.5, 0.5)} aria-label="Zoom in" title="Zoom in (+)">
            +
          </button>
          <button type="button" onClick={resetView} disabled={!zoomed} title="Reset the view (0)">
            Reset
          </button>
          {onToggleFs && (
            <button type="button" className="fs-btn" aria-pressed={fs} onClick={onToggleFs} title={fs ? "Back to the page (Esc)" : "Open the chart full screen"}>
              {fs ? "Exit full screen" : "Full screen"}
            </button>
          )}
        </div>
      </div>

      <div className="plot-wrap" ref={wrapRef} style={fs ? undefined : { height }}>
        {zoomed && (
          <button type="button" className="zoom-badge" onClick={resetView} title="Reset the view (0)">
            Zoomed ×{fmt(kx, 1)} · Reset
          </button>
        )}
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="env-title env-desc" className="plot">
          <title id="env-title">Evidence envelope: oxygen (% by volume) vs pressure</title>
          <desc id="env-desc">{desc}</desc>
          <defs>
            <pattern id="gap-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="7" className="gap-line" />
            </pattern>
            <mask id="gap-mask" maskUnits="userSpaceOnUse" x={-10} y={-10} width={iw + 20} height={ih + 20}>
              <rect x={-10} y={-10} width={iw + 20} height={ih + 20} fill="white" />
              {gapHulls.map((h, i) => {
                const pts = h.map((q) => [sx(q.o2_mole_fraction), sy(q.pressure)] as const);
                if (pts.length >= 3) return <path key={i} d={`M${pts.map(([x, y]) => `${x},${y}`).join("L")}Z`} fill="black" />;
                if (pts.length === 2)
                  return <line key={i} x1={pts[0][0]} y1={pts[0][1]} x2={pts[1][0]} y2={pts[1][1]} stroke="black" strokeWidth={16} strokeLinecap="round" />;
                if (pts.length === 1) return <circle key={i} cx={pts[0][0]} cy={pts[0][1]} r={11} fill="black" />;
                return null;
              })}
            </mask>
            <clipPath id="plot-clip">
              <rect x={-6} y={-6} width={iw + 12} height={ih + 12} />
            </clipPath>
          </defs>
          <g transform={`translate(${M.left},${M.top})`}>
            {yTicks.map((v) => (
              <line key={`gy${v}`} x1={0} x2={iw} y1={sy(v)} y2={sy(v)} className="grid" />
            ))}
            {xTicks.map((v) => (
              <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={0} y2={ih} className="grid" />
            ))}

            {domain.y0 < ATM_KPA && domain.y1 > ATM_KPA && (
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

            {mapImage && mapBox && (
              <image
                key={evidenceKey}
                className="emap-img"
                href={mapImage}
                x={mapBox.x}
                y={mapBox.y}
                width={mapBox.w}
                height={mapBox.h}
                preserveAspectRatio="none"
                pointerEvents="none"
                clipPath="url(#plot-clip)"
                aria-hidden="true"
              />
            )}
            {onTargetPick && (
              <rect
                x={0}
                y={0}
                width={iw}
                height={ih}
                className="pick-surface"
                onPointerDown={surfDown}
                onPointerMove={surfMove}
                onPointerLeave={() => setCursor(null)}
                onPointerUp={(ev) => surfUp(ev, true)}
                onPointerCancel={(ev) => surfUp(ev, false)}
                onDoubleClick={(ev) => {
                  const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
                  applyView(2, (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
                }}
              />
            )}
            {gapHulls.length > 0 && (
              <rect x={0} y={0} width={iw} height={ih} fill="url(#gap-hatch)" mask="url(#gap-mask)" className="gap" aria-hidden="true" />
            )}
            <g clipPath="url(#plot-clip)">
              {/* decision hulls: one per investigation, the exact hull its verdict uses */}
              {visible.map((e) => {
                const color = colors.get(e.key) ?? "var(--s-other)";
                return (
                  <g key={`h${e.key}`} className={`layer reveal-hull em-${layerState.get(e.key) ?? "dim"}`}>
                    {e.investigations.map((inv) => {
                      const faded = highlight !== null && inv.accession !== highlight;
                      return (
                        <g key={inv.accession} className={faded ? "faded" : undefined}>
                          {hullShape(inv.hull, color, e.regimeComplete, sx, sy, inv.accession)}
                        </g>
                      );
                    })}
                    {rangeSegments(e.points).map(([a, b], i) => (
                      <line
                        key={`r${i}`}
                        x1={sx(a.o2_mole_fraction)}
                        y1={sy(a.pressure)}
                        x2={sx(b.o2_mole_fraction)}
                        y2={sy(b.pressure)}
                        stroke={color}
                        strokeWidth={2}
                        strokeLinecap="round"
                        className="range-seg"
                      />
                    ))}
                  </g>
                );
              })}

              {/* points */}
              {visible.map((e, li) => {
                const color = colors.get(e.key) ?? "var(--s-other)";
                const phase = fuelPhaseOf(e);
                return (
                  <g
                    key={`p${e.key}`}
                    className={`layer reveal-pts em-${layerState.get(e.key) ?? "dim"}`}
                    style={{ "--i": Math.min(li, 10) } as React.CSSProperties}
                  >
                    {e.points.map((p, i) => {
                      const x = sx(p.o2_mole_fraction);
                      const y = sy(p.pressure);
                      const hl = highlight !== null && p.accession === highlight;
                      const faded = highlight !== null && !hl;
                      return (
                        <g key={i} className={faded ? "faded" : undefined}>
                          <Marker phase={phase} x={x} y={y} color={color} r={hl ? 6 : 4.5} hollow={!e.regimeComplete} />
                          <circle
                            cx={x}
                            cy={y}
                            r={9}
                            className="hit"
                            onPointerEnter={() => setHover({ env: e, point: p, x, y })}
                            onPointerLeave={() => setHover((h) => (h?.point === p ? null : h))}
                            onClick={() => onPointSelect(p.accession)}
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>

            {/* technical leader label on each comparable layer: anchor on a hull vertex, elbow, underline */}
            {matched.map((e) => {
              const verts = e.investigations.flatMap((i) => i.hull).filter((q) => q.pressure >= domain.y0 && q.pressure <= domain.y1);
              if (hidden.has(e.key) || verts.length === 0) return null;
              const anchor = verts.reduce((a, b) => (sy(b.pressure) - sx(b.o2_mole_fraction) < sy(a.pressure) - sx(a.o2_mole_fraction) ? b : a), verts[0]);
              const ax = sx(anchor.o2_mole_fraction);
              const ay = sy(anchor.pressure);
              const name = envelopeName(e);
              const w = name.length * 6.6 + 8;
              const goLeft = ax + 22 + w > iw;
              const ex = goLeft ? ax - 22 : ax + 22;
              const ey = Math.max(16, ay - 26);
              const lx2 = goLeft ? ex - w : ex + w;
              if (Math.abs(ey - ty) < 40 && Math.min(ex, lx2) < tx + 300 && Math.max(ex, lx2) > tx - 30) return null;
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

            {rail && rail.length > 1 && (
              <g className="rail" aria-label="Verdict along pressure at this O2">
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
            {pinned && (
              <g className={`pinned tone-${pinned.tone}`} transform={`translate(${sx(pinned.o2)},${sy(pinned.pressure)})`} aria-hidden="true">
                <line x1={0} y1={0} x2={tx - sx(pinned.o2)} y2={ty - sy(pinned.pressure)} className="pin-link" />
                <circle r={9} className="pin-ring" />
                <circle r={2.5} className="pin-dot" />
                <text x={13} y={-10} className="pin-label">
                  {pinned.label}
                </text>
              </g>
            )}
            {/* target */}
            <g className="target-guides" aria-hidden="true">
              <line x1={0} x2={0} y1={0} y2={ih} style={{ transform: `translateX(${tx}px)` }} />
              <line x1={0} x2={iw} y1={0} y2={0} style={{ transform: `translateY(${ty}px)` }} />
            </g>
            <g className="target" style={{ transform: `translate(${tx}px, ${ty}px)` }} aria-hidden="true">
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

            {cursor && !dragging && (
              <g className="cursor" aria-hidden="true">
                <line x1={cursor.x} x2={cursor.x} y1={0} y2={ih} />
                <line x1={0} x2={iw} y1={cursor.y} y2={cursor.y} />
                <g transform={`translate(${cursor.x},${ih})`}>
                  <rect x={-34} y={2} width={68} height={18} rx={4} className="cursor-tag" />
                  <text y={15} textAnchor="middle" className="cursor-text">
                    {fmt((domain.x0 + (cursor.x / iw) * (domain.x1 - domain.x0)) * 100, 1)} % O₂
                  </text>
                </g>
                <g transform={`translate(0,${cursor.y})`}>
                  <rect x={-64} y={-9} width={62} height={18} rx={4} className="cursor-tag" />
                  <text x={-33} y={4} textAnchor="middle" className="cursor-text">
                    {fmt(domain.y1 - (cursor.y / ih) * (domain.y1 - domain.y0), 1)} kPa
                  </text>
                </g>
              </g>
            )}
            {/* instrument frame: minor ruler ticks on both axes and corner reticles */}
            <g className="ruler" aria-hidden="true">
              {xTicks.slice(0, -1).flatMap((v, k) => {
                const nx = xTicks[k + 1];
                return [1, 2, 3, 4].map((j) => {
                  const x = sx(v + ((nx - v) * j) / 5);
                  return <line key={`rx${k}-${j}`} x1={x} x2={x} y1={ih} y2={ih + (j === 0 ? 8 : 4)} />;
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
            <line x1={0} x2={iw} y1={ih} y2={ih} className="axis" />
            <line x1={0} x2={0} y1={0} y2={ih} className="axis" />
            {xTicks.map((v) => (
              <text key={`tx${v}`} x={sx(v)} y={ih + 18} textAnchor="middle" className="tick">
                {fmt(v * 100, domain.x1 - domain.x0 < 0.1 ? 1 : 0)}%
              </text>
            ))}
            {yTicks.map((v) => (
              <text key={`ty${v}`} x={-10} y={sy(v) + 4} textAnchor="end" className="tick">
                {showPsi ? `${fmt(v, domain.y1 - domain.y0 < 20 ? 1 : 0)} (${fmt(kpaToPsi(v), 1)})` : fmt(v, 0)}
              </text>
            ))}
            <text x={iw / 2} y={ih + 42} textAnchor="middle" className="axis-title">
              Oxygen (% by volume)
            </text>
            <text transform={`translate(${showPsi ? -88 : -50},${ih / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">
              {showPsi ? "Pressure (kPa; psia in brackets)" : "Pressure (kPa)"}
            </text>
          </g>
        </svg>

        <div
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

        {cellUnder && cursor && !hover && (
          <div className="map-tip" role="status" style={{ left: Math.min(M.left + cursor.x + 14, width - 250), top: Math.max(4, M.top + cursor.y - 10) }}>
            {cellUnder.applicable.length > 0 ? (
              <>
                <strong>
                  {cellUnder.applicable.length} investigation{cellUnder.applicable.length === 1 ? "" : "s"} apply here:
                </strong>{" "}
                {cellUnder.applicable.slice(0, 4).join(", ")}
                {cellUnder.applicable.length > 4 ? ` and ${cellUnder.applicable.length - 4} more` : ""}
              </>
            ) : cellUnder.extrapolation.length > 0 ? (
              <>No investigation applies here; {cellUnder.extrapolation.length} would need extrapolation.</>
            ) : (
              <>No investigation of this regime covers this point.</>
            )}
          </div>
        )}
        {hover && (
          <div
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

      <figcaption className="chart-caption">
        <p className={`status status-${status.tone}`}>
          <strong>{status.headline}.</strong> {status.detail}
        </p>
        {openAxes.length > 0 && (
          <p className="small open-axes">
            Not compared, left open by the target: {openAxes.map((a) => axisLabel(a).toLowerCase()).join(", ")}. Set{" "}
            {openAxes.length === 1 ? "it" : "them"} in the target panel to compare.
          </p>
        )}
        {offScale > 0 && (
          <p className="muted small">
            {offScale} plotted point{offScale === 1 ? " is" : "s are"} outside the pressure range shown ({fmt(domain.y0, 0)}–{fmt(domain.y1, 0)} kPa).
            Hulls are still computed from every point.
          </p>
        )}
        {mapImage && (
          <p className="small emap-legend">
            <i className="emap-ramp" aria-hidden="true" /> Shading: brighter = more NASA investigations apply here (same regime as your condition, inside what they tested).{" "}
            <i className="emap-extra" aria-hidden="true" /> Faint violet: same regime, but only by extrapolation. Dark: no investigation of this regime covers the point. Hover the chart to see which.
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

      <details className="table-view">
        <summary>Data table ({totalPoints} plotted points)</summary>
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
                      <button type="button" className="linklike" onClick={() => onPointSelect(p.accession)}>
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
      </details>
    </figure>
  );
}

export default memo(EnvelopeChart);
