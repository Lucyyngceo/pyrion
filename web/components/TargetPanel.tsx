"use client";

import { useId } from "react";
import { REGIME_AXES, REGIME_VALUES, type RegimeAxis } from "@/lib/engine";
import { PRESET_VIEWS, sourcesOf, type PresetView } from "@/lib/presets";
import { axisLabel, fmt, kpaToPsi, valueLabel } from "@/lib/units";

export interface TargetState {
  presetId: string | null;
  regime: Partial<Record<RegimeAxis, string>>;
  o2: number;
  pressure: number;
  gravityLevel?: number;
}

interface Props {
  state: TargetState;
  onChange: (s: TargetState) => void;
  verifiedOnly: boolean;
  onVerifiedOnly: (v: boolean) => void;
  verifiedCount: number;
  /** The result for this target, shown right under the presets so it is visible with the chart. */
  result?: React.ReactNode;
}

/** Where the preset sits on the O2 x pressure plane (16-40 % O2, 40-110 kPa), as a tiny map. */
function PresetGlyph({ o2, pressure }: { o2?: number; pressure?: number }) {
  if (o2 === undefined || pressure === undefined) return null;
  const x = 4 + ((Math.min(0.4, Math.max(0.16, o2)) - 0.16) / 0.24) * 36;
  const y = 28 - ((Math.min(110, Math.max(40, pressure)) - 40) / 70) * 24;
  return (
    <svg className="preset-glyph" width="44" height="32" viewBox="0 0 44 32" aria-hidden="true">
      <rect x="0.5" y="0.5" width="43" height="31" rx="5" />
      <line x1={x} x2={x} y1="3" y2="29" />
      <line x1="3" x2="41" y1={y} y2={y} />
      <circle cx={x} cy={y} r="3.2" />
    </svg>
  );
}

export function applyPreset(state: TargetState, view: PresetView): TargetState {
  const p = view.preset;
  const regime: TargetState["regime"] = { ...state.regime };
  for (const [axis, v] of Object.entries(p.regime)) if (v) regime[axis as RegimeAxis] = v.value;
  return {
    presetId: p.id,
    regime,
    o2: p.continuous.o2_mole_fraction?.value ?? state.o2,
    pressure: p.continuous.pressure?.value ?? state.pressure,
    gravityLevel: p.continuous.gravity_level?.value,
  };
}

