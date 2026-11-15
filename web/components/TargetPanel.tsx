"use client";

import { useId } from "react";
import { HABITAT_WINDOWS, REGIME_AXES, REGIME_VALUES, type RegimeAxis } from "@/lib/engine";
import { PRESET_VIEWS, sourcesOf } from "@/lib/presets";
import { axisLabel, fmt, kpaToPsi, valueLabel } from "@/lib/units";

export type { TargetState } from "@/lib/preset-apply";
export { applyPreset } from "@/lib/preset-apply";
import { withRegimeAxis } from "@/lib/preset-apply";
import type { TargetState } from "@/lib/preset-apply";

interface PanelProps {
  state: TargetState;
  onChange: (s: TargetState) => void;
}

/** Under the strip: what the chosen scenario's source says, and what it leaves open. */
export function ScenarioNote({ state }: { state: TargetState }) {
  const preset = PRESET_VIEWS.find((v) => v.preset.id === state.presetId)?.preset;
  if (!preset) return null;
  return (
    <details className="scenario-note">
      <summary>About this scenario: sources and limits</summary>
      <p className="preset-desc">{preset.description}</p>
      <p className="cite">
        Sources:{" "}
        {sourcesOf(preset).map((src, i) => (
          <span key={`${src.id}|${src.quote}`}>
            {i > 0 && "; "}
            <a href={src.url} target="_blank" rel="noreferrer" title={`${src.quote} (${src.locator})`}>
              {src.identifier.split(" (")[0]}
            </a>
            <span className="muted">, {src.locator.split(",")[0]}</span>
          </span>
        ))}
        . Hover a link for the quoted sentence.
      </p>
      {preset.limits.length > 0 && (
        <ul className="limits">
          {preset.limits.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </details>
  );
}

const O2_WIN = { lo: HABITAT_WINDOWS.o2_mole_fraction[0] * 100, hi: HABITAT_WINDOWS.o2_mole_fraction[1] * 100 };
const P_WIN = { lo: HABITAT_WINDOWS.pressure[0], hi: HABITAT_WINDOWS.pressure[1] };

interface Mark {
  value: number;
  label: string;
  title: string;
}
const NESC = "NASA/TM-20260003925 (NESC)";
const PSI = 6.894757293168361;
const O2_MARKS: Mark[] = [
  { value: 21, label: "21 %", title: `ISS cabin air, 21 % O₂: ${NESC}, p. 18` },
  { value: 26.5, label: "26.5 %", title: `Exploration atmosphere A, 26.5 % O₂ at 10.2 psia: ${NESC}, p. 13` },
  { value: 34, label: "34 %", title: `Exploration atmosphere B, 34 % O₂ at 8.2 psia: ${NESC}, p. 13` },
];
const P_MARKS: Mark[] = [
  { value: 8.2 * PSI, label: "8.2 psia", title: `Exploration atmosphere B, 8.2 psia (56.5 kPa): ${NESC}, p. 13` },
  { value: 10.2 * PSI, label: "10.2 psia", title: `Exploration atmosphere A, 10.2 psia (70.3 kPa): ${NESC}, p. 13` },
  { value: 101.325, label: "ISS 14.7 psia", title: `ISS cabin, 14.7 psia (101.3 kPa): ${NESC}, p. 18` },
];

/** Labelled tick marks under a slider, at NASA conditions. Alternate labels sit on two rows so they never overlap. */
function Ticks({ min, max, marks }: { min: number; max: number; marks: Mark[] }) {
  return (
    <div className="ticks">
      {marks.map((m, i) => (
        <span key={m.label} className={`tick-mark tick-row-${i % 2}`} style={{ left: `${((m.value - min) / (max - min)) * 100}%` }} title={m.title}>
          <i />
          <b>{m.label}</b>
        </span>
      ))}
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface ControlsProps extends PanelProps {
}

/** Left column, below: "Your condition" first, then "Other axes". */
export function ControlsPanel({ state, onChange }: ControlsProps) {
  const id = useId();
  const preset = PRESET_VIEWS.find((v) => v.preset.id === state.presetId)?.preset;

  const setRegime = (axis: RegimeAxis, value: string) => {
    onChange(withRegimeAxis(state, axis, value === "" ? undefined : value));
  };
  const setNum = (k: "o2" | "pressure" | "gravityLevel", v: number | undefined) =>
    onChange({ ...state, presetId: null, [k]: v, ...(k === "gravityLevel" ? { gravityNotCovered: undefined } : {}) });

  const o2pct = Math.round(state.o2 * 1000) / 10;
  const p = Math.round(state.pressure * 10) / 10;
  const axisField = (axis: RegimeAxis) => {
    const fromPreset = preset?.regime[axis] !== undefined;
    return (
      <label key={axis} className="field">
        <span>
          {axisLabel(axis)} <span className={`origin ${fromPreset ? "origin-preset" : ""}`}>{fromPreset ? "preset" : "your choice"}</span>
        </span>
        <select value={state.regime[axis] ?? ""} onChange={(e) => setRegime(axis, e.target.value)}>
          <option value="">{axis === "gravity_regime" ? "open (not compared)" : "left open"}</option>
          {REGIME_VALUES[axis].map((v) => (
            <option key={v} value={v}>
              {valueLabel(v)}
            </option>
          ))}
        </select>
      </label>
    );
  };

  return (
    <section className="card nav-controls" id="target-panel" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="panel-title">
        Your condition
      </h2>

      <div className="field">
        <div className="field-head">
          <label htmlFor={`${id}-o2`}>Oxygen (O₂)</label>
          <span className="numbox">
            <input
              id={`${id}-o2`}
              type="number"
              min={O2_WIN.lo}
              max={O2_WIN.hi}
              step={0.5}
              value={o2pct}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (e.target.value !== "" && Number.isFinite(v)) setNum("o2", clamp(v, O2_WIN.lo, O2_WIN.hi) / 100);
              }}
            />
            <small>%</small>
          </span>
        </div>
        <input type="range" min={O2_WIN.lo} max={O2_WIN.hi} step={0.5} value={clamp(o2pct, O2_WIN.lo, O2_WIN.hi)} aria-label="Oxygen slider (%)" onChange={(e) => setNum("o2", Number(e.target.value) / 100)} />
        <Ticks min={O2_WIN.lo} max={O2_WIN.hi} marks={O2_MARKS} />
      </div>

      <div className="field">
        <div className="field-head">
          <label htmlFor={`${id}-p`}>Pressure</label>
          <span className="numbox">
            <input
              id={`${id}-p`}
              type="number"
              min={P_WIN.lo}
              max={P_WIN.hi}
              step={0.1}
              value={p}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (e.target.value !== "" && Number.isFinite(v)) setNum("pressure", clamp(v, P_WIN.lo, P_WIN.hi));
              }}
            />
            <small>kPa</small>
          </span>
        </div>
        <input type="range" min={P_WIN.lo} max={P_WIN.hi} step={0.5} value={clamp(p, P_WIN.lo, P_WIN.hi)} aria-label="Pressure slider (kPa)" onChange={(e) => setNum("pressure", Number(e.target.value))} />
        <Ticks min={P_WIN.lo} max={P_WIN.hi} marks={P_MARKS} />
        <span className="hint psia-line">= {fmt(kpaToPsi(state.pressure), 2)} psia</span>
      </div>

      {axisField("gravity_regime")}
      {state.regime.gravity_regime === "partial_gravity" && (
        <label className="field">
          <span>Gravity level (g)</span>
          <input
            type="number"
            min={0.01}
            max={0.99}
            step={0.01}
            value={state.gravityLevel ?? ""}
            onChange={(e) => setNum("gravityLevel", e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </label>
      )}

      <h3 className="axes-title">Other axes</h3>
      <p className="axes-hint muted small">Leave open unless you know it: fixing an axis an investigation did not record makes it insufficient evidence.</p>
      {REGIME_AXES.filter((a) => a !== "gravity_regime").map(axisField)}

    </section>
  );
}
