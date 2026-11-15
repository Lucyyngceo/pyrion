"use client";

import Link from "next/link";
import Term from "./Term";
import Tour from "./Tour";
import AskBox from "./AskBox";
import type { ParsedTarget } from "@/lib/ask-core";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import EnvelopeChart, { type DomainSeed, type LayerState } from "./EnvelopeChart";
import Results, { citationKey } from "./Results";
import { ControlsPanel, PresetsPanel, applyPreset, type TargetState } from "./TargetPanel";
import NavigatorPanel from "./NavigatorPanel";
import {
  buildEnvelopes,
  evaluate,
  locateTarget,
  parseConditionCsv,
  HABITAT_WINDOWS,
  routesToEvidence,
  evidenceMap,
  type Blocker,
  type EvidenceMap,
  type ConditionRecord,
  type Evaluation,
  type Target,
} from "@/lib/engine";
import { colorMap, sortEnvelopes, targetRegimeName } from "@/lib/layers";
import TextVsPhysics from "./TextVsPhysics";
import { PRESET_VIEWS } from "@/lib/presets";
import { envelopeStatus } from "@/lib/summary";
import type { Dataset } from "@/lib/types";

const INITIAL: TargetState = applyPreset(
  { presetId: null, regime: {}, o2: 0.21, pressure: 101.325 },
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
  // A gravity level is informational in the engine's target: shown, never compared.
  const informational: NonNullable<Target["informational"]> = {};
  if (s.regime.gravity_regime === "partial_gravity" && s.gravityLevel !== undefined && Number.isFinite(s.gravityLevel)) informational.gravity_level = s.gravityLevel;
  if (s.gravityNotCovered) informational.gravity_not_covered = s.gravityNotCovered;
  return Object.keys(informational).length > 0 ? { regime, continuous, informational } : { regime, continuous };
}

