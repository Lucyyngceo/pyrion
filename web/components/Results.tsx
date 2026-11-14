"use client";

import { useEffect, useRef, useState } from "react";
import type { ConditionRecord, Dataset, Investigation, InvestigationResult, Reason, Verdict } from "@/lib/types";

const VERDICT: Record<Verdict, { icon: string; plain: string; cls: string }> = {
  APPLICABLE: { icon: "✓", plain: "inside the measured envelope", cls: "v-app" },
  EXTRAPOLATION: { icon: "↗", plain: "outside the measured envelope", cls: "v-ext" },
  INSUFFICIENT_EVIDENCE: { icon: "?", plain: "not stated in the extracted records", cls: "v-ins" },
  REGIME_BARRIER: { icon: "≠", plain: "not comparable: different physical regime", cls: "v-bar" },
};

const KIND_ICON: Record<Reason["kind"], string> = {
  match: "=",
  barrier: "≠",
  inside: "✓",
  outside: "↗",
  missing: "?",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return (
    <span className={`badge ${v.cls}`}>
      <span className="badge-icon" aria-hidden="true">
        {v.icon}
      </span>
      <span className="badge-code">{verdict}</span>
    </span>
  );
}

const doiUrl = (doi: string) => `https://doi.org/${doi}`;

function Receipt({
  inv,
  records,
  files,
  synthetic,
  anchor,
}: {
  inv: Investigation | undefined;
  records: ConditionRecord[];
  files: Dataset["files"];
  synthetic: boolean;
  anchor: (i: number) => string;
}) {
  if (records.length === 0) {
    return <p className="muted small">No condition records to show for this investigation.</p>;
  }
  return (
    <ol className="receipt">
      {records.map((r, i) => {
        const f = files[r.source_file];
        return (
          <li key={i} id={anchor(i)}>
            <div className="rc-main">
              <span className="rc-n">[{i + 1}]</span>
              <code>{r.variable}</code> = <strong>{r.value}</strong>
              {r.unit && r.unit !== "1" ? ` ${r.unit}` : ""}
              {(r.value_original !== r.value || r.unit_original !== r.unit) && (
                <span className="muted">
                  {" "}
                  (as written: {r.value_original}
                  {r.unit_original ? ` ${r.unit_original}` : ""})
                </span>
              )}
              <span className={`rc-status rc-${r.status}`}>
                {r.status === "verified" ? "verified by a person" : r.status === "extracted" ? "extracted, not yet verified" : "insufficient evidence"}
              </span>
            </div>
            <div className="rc-src">
              {synthetic ? (
                <span className="synthetic-tag">synthetic fixture, no source</span>
              ) : (
                <>
                  {inv?.doi ? (
                    <a href={doiUrl(inv.doi)} target="_blank" rel="noreferrer">
                      {inv.accession} v{inv.version} · doi:{inv.doi}
                    </a>
                  ) : (
                    <span>{r.accession}</span>
                  )}
                  {" · "}
                  <code className="path">{r.source_file}</code>
                  {" · "}
                  <span>{r.source_location.replaceAll(";", ", ")}</span>
                  {r.test_id !== "*" && <span> · test {r.test_id}</span>}
                  {" · "}
                  <span>{r.method === "table" ? "read from a PSI table" : "read from a document"}</span>
                </>
              )}
            </div>
            {r.quote && (
              <blockquote className="rc-quote">
                {r.method === "table" ? "Column header: " : ""}
                <q>{r.quote}</q>
              </blockquote>
            )}
            {(r.note || f) && (
              <div className="rc-meta muted">
                {r.note && <span>Note: {r.note}</span>}
                {f && (
                  <span title={f.sha256}>
                    {r.note ? " · " : ""}sha256 {f.sha256.slice(0, 12)}… ({f.source})
                  </span>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ResultRow({
  result,
  inv,
  dataset,
  open,
  onOpenChange,
  onHover,
}: {
  result: InvestigationResult;
  inv: Investigation | undefined;
  dataset: Dataset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHover: (accession: string | null) => void;
}) {
  const rowRef = useRef<HTMLElement>(null);
  const synthetic = dataset.mode === "synthetic";

  // Receipt = every record cited by a reason, numbered once.
  const index = new Map<ConditionRecord, number>();
  const ordered: ConditionRecord[] = [];
  for (const reason of result.reasons) {
    for (const r of reason.records) {
      if (!index.has(r)) {
        index.set(r, ordered.length);
        ordered.push(r);
      }
    }
  }
  const anchor = (i: number) => `rc-${result.accession}-${i + 1}`;

  const jump = (i: number) => {
    onOpenChange(true);
    requestAnimationFrame(() => document.getElementById(anchor(i))?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  useEffect(() => {
    if (open) rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  return (
    <article
      ref={rowRef}
      className={`result ${VERDICT[result.verdict].cls}`}
      id={`res-${result.accession}`}
      onPointerEnter={() => onHover(result.accession)}
      onPointerLeave={() => onHover(null)}
    >
      <header className="result-head">
        <VerdictBadge verdict={result.verdict} />
        <div className="result-id">
          <span className="acc">{result.accession}</span>
          {inv?.acronym && <span className="acronym">{inv.acronym}</span>}
          <span className="verdict-plain">{VERDICT[result.verdict].plain}</span>
        </div>
      </header>
      {inv && <p className="result-title">{inv.title}</p>}
      <div className="result-cite">
        {synthetic ? (
          <span className="synthetic-tag">synthetic fixture, not NASA data</span>
        ) : (
          <>
            {inv?.doi && (
              <a href={doiUrl(inv.doi)} target="_blank" rel="noreferrer">
                doi:{inv.doi}
              </a>
            )}
            <span className="muted"> · PSI version {inv?.version}</span>
            <span className="muted"> · {inv?.license ? `license ${inv.license}` : "license not stated on PSI"}</span>
          </>
        )}
      </div>

      <ul className="reasons">
        {result.reasons.map((reason, i) => {
          const refs = reason.records.map((r) => index.get(r)!);
          return (
            <li key={i} className={`reason k-${reason.kind}`}>
              <span className="reason-icon" aria-hidden="true">
                {KIND_ICON[reason.kind]}
              </span>
              <span>
                {reason.text}
                {refs.length > 0 && (
                  <span className="refs">
                    {refs.slice(0, 4).map((n) => (
                      <button key={n} type="button" className="ref" onClick={() => jump(n)} aria-label={`Source ${n + 1}`}>
                        [{n + 1}]
                      </button>
                    ))}
                    {refs.length > 4 && (
                      <button type="button" className="ref" onClick={() => jump(refs[4])}>
                        +{refs.length - 4} more
                      </button>
                    )}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <details className="receipt-box" open={open} onToggle={(e) => onOpenChange((e.target as HTMLDetailsElement).open)}>
        <summary>
          Receipt: {ordered.length} source value{ordered.length === 1 ? "" : "s"}
        </summary>
        <Receipt inv={inv} records={ordered} files={dataset.files} synthetic={synthetic} anchor={anchor} />
      </details>
    </article>
  );
}

interface Props {
  results: InvestigationResult[];
  dataset: Dataset;
  openAccession: string | null;
  onOpenAccession: (a: string | null) => void;
  onHover: (a: string | null) => void;
  engineLabel: string;
}

export default function Results({ results, dataset, openAccession, onOpenAccession, onHover, engineLabel }: Props) {
  const invs = new Map(dataset.investigations.map((i) => [i.accession, i]));
  const comparable = results.filter((r) => r.verdict !== "REGIME_BARRIER");
  const barrier = results.filter((r) => r.verdict === "REGIME_BARRIER");
  const [showBarrier, setShowBarrier] = useState(true);

  const row = (r: InvestigationResult) => (
    <ResultRow
      key={r.accession}
      result={r}
      inv={invs.get(r.accession)}
      dataset={dataset}
      open={openAccession === r.accession}
      onOpenChange={(o) => onOpenAccession(o ? r.accession : openAccession === r.accession ? null : openAccession)}
      onHover={onHover}
    />
  );

  return (
    <section className="results" aria-labelledby="results-h">
      <div className="results-top">
        <h2 id="results-h">Applicability, one row per investigation</h2>
        <p className="muted small">
          Deterministic rules decide every verdict; no language model is involved. {engineLabel}.
        </p>
      </div>

      <div className="group">
        <h3 className="group-title">
          Comparable regime or undetermined <span className="count">{comparable.length}</span>
        </h3>
        {comparable.length === 0 ? (
          <p className="empty">
            No investigation shares the target&apos;s regime. Nothing in the extracted PSI records can be compared to this
            condition; the list below says why for each one.
          </p>
        ) : (
          comparable.map(row)
        )}
      </div>

      {barrier.length > 0 && (
        <div className="group group-barrier">
          <h3 className="group-title">
            Not comparable: different physical regime <span className="count">{barrier.length}</span>
            <button type="button" className="linklike small" onClick={() => setShowBarrier((s) => !s)} aria-expanded={showBarrier}>
              {showBarrier ? "Hide" : "Show"}
            </button>
          </h3>
          <p className="muted small">
            A regime barrier is not a low score. Gravity regime, fuel phase and diluent change the physics, so no distance
            is computed across them.
          </p>
          {showBarrier && barrier.map(row)}
        </div>
      )}
    </section>
  );
}
