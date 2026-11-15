"use client";

import { memo } from "react";
import type { ClusterVerdict, Evaluation } from "@/lib/engine";
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
}

const doiUrl = (d: string) => `https://doi.org/${d}`;

/** Right column: the verdict, and where the evidence is. */
function NavigatorPanel({ evaluation, investigations, status, targetLabel, counts, pinned, onPin, onClearPin, onHover, onOpen }: Props) {
  const inv = new Map(investigations.map((i) => [i.accession, i]));
  const clusters = new Map([...evaluation.ranked, ...evaluation.unranked].map((c) => [`${c.accession}|${c.clusterKey}`, c]));
  const near = evaluation.investigations
    .filter((i) => i.verdict === "APPLICABLE" || i.verdict === "EXTRAPOLATION")
    .map((i) => ({ iv: i, c: clusters.get(`${i.accession}|${i.decidingCluster}`) as ClusterVerdict | undefined }))
    .toSorted((a, b) => (a.iv.verdict === b.iv.verdict ? 0 : a.iv.verdict === "APPLICABLE" ? -1 : 1) || (a.c?.rank ?? 1e9) - (b.c?.rank ?? 1e9));
  const SHOWN = 6;

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
        <VerdictRing counts={counts} />
      </section>

      <section className="card nav-evidence" aria-labelledby="where-h">
        <h2 id="where-h" className="panel-title">
          Where the evidence is
        </h2>
        {near.length === 0 ? (
          <p className="where-none">
            In this dataset, no investigation can be compared to this condition as it stands: each one is a different <Term k="regime barrier">regime</Term> or lacks the
            values to compare. The cards below say why, one by one.
          </p>
        ) : (
          <>
            <p className="muted small">Nearest first. Each one has recorded your regime.</p>
            <ul className="where-list">
              {near.slice(0, SHOWN).map(({ iv, c }) => {
                const i = inv.get(iv.accession);
                const pv = plainVerdict(iv.verdict, c);
                return (
                  <li key={iv.accession} onPointerEnter={() => onHover(iv.accession)} onPointerLeave={() => onHover(null)}>
                    <div className="where-head">
                      <StatusSymbol level={iv.verdict === "APPLICABLE" ? "normal" : "caution"} size={11} />
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
                    {c && <p className="where-reg muted small">Measured in {regimeWords(c.regime)}.</p>}
                  </li>
                );
              })}
            </ul>
            {near.length > SHOWN && <p className="muted small">and {near.length - SHOWN} more in the cards below.</p>}
          </>
        )}
        <p className="muted small where-soon">Routes to evidence (what to change to compare) arrive in the next step.</p>
      </section>
    </>
  );
}

export default memo(NavigatorPanel);
