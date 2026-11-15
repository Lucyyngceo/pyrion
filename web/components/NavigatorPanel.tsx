"use client";

import { useState } from "react";
import { GROUND_INVENTORY_URL, GROUND_NOTE, levelPhrase } from "@/lib/plain";
import type { ExtrapolationLevel } from "@/lib/engine";
import { memo } from "react";
import type { ClusterVerdict, Evaluation, Route, RouteSet, Target } from "@/lib/engine";
import { valueLabel } from "@/lib/units";
import { plainVerdict, regimeWords } from "@/lib/plain";
import type { EnvelopeStatus } from "@/lib/summary";
import type { Investigation } from "@/lib/types";
import StatusSymbol from "./StatusSymbol";
import Term from "./Term";
import VerdictRing from "./VerdictRing";

interface Props {
  evaluation: Evaluation;
  investigations: Investigation[];
  status: EnvelopeStatus;
  targetLabel: string;
  counts: Record<string, number>;
  pinned: { label: string; headline: string; tone: string } | null;
  onPin: () => void;
  onClearPin: () => void;
  onHover: (accession: string | null) => void;
  onOpen: (accession: string) => void;
  /** The engine's routes to evidence for the current target. */
  routes: RouteSet | null;
  /** Move the condition to a route's target (sliders and selects follow). */
  onApplyRoute: (target: Target, accession: string) => void;
}

const doiUrl = (d: string) => `https://doi.org/${d}`;

const switchLabel = (r: Route) => {
  const to = r.changes.filter((c) => c.kind === "switch_regime").map((c) => valueLabel(String(c.to)));
  return to.length ? to.join(" · ") : "that regime";
};

const CHIP_LEVEL: Record<ExtrapolationLevel, string> = {
  combination: "untested combination",
  just_outside: "just outside",
  outside: "outside",
  far_outside: "far outside",
};

function RouteItem({ r, inv, level, onHover, onOpen, button, onApply }: { r: Route; inv: Investigation | undefined; level?: ExtrapolationLevel; onHover: (a: string | null) => void; onOpen: (a: string) => void; button: string; onApply: () => void }) {
  const regime = r.kind === "different_regime";
  const full = `${level ? `Extrapolation — ${levelPhrase(level)}. ` : ""}${r.sentence}`;
  return (
    <li className="route" onPointerEnter={() => onHover(r.accession)} onPointerLeave={() => onHover(null)}>
      <div className="route-head">
        <StatusSymbol level={regime ? "off" : "caution"} size={10} />
        <button data-help="route-name" type="button" className="linklike where-name" onClick={() => onOpen(r.accession)} title={inv?.title}>
          {r.accession} · {inv?.acronym}
        </button>
        {inv?.doi && (
          <a data-help="route-doi" className="small" href={doiUrl(inv.doi)} target="_blank" rel="noreferrer">
            doi
          </a>
        )}
        <span data-help="route-chip" className={`route-chip${regime ? " chip-regime" : ""}`} title={regime ? "Different regime: not comparable" : level ? `Extrapolation — ${levelPhrase(level)}` : "Insufficient evidence: values left open"}>
          {regime ? "Other regime" : level ? CHIP_LEVEL[level] : "Insufficient"}
        </span>
        <button data-help="take-me-there" type="button" className={`take-btn take-inline${regime ? " take-regime" : ""}`} onClick={onApply}>
          {button}
        </button>
      </div>
      <p data-help="route-sentence" className="where-text route-text" tabIndex={0} title={full}>
        {full}
      </p>
    </li>
  );
}

