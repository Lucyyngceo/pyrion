"use client";

// Evidence timeline: the oxygen x pressure plane filling up year by year (PSI dates, tools/build_timeline.py).
// Moon Base band (engine MOON_BASE_BAND) drawn as an empty outline; FM2's planned tests (engine
// fm2Hypothetical, NTRS 20260001966) drawn dotted and labelled "planned, not in PSI".
// prefers-reduced-motion: no autoplay and no transitions; the slider still works.

import { useEffect, useMemo, useState } from "react";

export interface TimelineProps {
  points: { o2: number; kpa: number; acc: string; year: number | null; gravity: string[] }[];
  frames: { label: string; year: number | null; final: boolean }[];
  band: { vertices: { o2: number; kpa: number }[]; label: string };
  fm2: { o2: number; kpa: number }[];
  names: Record<string, string>;
  yearLabel: string;
}

const W = 640;
const H = 380;
const M = { l: 56, r: 16, t: 14, b: 44 };
const X0 = 0.1;
const X1 = 0.45;
const Y0 = 40;
const Y1 = 600;
const sx = (o2: number) => M.l + ((o2 - X0) / (X1 - X0)) * (W - M.l - M.r);
const sy = (kpa: number) => H - M.b - (Math.log(kpa / Y0) / Math.log(Y1 / Y0)) * (H - M.t - M.b);
const inside = (p: { o2: number; kpa: number }) => p.o2 >= X0 && p.o2 <= X1 && p.kpa >= Y0 && p.kpa <= Y1;
const X_TICKS = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45];
const Y_TICKS = [50, 100, 200, 500];

export default function Timeline({ points, frames, band, fm2, names, yearLabel }: TimelineProps) {
  const last = frames.length - 1;
  const [i, setI] = useState(last);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setI((k) => {
        if (k >= last) {
          setPlaying(false);
          return last;
        }
        return k + 1;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [playing, last]);

  const frame = frames[i];
  const shown = useMemo(
    () => points.filter((p) => frame.final || (p.year !== null && frame.year !== null && p.year <= frame.year)),
    [points, frame],
  );
  const accs = useMemo(() => [...new Set(shown.map((p) => p.acc))], [shown]);
  const outOfView = shown.filter((p) => !inside(p)).length;
  const bandPath = band.vertices.map((v, k) => `${k ? "L" : "M"}${sx(v.o2).toFixed(1)},${sy(v.kpa).toFixed(1)}`).join(" ") + " Z";

  const play = () => {
    if (playing) return setPlaying(false);
    if (i >= last) setI(0);
    setPlaying(true);
  };

  return (
    <div className={`lens-timeline${reduced ? " reduced" : ""}`}>
      <div className="lens-timeline-controls">
        <button type="button" data-help="lenses-timeline" onClick={play} aria-pressed={playing}>
          {playing ? "Pause" : "Play"}
        </button>
        <label>
          <span className="muted">{yearLabel}</span>
          <input
            data-help="lenses-timeline"
            type="range"
            min={0}
            max={last}
            step={1}
            value={i}
            onChange={(e) => {
              setPlaying(false);
              setI(Number(e.target.value));
            }}
            aria-valuetext={frame.label}
          />
        </label>
        <strong className="lens-year" aria-live="polite">{frame.label}</strong>
        <span className="muted">
          {shown.length} points from {accs.length} investigations
          {outOfView ? ` (${outOfView} outside the drawn axes)` : ""}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Oxygen and pressure of PSI test points up to ${frame.label}`}>
        {X_TICKS.map((x) => (
          <g key={`x${x}`}>
            <line x1={sx(x)} x2={sx(x)} y1={M.t} y2={H - M.b} className="lens-grid" />
            <text x={sx(x)} y={H - M.b + 16} textAnchor="middle" className="lens-tick">{Math.round(x * 100)}</text>
          </g>
        ))}
        {Y_TICKS.map((y) => (
          <g key={`y${y}`}>
            <line x1={M.l} x2={W - M.r} y1={sy(y)} y2={sy(y)} className="lens-grid" />
            <text x={M.l - 6} y={sy(y) + 4} textAnchor="end" className="lens-tick">{y}</text>
          </g>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" className="lens-axis">Oxygen (% of the gas)</text>
        <text x={14} y={(M.t + H - M.b) / 2} textAnchor="middle" transform={`rotate(-90 14 ${(M.t + H - M.b) / 2})`} className="lens-axis">Pressure (kPa, log scale)</text>
        <path d={bandPath} className="lens-band">
          <title>{band.label}</title>
        </path>
        <text x={sx(Math.min(...band.vertices.map((v) => v.o2)))} y={sy(Math.max(...band.vertices.map((v) => v.kpa))) - 6} className="lens-band-label">{band.label}</text>
        {shown.filter(inside).map((p, k) => (
          <circle key={`${p.acc}-${k}`} cx={sx(p.o2)} cy={sy(p.kpa)} r={2.6} className="lens-pt">
            <title>{`${names[p.acc] ?? p.acc}: ${Math.round(p.o2 * 1000) / 10} % O2, ${Math.round(p.kpa * 10) / 10} kPa, ${p.gravity.join(" / ").replaceAll("_", " ") || "gravity not stated"}`}</title>
          </circle>
        ))}
        {fm2.map((p, k) => (
          <circle key={`fm2-${k}`} cx={sx(p.o2)} cy={sy(p.kpa)} r={5} className="lens-fm2">
            <title>{`FM2 planned, not in PSI: ${Math.round(p.o2 * 1000) / 10} % O2, ${Math.round(p.kpa * 10) / 10} kPa`}</title>
          </circle>
        ))}
        {fm2.length > 0 && (
          <text x={sx(Math.max(...fm2.map((p) => p.o2))) + 8} y={sy(fm2[0].kpa) + 4} className="lens-fm2-label">FM2: planned, not in PSI</text>
        )}
      </svg>
    </div>
  );
}
