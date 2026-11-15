"use client";

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

function RouteItem({ r, inv, onHover, onOpen, button, onApply }: { r: Route; inv: Investigation | undefined; onHover: (a: string | null) => void; onOpen: (a: string) => void; button: string; onApply: () => void }) {
  return (
    <li onPointerEnter={() => onHover(r.accession)} onPointerLeave={() => onHover(null)}>
      <div className="where-head">
        <StatusSymbol level={r.kind === "different_regime" ? "off" : "caution"} size={11} />
        <button type="button" className="linklike where-name" onClick={() => onOpen(r.accession)}>
          {r.accession} {inv?.acronym}
        </button>
        {inv?.doi && (
          <a className="small" href={doiUrl(inv.doi)} target="_blank" rel="noreferrer">
            doi
          </a>
        )}
      </div>
      <p className="where-text">{r.sentence}</p>
      <button type="button" className={`take-btn${r.kind === "different_regime" ? " take-regime" : ""}`} onClick={onApply}>
        {button}
      </button>
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
  const steps = routes ? routes.routes.filter((r) => r.kind !== "different_regime") : [];
  const other = routes ? routes.routes.filter((r) => r.kind === "different_regime") : [];

  return (
    <>
      <section className="card nav-verdict" aria-label="Verdict">
        <div className={`outcome outcome-${status.tone}`} role="status" aria-live="polite">
          <div className="outcome-kicker">Result for {targetLabel}</div>
          <div className="outcome-head" key={status.headline}>
            {status.headline}
          </div>
          <p className="outcome-detail" key={status.detail}>
            {status.detail}
          </p>
          <div className="compare">
            {pinned ? (
              <>
                <span className={`compare-chip tone-${pinned.tone}`}>
                  {pinned.label}: {pinned.headline.toLowerCase()}
                </span>
                <button type="button" className="linklike small" onClick={onClearPin}>
                  Clear
                </button>
              </>
            ) : (
              <button type="button" className="pin-btn" onClick={onPin}>
                Pin to compare
              </button>
            )}
          </div>
        </div>
        <VerdictRing counts={counts} of={investigations.length} />
      </section>

      <section className="card nav-evidence" aria-labelledby="where-h">
        <h2 id="where-h" className="panel-title">
          Where the evidence is
        </h2>

        {near.length > 0 && (
          <>
            <h3 className="where-sub">Already comparable ({near.length})</h3>
            <ul className="where-list">
              {near.slice(0, SHOWN).map(({ iv, c }) => {
                const i = inv.get(iv.accession);
                const pv = plainVerdict(iv.verdict, c);
                return (
                  <li key={iv.accession} onPointerEnter={() => onHover(iv.accession)} onPointerLeave={() => onHover(null)}>
                    <div className="where-head">
                      <StatusSymbol level="normal" size={11} />
                      <button type="button" className="linklike where-name" onClick={() => onOpen(iv.accession)}>
                        {iv.accession} {i?.acronym}
                      </button>
                      {i?.doi && (
                        <a className="small" href={doiUrl(i.doi)} target="_blank" rel="noreferrer">
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
                <h3 className="where-sub">How to reach more evidence</h3>
                <p className="muted small">The smallest change that makes each investigation comparable. Nearest first.</p>
                <ul className="where-list">
                  {steps.slice(0, SHOWN).map((r) => (
                    <RouteItem key={r.accession} r={r} inv={inv.get(r.accession)} onHover={onHover} onOpen={onOpen} button="Take me there" onApply={() => onApplyRoute(r.target, r.accession)} />
                  ))}
                </ul>
                {steps.length > SHOWN && <p className="muted small">and {steps.length - SHOWN} more.</p>}
              </>
            )}
            {other.length > 0 && (
              <>
                <h3 className="where-sub where-sub-regime">Tested only in another regime ({other.length})</h3>
                <p className="muted small">A different regime is not a small step: it changes the physics. Switching moves your condition to that regime.</p>
                <ul className="where-list where-list-regime">
                  {other.slice(0, SHOWN).map((r) => (
                    <RouteItem key={r.accession} r={r} inv={inv.get(r.accession)} onHover={onHover} onOpen={onOpen} button={`Switch to ${switchLabel(r)}`} onApply={() => onApplyRoute(r.target, r.accession)} />
                  ))}
                </ul>
                {other.length > SHOWN && <p className="muted small">and {other.length - SHOWN} more.</p>}
              </>
            )}
            {routes.unreachable.length > 0 && (
              <>
                <h3 className="where-sub">No route found ({routes.unreachable.length})</h3>
                <ul className="where-unreach small">
                  {routes.unreachable.slice(0, SHOWN).map((u) => (
                    <li key={u.accession}>
                      {u.reason.startsWith(u.accession) ? (
                        <button type="button" className="linklike" onClick={() => onOpen(u.accession)}>
                          {u.reason}
                        </button>
                      ) : (
                        <>
                          <button type="button" className="linklike" onClick={() => onOpen(u.accession)}>
                            {u.accession} {inv.get(u.accession)?.acronym}
                          </button>
                          <span className="muted">: {u.reason}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                {routes.unreachable.length > SHOWN && <p className="muted small">and {routes.unreachable.length - SHOWN} more.</p>}
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