/** Right column: the verdict, and where the evidence is. */
function NavigatorPanel({ evaluation, investigations, status, targetLabel, counts, pinned, onPin, onClearPin, onHover, onOpen, routes, onApplyRoute }: Props) {
  const inv = new Map(investigations.map((i) => [i.accession, i]));
  const clusters = new Map([...evaluation.ranked, ...evaluation.unranked].map((c) => [`${c.accession}|${c.clusterKey}`, c]));
  const near = evaluation.investigations
    .filter((i) => i.verdict === "APPLICABLE")
    .map((i) => ({ iv: i, c: clusters.get(`${i.accession}|${i.decidingCluster}`) as ClusterVerdict | undefined }))
    .toSorted((a, b) => (a.iv.verdict === b.iv.verdict ? 0 : a.iv.verdict === "APPLICABLE" ? -1 : 1) || (a.c?.rank ?? 1e9) - (b.c?.rank ?? 1e9));
  const SHOWN = 5;
  const [more, setMore] = useState<Record<string, boolean>>({});
  const upto = (key: string, n: number) => (more[key] ? n : SHOWN);
  const moreBtn = (key: string, n: number) =>
    n > SHOWN && (
      <button data-help="route-more" type="button" className="linklike small more-btn" aria-expanded={!!more[key]} onClick={() => setMore((m) => ({ ...m, [key]: !m[key] }))}>
        {more[key] ? "Show fewer" : `+ ${n - SHOWN} more`}
      </button>
    );
  // Extrapolating investigations, and how far outside the tested data each is (never a pass: a distance only).
  const levelOf = new Map<string, ExtrapolationLevel>();
  const levelCounts: Partial<Record<ExtrapolationLevel, number>> = {};
  for (const i of evaluation.investigations) {
    if (i.verdict === "EXTRAPOLATION" && i.extrapolationLevel) {
      levelOf.set(i.accession, i.extrapolationLevel);
      levelCounts[i.extrapolationLevel] = (levelCounts[i.extrapolationLevel] ?? 0) + 1;
    }
  }
  const steps = routes ? routes.routes.filter((r) => r.kind !== "different_regime") : [];
  const other = routes ? routes.routes.filter((r) => r.kind === "different_regime") : [];

  return (
    <>
      <section data-help="verdict-panel" className="card nav-verdict" aria-label="Verdict">
        <div className={`outcome outcome-${status.tone}`} role="status" aria-live="polite">
          <div className="outcome-kicker">Result for {targetLabel}</div>
          <div data-help="verdict-headline" className="outcome-head" key={status.headline}>
            {status.headline}
          </div>
          <p className="outcome-detail" key={status.detail}>
            {status.detail}
          </p>
          {evaluation.target.regime.gravity_regime === "normal_gravity" && (
            <p data-help="ground-note" className="outcome-detail ground-note small">
              {GROUND_NOTE} Inventory:{" "}
              <a data-help="ground-note-link" href={GROUND_INVENTORY_URL} target="_blank" rel="noreferrer">
                extraction/ground_tests_inventory.md
              </a>
              .
            </p>
          )}
          <div className="compare">
            {pinned ? (
              <>
                <span className={`compare-chip tone-${pinned.tone}`}>
                  {pinned.label}: {pinned.headline.toLowerCase()}
                </span>
                <button data-help="pin-clear" type="button" className="linklike small" onClick={onClearPin}>
                  Clear
                </button>
              </>
            ) : (
              <button data-help="pin-compare" type="button" className="pin-btn" onClick={onPin}>
                Pin to compare
              </button>
            )}
          </div>
        </div>
        <VerdictRing counts={counts} of={investigations.length} levels={levelCounts} />
      </section>

      <section data-help="evidence-panel" className="card nav-evidence" aria-labelledby="where-h">
        <h2 id="where-h" className="panel-title">
          Where the evidence is
        </h2>

        {near.length > 0 && (
          <>
            <h3 data-help="route-group-heading" className="where-sub">Already comparable ({near.length})</h3>
            <ul className="where-list">
              {near.slice(0, SHOWN).map(({ iv, c }) => {
                const i = inv.get(iv.accession);
                const pv = plainVerdict(iv.verdict, c);
                return (
                  <li key={iv.accession} onPointerEnter={() => onHover(iv.accession)} onPointerLeave={() => onHover(null)}>
                    <div className="where-head">
                      <StatusSymbol level="normal" size={11} />
                      <button data-help="comparable-name" type="button" className="linklike where-name" onClick={() => onOpen(iv.accession)}>
                        {iv.accession} {i?.acronym}
                      </button>
                      {i?.doi && (
                        <a data-help="comparable-doi" className="small" href={doiUrl(i.doi)} target="_blank" rel="noreferrer">
                          doi
                        </a>
                      )}
                    </div>
                    <p className="where-text">{pv.sentence}</p>
                  </li>
                );
              })}
            </ul>
            {near.length > SHOWN && <p className="muted small">and {near.length - SHOWN} more in the cards below.</p>}
          </>
        )}

        {routes && (
          <>
            {steps.length > 0 && (
              <>
                <h3 data-help="route-group-heading" className="where-sub">How to reach more evidence</h3>
                <p className="muted small">The smallest change that makes each investigation comparable. Nearest first.</p>
                <ul className="where-list">
                  {steps.slice(0, upto("steps", steps.length)).map((r) => (
                    <RouteItem key={r.accession} r={r} inv={inv.get(r.accession)} level={levelOf.get(r.accession)} onHover={onHover} onOpen={onOpen} button="Take me there" onApply={() => onApplyRoute(r.target, r.accession)} />
                  ))}
                </ul>
                {moreBtn("steps", steps.length)}
              </>
            )}
            {other.length > 0 && (
              <>
                <h3 data-help="route-group-heading" className="where-sub where-sub-regime">Tested only in another regime ({other.length})</h3>
                <p className="muted small">A different regime is not a small step: it changes the physics. Switching moves your condition to that regime.</p>
                <ul className="where-list where-list-regime">
                  {other.slice(0, upto("other", other.length)).map((r) => (
                    <RouteItem key={r.accession} r={r} inv={inv.get(r.accession)} onHover={onHover} onOpen={onOpen} button={`Switch to ${switchLabel(r)}`} onApply={() => onApplyRoute(r.target, r.accession)} />
                  ))}
                </ul>
                {moreBtn("other", other.length)}
              </>
            )}
            {routes.unreachable.length > 0 && (
              <>
                <h3 data-help="route-group-heading" className="where-sub">No route found ({routes.unreachable.length})</h3>
                <ul className="where-unreach small">
                  {routes.unreachable.slice(0, upto("unreach", routes.unreachable.length)).map((u) => (
                    <li key={u.accession}>
                      {u.reason.startsWith(u.accession) ? (
                        <button data-help="no-route-item" type="button" className="linklike" onClick={() => onOpen(u.accession)}>
                          {u.reason}
                        </button>
                      ) : (
                        <>
                          <button data-help="no-route-item" type="button" className="linklike" onClick={() => onOpen(u.accession)}>
                            {u.accession} {inv.get(u.accession)?.acronym}
                          </button>
                          <span className="muted">: {u.reason}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                {moreBtn("unreach", routes.unreachable.length)}
              </>
            )}
            {routes.notes.map((n) => (
              <p key={n} className="muted small">
                {n}
              </p>
            ))}
          </>
        )}
        {near.length === 0 && (!routes || routes.routes.length === 0) && (
          <p className="where-none">
            In this dataset, no investigation can be compared to this condition, and no single change reaches one. The cards below say why, one by one.
          </p>
        )}
      </section>
    </>
  );
}

export default memo(NavigatorPanel);
