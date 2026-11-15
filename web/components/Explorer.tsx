"use client";

import Link from "next/link";
import Term from "./Term";
import Tour from "./Tour";
import AskTarsBar from "./AskTarsBar";
import ToolsLine from "./ToolsLine";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import EnvelopeChart, { type DomainSeed, type LayerState } from "./EnvelopeChart";
import Results, { citationKey } from "./Results";
import { ControlsPanel, ScenarioNote, applyPreset, type TargetState } from "./TargetPanel";
import ScenarioStrip, { type Computed } from "./ScenarioStrip";
import GapDialog from "./GapDialog";
import { scenarioFacts } from "@/lib/scenarios";
import { stateFromTarget, toTarget, withRegimeAxis } from "@/lib/preset-apply";
import { setCurrentTarget } from "@/lib/tars/bridge";
import NavigatorPanel from "./NavigatorPanel";
import {
  buildEnvelopes,
  evaluate,
  locateTarget,
  parseConditionCsv,
  HABITAT_WINDOWS,
  REGIME_AXES,
  routesToEvidence,
  evidenceMap,
  type Blocker,
  type RegimeAxis,
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

export default function Explorer({ dataset }: { dataset: Dataset }) {
  const [state, setState] = useState<TargetState>(INITIAL);
  // The engine can count only human-verified values; the interface does not offer it.
  const verifiedOnly = false;
  const [highlight, setHighlight] = useState<string | null>(null);
  const [openAccession, setOpenAccession] = useState<string | null>(null);

  const benchRef = useRef<HTMLDivElement>(null);
  const viewKeys = useRef(false);
  const [gap, setGap] = useState<{ title: string; target: Target } | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [fs, setFs] = useState(false);
  const fsRef = useRef(false);
  fsRef.current = fs;
  const fsViaApi = useRef(false);
  const pendingScroll = useRef(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const scrollY = useRef(0);
  const enterFs = () => {
    scrollY.current = window.scrollY;
    setFs(true);
    setSheetOpen(false);
    try {
      void cardRef.current?.requestFullscreen?.().catch(() => {});
    } catch {
      /* the fixed overlay stands in */
    }
  };
  const exitFs = () => {
    setFs(false);
    try {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    } catch {
      /* nothing to exit */
    }
  };
  useEffect(() => {
    // Esc in the real Fullscreen API ends it by itself; Esc in the overlay is handled here.
    const onChange = () => {
      if (!document.fullscreenElement && fsRef.current && fsViaApi.current) setFs(false);
      fsViaApi.current = !!document.fullscreenElement;
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fsRef.current && !document.fullscreenElement) setFs(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);
  const wasFs = useRef(false);
  useEffect(() => {
    // Back from full screen: the page is where it was (the card left the flow while it was open).
    if (wasFs.current && !fs && !pendingScroll.current) requestAnimationFrame(() => window.scrollTo(0, scrollY.current));
    pendingScroll.current = false;
    wasFs.current = fs;
  }, [fs]);
  useEffect(() => {
    if (!fs) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [fs]);
  const overBench = useRef(false);
  // Keyboard: arrows move the target (left/right O2 0.5 %, up/down 1 kPa; Shift = x5). Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey) return;
      // Zoomed or full screen: the arrows belong to the view, and Alt+arrows move the target.
      if (e.altKey !== (viewKeys.current || fsRef.current)) return;
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
    if (t.continuous.o2_mole_fraction === undefined || t.continuous.pressure === undefined) console.warn("[pyrion] a route target leaves oxygen or pressure open; the controls keep their old value", accession);
    setState((st) => stateFromTarget(t, st));
  };
  /** A blocker's action: leave an axis open, or switch the regime (always shown as another regime, never a small step). */
  const applyAction = (action: NonNullable<Blocker["action"]>, accession: string) => {
    glow(accession);
    // Only regime axes can be left open or switched; continuous axes are never "left open" (the state always has a value).
    if (!(REGIME_AXES as readonly string[]).includes(action.axis)) return;
    setState((st) => withRegimeAxis(st, action.axis as RegimeAxis, action.kind === "leave_open" ? undefined : action.to));
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
  const [overlay, setOverlay] = useState<{ o2: number; pressure: number; label: string }[] | null>(null);
  useEffect(() => {
    const on = (e: Event) => setOverlay((e as CustomEvent<{ o2: number; pressure: number; label: string }[] | null>).detail);
    window.addEventListener("pyrion:overlay", on);
    return () => window.removeEventListener("pyrion:overlay", on);
  }, []);
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

  // Scenario tiles: every number is the engine's evaluate() on the real records (other axes open as the preset leaves them).
  const tiles = useMemo(() => {
    const run = (st: TargetState): Computed | null => {
      try {
        const t = toTarget(st);
        const evaluation = evaluate(records, t, options);
        return { evaluation, facts: scenarioFacts(evaluation), status: envelopeStatus(evaluation, locateTarget(t, envelopeSet), t) };
      } catch {
        return null;
      }
    };
    const stateOf = (id: string) => {
      const v = PRESET_VIEWS.find((p) => p.preset.id === id);
      return v ? applyPreset(INITIAL, v) : null;
    };
    const iss = stateOf("iss-cabin-air");
    const lunar = stateOf("challenge-lunar-base");
    const nesc = stateOf("nesc-8.2psia-34o2-lunar");
    return {
      iss: iss ? run(iss) : null,
      lunar: lunar ? run(lunar) : null,
      nesc: nesc ? run(nesc) : null,
      // The same atmosphere with microgravity swapped in: what the tested regime would say.
      nescMicro: nesc ? run({ ...nesc, regime: { ...nesc.regime, gravity_regime: "microgravity" }, gravityLevel: undefined }) : null,
    };
  }, [records, options, envelopeSet]);
  const mine: Computed | null = result.evaluation && status ? { evaluation: result.evaluation, facts: scenarioFacts(result.evaluation), status } : null;

  // "Ask PYRION": the question was translated into a target by a model and checked by code.
  // Axes the question left open stay open; O2 and pressure it did not state keep their current value.
  useEffect(() => {
    setCurrentTarget(target);
  }, [target]);
  // TARS: "Show on the envelope" loads a target; a receipt link opens its card.
  const loadTarget = (t: Target) =>
    setState((st) => ({
      presetId: null,
      regime: { ...t.regime },
      o2: t.continuous.o2_mole_fraction ?? st.o2,
      pressure: t.continuous.pressure ?? st.pressure,
      gravityLevel: t.informational?.gravity_level,
      gravityNotCovered: t.informational?.gravity_not_covered,
    }));
  const loadRef = useRef(loadTarget);
  loadRef.current = loadTarget;
  useEffect(() => {
    const onTarget = (e: Event) => loadRef.current((e as CustomEvent<Target>).detail);
    const onOpen = (e: Event) => {
      const a = (e as CustomEvent<string>).detail;
      setOpenAccession(a);
      requestAnimationFrame(() => document.getElementById(`res-${a}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
    };
    window.addEventListener("pyrion:target", onTarget);
    window.addEventListener("pyrion:open", onOpen);
    return () => {
      window.removeEventListener("pyrion:target", onTarget);
      window.removeEventListener("pyrion:open", onOpen);
    };
  }, []);

  return (
    <>
      <AskTarsBar />
      <Tour />
      <ScenarioStrip
        state={state}
        iss={tiles.iss}
        lunar={tiles.lunar}
        nesc={tiles.nesc}
        nescMicro={tiles.nescMicro}
        withData={dataset.stats.accessions}
        mine={mine}
        investigations={dataset.investigations}
        onPick={(id) => {
          const v = PRESET_VIEWS.find((p) => p.preset.id === id);
          if (v) setState((st) => applyPreset(st, v));
        }}
        onGap={(which) => {
          const id = which === "lunar" ? "challenge-lunar-base" : "nesc-8.2psia-34o2-lunar";
          const v = PRESET_VIEWS.find((p) => p.preset.id === id);
          if (which === "mine") setGap({ title: "your condition", target });
          else if (v) setGap({ title: v.short, target: toTarget(applyPreset(INITIAL, v)) });
        }}
        onCustom={() => {
          setState((st) => ({ ...st, presetId: null }));
          document.querySelector(".nav-left")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }}
      />
      <ToolsLine />
      <ScenarioNote state={state} />
      {gap && <GapDialog title={gap.title} target={gap.target} onClose={() => setGap(null)} />}

      <div
        className="nav-grid"
        ref={benchRef}
        onPointerEnter={() => (overBench.current = true)}
        onPointerLeave={() => (overBench.current = false)}
      >
        <div className="nav-left">
          <ControlsPanel state={state} onChange={setState} />
        </div>

        <section data-help="chart-card" ref={cardRef} className={`card chart-card nav-center${fs ? " fs-on" : ""}`} aria-labelledby="envelope-h">
          <div className="fs-main">
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
              overlay={overlay}
              status={status}
              seed={SEED}
              highlight={highlight}
              onPointSelect={(a) => {
                setOpenAccession(a);
                if (fsRef.current) {
                  pendingScroll.current = true;
                  exitFs();
                  requestAnimationFrame(() => document.getElementById(`res-${a}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
                }
              }}
              onTargetPick={(o2, pressure) => setState((s) => ({ ...s, presetId: null, o2, pressure }))}
              openAxes={result.evaluation?.openRegimeAxes ?? []}
              evidence={emap?.map ?? null}
              evidenceKey={emap?.key}
              fs={fs}
              onToggleFs={fs ? exitFs : enterFs}
              onZoomedChange={(z) => {
                viewKeys.current = z;
              }}
            />
          ) : (
            <p className="banner">The engine rejected this target: {result.error}</p>
          )}
          {/* Slot for the evidence-map layer (N5): drawn inside the chart when the engine's evidence map exists. */}
          <div className="evidence-map-slot" data-slot="evidence-map" />
          </div>
          {fs && status && result.evaluation && counts && (
            <aside className={`fs-side${sheetOpen ? " open" : ""}`} aria-label="Where the evidence is">
              <button data-help="fs-evidence-handle" type="button" className="fs-handle" aria-expanded={sheetOpen} onClick={() => setSheetOpen((o) => !o)}>
                Where the evidence is {sheetOpen ? "▾" : "▴"}
              </button>
              <div className="fs-side-body">
                <NavigatorPanel
                  evaluation={result.evaluation}
                  investigations={dataset.investigations}
                  status={status}
                  targetLabel={view ? view.short : "your condition"}
                  counts={counts}
                  pinned={pinned && pinnedStatus ? { label: pinned.label, headline: pinnedStatus.headline, tone: pinnedStatus.tone } : null}
                  onPin={() => setPinned({ state, label: view ? view.short : "Custom target" })}
                  onClearPin={() => setPinned(null)}
                  routes={routes}
                  onApplyRoute={(t, accession) => applyRoute(t, accession)}
                  onHover={setHighlight}
                  onOpen={(a) => {
                    pendingScroll.current = true;
                    exitFs();
                    setOpenAccession(a);
                    requestAnimationFrame(() => document.getElementById(`res-${a}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
                  }}
                />
                {/* Slot for TARS Support and the TARS chat (next phase). Renders nothing yet. */}
                <section className="fs-tars" data-slot="tars" hidden>
                  <h3>TARS</h3>
                  <p>Coming in the next phase</p>
                </section>
              </div>
            </aside>
          )}
        </section>

        <div className="nav-right">
          {status && result.evaluation && counts && (
            <NavigatorPanel
              evaluation={result.evaluation}
              investigations={dataset.investigations}
              status={status}
              targetLabel={view ? view.short : "your condition"}
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
            Not comparable in PSI. <Link data-help="bridge-teaser-link" href="/bridge">See the transfer hypothesis →</Link>
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