export default function Explorer({ dataset }: { dataset: Dataset }) {
  const [state, setState] = useState<TargetState>(INITIAL);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [openAccession, setOpenAccession] = useState<string | null>(null);

  const benchRef = useRef<HTMLDivElement>(null);
  const overBench = useRef(false);
  // Keyboard: arrows move the target (left/right O2 0.5 %, up/down 1 kPa; Shift = x5). Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!overBench.current && !benchRef.current?.contains(document.activeElement)) return;
      const k = e.shiftKey ? 5 : 1;
      let dO2 = 0;
      let dP = 0;
      if (e.key === "ArrowLeft") dO2 = -0.005 * k;
      else if (e.key === "ArrowRight") dO2 = 0.005 * k;
      else if (e.key === "ArrowUp") dP = 1 * k;
      else if (e.key === "ArrowDown") dP = -1 * k;
      else return;
      e.preventDefault();
      setState((st) => ({
        ...st,
        presetId: null,
        o2: Math.min(HABITAT_WINDOWS.o2_mole_fraction[1], Math.max(HABITAT_WINDOWS.o2_mole_fraction[0], Math.round((st.o2 + dO2) * 1000) / 1000)),
        pressure: Math.min(HABITAT_WINDOWS.pressure[1], Math.max(HABITAT_WINDOWS.pressure[0], Math.round((st.pressure + dP) * 10) / 10)),
      }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The command palette selects presets through an event (no page reload).
  useEffect(() => {
    const on = (e: Event) => {
      const v = PRESET_VIEWS.find((p) => p.preset.id === (e as CustomEvent<string>).detail);
      if (v) setState((s) => applyPreset(s, v));
    };
    window.addEventListener("pyrion:preset", on);
    return () => window.removeEventListener("pyrion:preset", on);
  }, []);

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

  // N2/N5: the evidence map for the selected regime. Recomputed only when the regime (or the records) change, never on a slider drag,
  // and off the main task so a heavy map cannot freeze the page; the previous map stays on screen meanwhile.
  const regimeKey = JSON.stringify(target.regime);
  const [emap, setEmap] = useState<{ map: EvidenceMap; key: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      try {
        const map = evidenceMap(records, JSON.parse(regimeKey), { o2: [0.1, 0.5, 60], pressure: [20, 320, 80] }, options);
        if (!cancelled) setEmap({ map, key: regimeKey });
      } catch (e) {
        console.warn("[pyrion] evidence map unavailable", e);
      }
    };
    // A short timer lets the verdict render first; the previous map stays on screen until this one is ready.
    const id = window.setTimeout(run, 60);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [records, regimeKey, options]);

  // The marker travels (the chart animates the move; reduced motion makes it instant), the controls follow, and the verdict and
  // the investigation's card glow softly. Used by route buttons and by the blockers' action buttons.
  const glow = (accession: string) => {
    for (const el of [document.querySelector(".nav-verdict"), document.getElementById(`res-${accession}`)]) {
      el?.classList.remove("glow");
      void (el as HTMLElement | null)?.offsetWidth;
      el?.classList.add("glow");
      window.setTimeout(() => el?.classList.remove("glow"), 1600);
    }
  };
  const applyRoute = (t: Target, accession: string) => {
    glow(accession);
    setState((st) => ({
      presetId: null,
      regime: { ...t.regime },
      o2: t.continuous.o2_mole_fraction ?? st.o2,
      pressure: t.continuous.pressure ?? st.pressure,
      gravityLevel: t.informational?.gravity_level,
      gravityNotCovered: t.informational?.gravity_not_covered,
    }));
  };
  /** A blocker's action: leave an axis open, or switch the regime (always shown as another regime, never a small step). */
  const applyAction = (action: NonNullable<Blocker["action"]>, accession: string) => {
    glow(accession);
    setState((st) => {
      const regime = { ...st.regime } as Record<string, string | undefined>;
      if (action.kind === "leave_open") delete regime[action.axis];
      else if (action.to !== undefined) regime[action.axis] = action.to;
      return { ...st, presetId: null, regime: regime as TargetState["regime"], gravityNotCovered: undefined };
    });
  };

  // N1: the engine's routes to evidence, recomputed whenever the target changes.
  const routes = useMemo(() => {
    try {
      return routesToEvidence(records, target, options);
    } catch {
      return null;
    }
  }, [records, target, options]);

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
  const verifiedCount = useMemo(() => records.filter((r) => r.status === "verified").length, [records]);

  // "Ask PYRION": the question was translated into a target by a model and validated by code.
  // Axes the question left open stay open; O2 and pressure it did not state keep their current value.
  const applyAsked = (p: ParsedTarget) =>
    setState((st) => ({
      presetId: null,
      regime: { ...p.target.regime },
      o2: p.target.continuous.o2_mole_fraction ?? st.o2,
      pressure: p.target.continuous.pressure ?? st.pressure,
      gravityLevel: p.target.informational?.gravity_level,
      gravityNotCovered: p.target.informational?.gravity_not_covered,
    }));

  return (
    <>
      <AskBox onTarget={applyAsked} />
      <p className="tour-link small">
        <button type="button" className="linklike" onClick={() => window.dispatchEvent(new Event("pyrion:tour"))}>
          Take the 3-step tour
        </button>
      </p>
      <Tour />

      <div
        className="nav-grid"
        ref={benchRef}
        onPointerEnter={() => (overBench.current = true)}
        onPointerLeave={() => (overBench.current = false)}
      >
        <div className="nav-left">
          <PresetsPanel state={state} onChange={setState} />
          <ControlsPanel state={state} onChange={setState} verifiedOnly={verifiedOnly} onVerifiedOnly={setVerifiedOnly} verifiedCount={verifiedCount} />
        </div>

        <section className="card chart-card nav-center" aria-labelledby="envelope-h">
          <div className="card-head">
            <h2 id="envelope-h">The evidence envelope</h2>
            <p className="muted small">
              Each shaded area is the <Term k="envelope">envelope</Term> of one regime: the oxygen and pressure PSI tested. Click, drag or use the arrow keys to move your
              condition.
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
              evidence={emap?.map ?? null}
              evidenceKey={emap?.key}
            />
          ) : (
            <p className="banner">The engine rejected this target: {result.error}</p>
          )}
          {/* Slot for the evidence-map layer (N5): drawn inside the chart when the engine's evidence map exists. */}
          <div className="evidence-map-slot" data-slot="evidence-map" />
        </section>

        <div className="nav-right">
          {status && result.evaluation && counts && (
            <NavigatorPanel
              evaluation={result.evaluation}
              investigations={dataset.investigations}
              status={status}
              targetLabel={view ? view.short : "custom condition"}
              counts={counts}
              pinned={pinned && pinnedStatus ? { label: pinned.label, headline: pinnedStatus.headline, tone: pinnedStatus.tone } : null}
              onPin={() => setPinned({ state, label: view ? view.short : "Custom target" })}
              onClearPin={() => setPinned(null)}
              routes={routes}
              onApplyRoute={(t, accession) => applyRoute(t, accession)}
              onHover={setHighlight}
              onOpen={(a) => {
                setOpenAccession(a);
                requestAnimationFrame(() => document.getElementById(`res-${a}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
              }}
            />
          )}
        </div>
      </div>

      {target.regime.gravity_regime === "partial_gravity" && (
        <aside className="bridge-teaser" role="note">
          <span className="hyp-tag small-tag">HYPOTHESIS</span>
          <span>
            Not comparable in PSI. <Link href="/bridge">See the transfer hypothesis →</Link>
          </span>
        </aside>
      )}

      {result.evaluation && (
        <Results
          evaluation={result.evaluation}
          dataset={dataset}
          lookup={lookup}
          openAccession={openAccession}
          onOpenAccession={setOpenAccession}
          onHover={setHighlight}
          onAction={applyAction}
        />
      )}

      {result.evaluation && (
        <TextVsPhysics
          evaluation={result.evaluation}
          investigations={dataset.investigations}
          query={`${view ? view.preset.description : "Custom target."} ${targetRegimeName(target.regime)}`}
          onHover={setHighlight}
          embedding={
            dataset.embedding && deferred.presetId && dataset.embedding.rankings[deferred.presetId]
              ? { label: `embedding search (${dataset.embedding.model}${dataset.embedding.license ? `, ${dataset.embedding.license}` : ""})`, ranking: dataset.embedding.rankings[deferred.presetId] }
              : undefined
          }
        />
      )}
    </>
  );
}
