"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import EnvelopeChart, { type DomainSeed, type LayerState } from "./EnvelopeChart";
import Results, { citationKey } from "./Results";
import TargetPanel, { applyPreset, type TargetState } from "./TargetPanel";
import {
  buildEnvelopes,
  evaluate,
  locateTarget,
  parseConditionCsv,
  type ConditionRecord,
  type Evaluation,
  type Target,
} from "@/lib/engine";
import { colorMap, sortEnvelopes, targetRegimeName } from "@/lib/layers";
import TextVsPhysics from "./TextVsPhysics";
import StatusSymbol from "./StatusSymbol";
import { PRESET_VIEWS } from "@/lib/presets";
import { envelopeStatus } from "@/lib/summary";
import type { Dataset } from "@/lib/types";

const INITIAL: TargetState = applyPreset(
  { presetId: null, regime: { fuel_phase: "liquid", diluent: "N2" }, o2: 0.21, pressure: 101.325 },
  PRESET_VIEWS[0],
);

const SEED: DomainSeed = {
  o2: PRESET_VIEWS.flatMap((v) => (v.preset.continuous.o2_mole_fraction ? [v.preset.continuous.o2_mole_fraction.value] : [])),
  pressure: PRESET_VIEWS.flatMap((v) => (v.preset.continuous.pressure ? [v.preset.continuous.pressure.value] : [])),
};

function toTarget(s: TargetState): Target {
  const regime: Target["regime"] = {};
  for (const [k, v] of Object.entries(s.regime)) if (v) regime[k as keyof Target["regime"]] = v;
  const continuous: Target["continuous"] = { o2_mole_fraction: s.o2, pressure: s.pressure };
  if (s.regime.gravity_regime === "partial_gravity" && s.gravityLevel !== undefined && Number.isFinite(s.gravityLevel)) {
    continuous.gravity_level = s.gravityLevel;
  }
  return { regime, continuous };
}

