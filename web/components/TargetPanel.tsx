"use client";

import { useId } from "react";
import { PRESETS, type Preset } from "@/lib/presets";
import { DILUENTS, FUEL_PHASES, GRAVITY_REGIMES, type Target } from "@/lib/types";
import { DILUENT_LABEL, GRAVITY_LABEL, fmt, kpaToPsi } from "@/lib/units";

interface Props {
  target: Target;
  presetId: string;
  onPreset: (p: Preset) => void;
  onChange: (t: Target) => void;
}

export default function TargetPanel({ target, presetId, onPreset, onChange }: Props) {
  const id = useId();
  const preset = PRESETS.find((p) => p.id === presetId);
  const set = <K extends keyof Target>(k: K, v: Target[K]) => onChange({ ...target, [k]: v });

  const o2pct = Math.round(target.o2_mole_fraction * 1000) / 10;

  return (
    <section className="panel" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="panel-title">
        Target condition
      </h2>

      <div className="presets" role="radiogroup" aria-label="Presets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === presetId}
            className="preset"
            onClick={() => onPreset(p)}
          >
            <span className="preset-label">{p.label}</span>
            <span className="preset-summary">{p.summary}</span>
          </button>
        ))}
      </div>

      <div className="source-note">
        {preset ? (
          <>
            {preset.source.quote && <q>{preset.source.quote}</q>}{" "}
            <a href={preset.source.url} target="_blank" rel="noreferrer">
              {preset.source.cite}
            </a>
            {preset.assumption && <span className="assumption"> {preset.assumption}</span>}
          </>
        ) : (
          <span>Custom values entered below.</span>
        )}
      </div>

      <div className="fields">
        <label className="field">
          <span>Gravity regime</span>
          <select
            value={target.gravity_regime}
            onChange={(e) => set("gravity_regime", e.target.value as Target["gravity_regime"])}
          >
            {GRAVITY_REGIMES.map((g) => (
              <option key={g} value={g}>
                {GRAVITY_LABEL[g]}
              </option>
            ))}
          </select>
        </label>

        {target.gravity_regime === "partial_gravity" && (
          <label className="field">
            <span>Gravity level (g)</span>
            <input
              type="number"
              min={0.01}
              max={0.99}
              step={0.01}
              value={target.gravity_level ?? ""}
              onChange={(e) => set("gravity_level", e.target.value === "" ? undefined : Number(e.target.value))}
            />
          </label>
        )}

        <label className="field">
          <span>Fuel phase</span>
          <select value={target.fuel_phase} onChange={(e) => set("fuel_phase", e.target.value as Target["fuel_phase"])}>
            {FUEL_PHASES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Diluent</span>
          <select value={target.diluent} onChange={(e) => set("diluent", e.target.value as Target["diluent"])}>
            {DILUENTS.map((d) => (
              <option key={d} value={d}>
                {DILUENT_LABEL[d]}
              </option>
            ))}
          </select>
        </label>

        <div className="field field-wide">
          <label htmlFor={`${id}-o2`}>O₂ mole fraction (%)</label>
          <div className="range-row">
            <input
              id={`${id}-o2r`}
              type="range"
              min={10}
              max={100}
              step={0.5}
              value={o2pct}
              aria-label="O₂ mole fraction slider (%)"
              onChange={(e) => set("o2_mole_fraction", Number(e.target.value) / 100)}
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
                if (Number.isFinite(v) && v >= 0 && v <= 100) set("o2_mole_fraction", v / 100);
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
              value={Math.round(target.pressure * 10) / 10}
              aria-label="Pressure slider (kPa)"
              onChange={(e) => set("pressure", Number(e.target.value))}
            />
            <input
              id={`${id}-p`}
              type="number"
              min={1}
              max={1000}
              step={0.1}
              value={Math.round(target.pressure * 10) / 10}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) set("pressure", v);
              }}
            />
          </div>
          <span className="hint">= {fmt(kpaToPsi(target.pressure), 2)} psia</span>
        </div>
      </div>
    </section>
  );
}