export default function TargetPanel({ state, onChange, verifiedOnly, onVerifiedOnly, verifiedCount, result }: Props) {
  const id = useId();
  const view = PRESET_VIEWS.find((v) => v.preset.id === state.presetId);
  const preset = view?.preset;

  const setRegime = (axis: RegimeAxis, value: string) => {
    const fromPreset = preset?.regime[axis] !== undefined;
    onChange({
      ...state,
      presetId: fromPreset ? null : state.presetId,
      regime: { ...state.regime, [axis]: value === "" ? undefined : value },
    });
  };
  const setNum = (k: "o2" | "pressure" | "gravityLevel", v: number | undefined) => onChange({ ...state, presetId: null, [k]: v });

  const o2pct = Math.round(state.o2 * 1000) / 10;
  const p = Math.round(state.pressure * 10) / 10;

  return (
    <section className="panel" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="panel-title">
        Target condition
      </h2>

      <div className="presets" role="radiogroup" aria-label="Presets">
        {PRESET_VIEWS.map((v) => (
          <button
            key={v.preset.id}
            type="button"
            role="radio"
            aria-checked={v.preset.id === state.presetId}
            className="preset"
            onClick={() => onChange(applyPreset(state, v))}
          >
            <PresetGlyph o2={v.preset.continuous.o2_mole_fraction?.value} pressure={v.preset.continuous.pressure?.value} />
            <span className="preset-label">{v.short}</span>
            <span className="preset-summary">{v.summary}</span>
          </button>
        ))}
      </div>

      {result}

      <div className="source-note">
        {preset ? (
          <>
            <p className="preset-desc">{preset.description}</p>
            <details className="preset-sources">
              <summary>
                Sources and limits ({sourcesOf(preset).map((s) => s.identifier.split(" (")[0]).filter((v, i, a) => a.indexOf(v) === i).join(", ")})
              </summary>
              {sourcesOf(preset).map((s) => (
                <p key={`${s.id}|${s.quote}`} className="cite">
                  <q>{s.quote}</q>{" "}
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.identifier}
                  </a>
                  <span className="muted">, {s.locator}</span>
                </p>
              ))}
              {preset.limits.length > 0 && (
                <ul className="limits">
                  {preset.limits.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
            </details>
          </>
        ) : (
          <p className="preset-desc">Custom target: values entered below.</p>
        )}
      </div>

      <div className="readout" aria-label="Target values">
        <div>
          <span className="ro-k">O₂</span>
          <span className="ro-v">
            {fmt(state.o2 * 100, 1)}
            <small>%</small>
          </span>
        </div>
        <div>
          <span className="ro-k">Pressure</span>
          <span className="ro-v">
            {fmt(state.pressure, 1)}
            <small>kPa</small>
          </span>
          <span className="ro-sub">{fmt(kpaToPsi(state.pressure), 2)} psia</span>
        </div>
        <div>
          <span className="ro-k">Gravity</span>
          <span className="ro-v ro-text">
            {state.regime.gravity_regime === "partial_gravity" && state.gravityLevel !== undefined
              ? `${fmt(state.gravityLevel, 2)} g`
              : state.regime.gravity_regime
                ? valueLabel(state.regime.gravity_regime)
                : "open"}
          </span>
        </div>
      </div>

      <div className="fields">
        {REGIME_AXES.map((axis) => {
          const fromPreset = preset?.regime[axis] !== undefined;
          return (
            <label key={axis} className="field">
              <span>
                {axisLabel(axis)} <span className={`origin ${fromPreset ? "origin-preset" : ""}`}>{fromPreset ? "preset" : "your choice"}</span>
              </span>
              <select value={state.regime[axis] ?? ""} onChange={(e) => setRegime(axis, e.target.value)}>
                <option value="">not stated</option>
                {REGIME_VALUES[axis].map((v) => (
                  <option key={v} value={v}>
                    {valueLabel(v)}
                  </option>
                ))}
              </select>
            </label>
          );
        })}

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

        <div className="field field-wide">
          <label htmlFor={`${id}-o2`}>O₂ mole fraction (%)</label>
          <div className="range-row">
            <input
              type="range"
              min={10}
              max={100}
              step={0.5}
              value={o2pct}
              aria-label="O₂ mole fraction slider (%)"
              onChange={(e) => setNum("o2", Number(e.target.value) / 100)}
            />
            <input
              id={`${id}-o2`}
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={o2pct}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (e.target.value !== "" && Number.isFinite(v) && v >= 0 && v <= 100) setNum("o2", v / 100);
              }}
            />
          </div>
        </div>

        <div className="field field-wide">
          <label htmlFor={`${id}-p`}>Pressure (kPa)</label>
          <div className="range-row">
            <input
              type="range"
              min={10}
              max={350}
              step={0.5}
              value={p}
              aria-label="Pressure slider (kPa)"
              onChange={(e) => setNum("pressure", Number(e.target.value))}
            />
            <input
              id={`${id}-p`}
              type="number"
              min={1}
              max={1000}
              step={0.1}
              value={p}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (e.target.value !== "" && Number.isFinite(v) && v > 0) setNum("pressure", v);
              }}
            />
          </div>
          <span className="hint">= {fmt(kpaToPsi(state.pressure), 2)} psia</span>
        </div>
      </div>

      <label className="toggle">
        <input type="checkbox" checked={verifiedOnly} onChange={(e) => onVerifiedOnly(e.target.checked)} />
        <span>
          Count only values verified by a person <span className="muted">({verifiedCount} so far)</span>
        </span>
      </label>
    </section>
  );
}