export default function Explorer({ dataset }: { dataset: Dataset }) {
  const [state, setState] = useState<TargetState>(INITIAL);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [openAccession, setOpenAccession] = useState<string | null>(null);

  // ?preset=<id> opens a preset directly (shareable link, e.g. ?preset=challenge-lunar-base).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("preset");
    const v = id ? PRESET_VIEWS.find((p) => p.preset.id === id) : undefined;
    if (v) setState((s) => applyPreset(s, v));
  }, []);

  // The engine parses the CSV text itself: same validation as its command-line tool.
  const records = useMemo<ConditionRecord[]>(
    () => dataset.files.flatMap((f) => parseConditionCsv(f.text, f.name, f.accession).records),
    [dataset.files],
  );
  const lookup = useMemo(() => {
    const m = new Map<string, ConditionRecord>();
    for (const r of records) {
      const k = citationKey(r);
      if (!m.has(k)) m.set(k, r);
    }
    return m;
  }, [records]);

  const options = useMemo(() => ({ minimumStatus: verifiedOnly ? ("verified" as const) : ("extracted" as const) }), [verifiedOnly]);
  const envelopeSet = useMemo(() => buildEnvelopes(records, options), [records, options]);
  const envelopes = useMemo(() => sortEnvelopes(envelopeSet.regimes), [envelopeSet]);
  const colors = useMemo(() => colorMap(envelopes), [envelopes]);

  const deferred = useDeferredValue(state);
  const target = useMemo(() => toTarget(deferred), [deferred]);
  const result = useMemo((): { evaluation: Evaluation | null; error: string | null } => {
    try {
      return { evaluation: evaluate(records, target, options), error: null };
    } catch (e) {
      return { evaluation: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [records, target, options]);
  const locations = useMemo(() => new Map(locateTarget(target, envelopeSet).map((l) => [l.key, l])), [target, envelopeSet]);

  // Layer emphasis comes from the engine's verdicts on the clusters of that regime combination.
  const layerState = useMemo(() => {
    const m = new Map<string, LayerState>();
    const ev = result.evaluation;
    if (!ev) return m;
    const rank: Record<LayerState, number> = { match: 0, open: 1, dim: 2 };
    for (const c of [...ev.ranked, ...ev.unranked]) {
      const st: LayerState =
        c.verdict === "APPLICABLE" || c.verdict === "EXTRAPOLATION" ? "match" : c.verdict === "INSUFFICIENT_EVIDENCE" ? "open" : "dim";
      const prev = m.get(c.clusterKey);
      if (!prev || rank[st] < rank[prev]) m.set(c.clusterKey, st);
    }
    return m;
  }, [result.evaluation]);

  const view = PRESET_VIEWS.find((v) => v.preset.id === deferred.presetId);

  // Verdict rail: the same target swept over pressure (O2 and regime fixed), so the viewer sees where the verdict changes.
  // Computed in small chunks after the main verdict has rendered, so it never delays the result.
  const [rail, setRail] = useState<{ pressure: number; tone: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    const STEPS = 36;
    const lo = 30;
    const hi = 130;
    const out: { pressure: number; tone: string }[] = [];
    let i = 0;
    let timer = 0;
    const work = () => {
      if (cancelled) return;
      const until = performance.now() + 12;
      while (i <= STEPS && performance.now() < until) {
        const p = lo + ((hi - lo) * i) / STEPS;
        const t = toTarget({ ...deferred, pressure: p });
        try {
          const ev = evaluate(records, t, options);
          out.push({ pressure: p, tone: envelopeStatus(ev, locateTarget(t, envelopeSet), t).tone });
        } catch {
          out.push({ pressure: p, tone: "unknown" });
        }
        i++;
      }
      if (i <= STEPS) timer = window.setTimeout(work, 0);
      else setRail(out);
    };
    timer = window.setTimeout(work, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deferred, records, options, envelopeSet]);

  // A pinned target stays on the chart for comparison; its verdict is recomputed with the same engine and options.
  const [pinned, setPinned] = useState<{ state: TargetState; label: string } | null>(null);
  const pinnedStatus = useMemo(() => {
    if (!pinned) return null;
    const t = toTarget(pinned.state);
    try {
      const ev = evaluate(records, t, options);
      const locs = locateTarget(t, envelopeSet);
      return envelopeStatus(ev, locs, t);
    } catch {
      return null;
    }
  }, [pinned, records, options, envelopeSet]);
  const status = result.evaluation ? envelopeStatus(result.evaluation, [...locations.values()], target) : null;
  const counts = result.evaluation?.counts.investigations;
  const total = counts ? counts.APPLICABLE + counts.EXTRAPOLATION + counts.INSUFFICIENT_EVIDENCE + counts.REGIME_BARRIER : 0;
  const verifiedCount = useMemo(() => records.filter((r) => r.status === "verified").length, [records]);

  return (
    <>
      <div className="workbench">
        <section className="card chart-card" aria-labelledby="envelope-h">
          <div className="card-head">
            <h2 id="envelope-h">The evidence envelope</h2>
            <p className="muted small">
              Measured PSI test points, one layer per regime (gravity · fuel phase · diluent). Click or drag to move the
              target.
            </p>
          </div>
          {status ? (
            <EnvelopeChart
              envelopes={envelopes}
              colors={colors}
              layerState={layerState}
              target={{ o2: deferred.o2, pressure: deferred.pressure }}
              targetLabel={view ? view.short : "Custom target"}
              rail={rail}
              pinned={pinned && pinnedStatus ? { o2: pinned.state.o2, pressure: pinned.state.pressure, label: pinned.label, tone: pinnedStatus.tone } : null}
              status={status}
              seed={SEED}
              highlight={highlight}
              onPointSelect={setOpenAccession}
              onTargetPick={(o2, pressure) => setState((s) => ({ ...s, presetId: null, o2, pressure }))}
              openAxes={result.evaluation?.openRegimeAxes ?? []}
            />
          ) : (
            <p className="banner">The engine rejected this target: {result.error}</p>
          )}
        </section>
        <aside className="card panel-card">
          <TargetPanel
            state={state}
            onChange={setState}
            verifiedOnly={verifiedOnly}
            onVerifiedOnly={setVerifiedOnly}
            verifiedCount={verifiedCount}
            result={
              status && (
                <div className={`outcome outcome-${status.tone}`} role="status" aria-live="polite">
                  <div className="outcome-kicker">Result for {view ? view.short : "custom target"}</div>
                  <div className="outcome-head" key={status.headline}>{status.headline}</div>
                  <p className="outcome-detail" key={status.detail}>{status.detail}</p>
                  <div className="compare">
                    {pinned && pinnedStatus ? (
                      <>
                        <span className={`compare-chip tone-${pinnedStatus.tone}`}>
                          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                            <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
                          </svg>
                          {pinned.label}: {pinnedStatus.headline.toLowerCase()}
                        </span>
                        <button type="button" className="linklike small" onClick={() => setPinned(null)}>
                          Clear
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="pin-btn"
                        onClick={() => setPinned({ state, label: view ? view.short : "Custom target" })}
                      >
                        Pin to compare
                      </button>
                    )}
                  </div>
                </div>
              )
            }
          />
          {counts && (
            <dl className="tally" aria-label="Verdict counts, by investigation">
              <div className="t-app">
                <dt>
                  <StatusSymbol level="normal" size={10} /> Applicable
                </dt>
                <dd>{counts.APPLICABLE}</dd>
                <i className="tally-bar" style={{ width: `${(100 * counts.APPLICABLE) / Math.max(1, total)}%` }} />
              </div>
              <div className="t-ext">
                <dt>
                  <StatusSymbol level="caution" size={10} /> Extrapolation
                </dt>
                <dd>{counts.EXTRAPOLATION}</dd>
                <i className="tally-bar" style={{ width: `${(100 * counts.EXTRAPOLATION) / Math.max(1, total)}%` }} />
              </div>
              <div className="t-ins">
                <dt>
                  <StatusSymbol level="standby" size={10} /> Insufficient evidence
                </dt>
                <dd>{counts.INSUFFICIENT_EVIDENCE}</dd>
                <i className="tally-bar" style={{ width: `${(100 * counts.INSUFFICIENT_EVIDENCE) / Math.max(1, total)}%` }} />
              </div>
              <div className="t-bar">
                <dt>
                  <StatusSymbol level="off" size={10} /> Not comparable
                </dt>
                <dd>{counts.REGIME_BARRIER}</dd>
                <i className="tally-bar" style={{ width: `${(100 * counts.REGIME_BARRIER) / Math.max(1, total)}%` }} />
              </div>
            </dl>
          )}
        </aside>
      </div>

      {result.evaluation && (
        <Results
          evaluation={result.evaluation}
          dataset={dataset}
          lookup={lookup}
          openAccession={openAccession}
          onOpenAccession={setOpenAccession}
          onHover={setHighlight}
        />
      )}

      {result.evaluation && (
        <TextVsPhysics
          evaluation={result.evaluation}
          investigations={dataset.investigations}
          query={`${view ? view.preset.description : "Custom target."} ${targetRegimeName(target.regime)}`}
          onHover={setHighlight}
        />
      )}
    </>
  );
}
