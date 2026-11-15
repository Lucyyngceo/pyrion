"use client";

import StatusSymbol, { VERDICT_STATUS } from "./StatusSymbol";
import { memo, useEffect, useRef, useState } from "react";
import type { Blocker, Citation, ClusterVerdict, ConditionRecord, Evaluation, InvestigationVerdict, Reason, Verdict } from "@/lib/engine";
import { envelopeName } from "@/lib/layers";
import type { Dataset, Investigation } from "@/lib/types";
import { axisLabel, readable, valueLabel } from "@/lib/units";
import { axisWord, plainVerdict } from "@/lib/plain";
import Term from "./Term";

const VERDICT: Record<Verdict, { icon: string; plain: string; cls: string; label: string }> = {
  APPLICABLE: { icon: "✓", plain: "inside the measured envelope", cls: "v-app", label: "Applicable" },
  EXTRAPOLATION: { icon: "↗", plain: "outside the measured envelope", cls: "v-ext", label: "Extrapolation" },
  INSUFFICIENT_EVIDENCE: { icon: "?", plain: "not enough stated to compare", cls: "v-ins", label: "Insufficient evidence" },
  REGIME_BARRIER: { icon: "≠", plain: "not comparable: different physical regime", cls: "v-bar", label: "Not comparable (different regime)" },
};
const ORDER: Record<Verdict, number> = { APPLICABLE: 0, EXTRAPOLATION: 1, INSUFFICIENT_EVIDENCE: 2, REGIME_BARRIER: 3 };

const REASON_ICON: Partial<Record<Reason["code"], string>> = {
  regime_barrier: "≠",
  regime_match: "=",
  inside_range: "✓",
  inside_hull: "✓",
  outside_range: "↗",
  outside_hull: "↗",
  nearest_point: "•",
};
const iconOf = (r: Reason) => REASON_ICON[r.code] ?? "?";

export const citationKey = (c: Citation) =>
  `${c.accession}|${c.test_id}|${c.variable}|${c.value}|${c.source_file}|${c.source_location}`;

const doiUrl = (doi: string) => `https://doi.org/${doi}`;

/** "gravity_regime=?|fuel_phase=liquid" → "gravity regime not stated, fuel phase liquid". */
const clusterName = (key: string) =>
  key
    .split("|")
    .map((part) => {
      const [axis, value = ""] = part.split("=");
      return value === "?" ? `${axisLabel(axis).toLowerCase()} not stated` : `${axisLabel(axis).toLowerCase()} ${valueLabel(value)}`;
    })
    .join(", ");
const num = (a: string) => Number.parseInt(a.replace(/\D+/g, ""), 10) || 0;

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return (
    <span className={`badge ${v.cls}`}>
      <StatusSymbol level={VERDICT_STATUS[verdict]} />
      <span className="badge-label">{v.label}</span> <span className="badge-code">{verdict}</span>
    </span>
  );
}

interface Ctx {
  dataset: Dataset;
  lookup: Map<string, ConditionRecord>;
}

const RECEIPT_CAP = 30;

/** "o2_mole_fraction = 0.21" → "Oxygen 21 %"; pressure and other axes in words and units. */
function plainValue(variable: string, value: string, unit: string): string {
  const name = axisWord(variable);
  const n = Number(value);
  if ((variable === "o2_mole_fraction" || variable === "burner_o2_mole_fraction") && Number.isFinite(n)) return `${name[0].toUpperCase()}${name.slice(1)} ${Number((n * 100).toPrecision(4))} %`;
  const label = `${name[0].toUpperCase()}${name.slice(1)}`;
  return `${label} ${value}${unit && unit !== "1" ? ` ${unit}` : ""}`.replace(/^Outcome:/, "Outcome ");
}

function ReceiptList({ inv, citations, ctx, anchor }: { inv?: Investigation; citations: Citation[]; ctx: Ctx; anchor: (i: number) => string }) {
  const [all, setAll] = useState(false);
  const synthetic = ctx.dataset.mode === "synthetic";
  if (citations.length === 0) return <p className="muted small">The engine cites no record for this verdict.</p>;
  const shown = all ? citations : citations.slice(0, RECEIPT_CAP);
  return (
    <>
      <ol className="receipt">
        {shown.map((c, i) => {
          const rec = ctx.lookup.get(citationKey(c));
          const f = ctx.dataset.sourceFiles[c.source_file];
          const asWritten = rec && (rec.value_original !== c.value || rec.unit_original !== c.unit);
          return (
            <li key={i} id={anchor(i)}>
              <div className="rc-main">
                <span className="rc-n">[{i + 1}]</span>
                <strong>{plainValue(c.variable, c.value, c.unit)}</strong>
                {asWritten && (
                  <span className="muted">
                    {" "}
                    (as written: {rec.value_original}
                    {rec.unit_original ? ` ${rec.unit_original}` : ""})
                  </span>
                )}
                {c.test_id !== "*" && <span className="muted"> · test {c.test_id}</span>}
                <span className={`rc-status rc-${c.status}`}>
                  {c.status === "insufficient_evidence" ? "insufficient evidence" : "file and location given"}
                </span>
              </div>
              <div className="rc-src">
                {synthetic ? (
                  <span className="synthetic-tag">synthetic fixture, no NASA source</span>
                ) : (
                  <>
                    {inv?.doi ? (
                      <a href={doiUrl(inv.doi)} target="_blank" rel="noreferrer">
                        {inv.accession} v{inv.version} · doi:{inv.doi}
                      </a>
                    ) : (
                      <span>{c.accession}</span>
                    )}
                    {" · "}
                    <code className="path">{c.source_file}</code>
                    {" · "}
                    <span>{c.source_location.replaceAll(";", ", ")}</span>
                    {" · "}
                    <span>{c.method === "table" ? "read by code from a PSI table" : "read from a document"}</span>
                  </>
                )}
              </div>
              {c.quote && (
                <blockquote className="rc-quote">
                  {c.method === "table" ? "Column header: " : ""}
                  <q>{c.quote}</q>
                </blockquote>
              )}
              {(rec?.note || f) && (
                <div className="rc-meta muted">
                  {rec?.note && <span>Note: {rec.note}</span>}
                  {f && (
                    <span title={f.sha256}>
                      {rec?.note ? " · " : ""}file sha256 {f.sha256.slice(0, 12)}… ({f.source})
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {citations.length > RECEIPT_CAP && (
        <button type="button" className="linklike small more" onClick={() => setAll((a) => !a)}>
          {all ? "Show fewer" : `Show all ${citations.length} source values`}
        </button>
      )}
    </>
  );
}

function ResultRow({
  iv,
  cluster,
  inv,
  ctx,
  open,
  onOpenChange,
  onHover,
  onAction,
}: {
  iv: InvestigationVerdict;
  cluster: ClusterVerdict | undefined;
  inv: Investigation | undefined;
  ctx: Ctx;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHover: (accession: string | null) => void;
  onAction: (action: NonNullable<Blocker["action"]>, accession: string) => void;
}) {
  const rowRef = useRef<HTMLElement>(null);
  const synthetic = ctx.dataset.mode === "synthetic";

  const reasons = cluster ? [...cluster.reasons.filter((r) => !r.informational), ...cluster.reasons.filter((r) => r.informational)] : [];
  const index = new Map<string, number>();
  const ordered: Citation[] = [];
  for (const r of reasons) {
    for (const c of r.citations) {
      const k = citationKey(c);
      if (!index.has(k)) {
        index.set(k, ordered.length);
        ordered.push(c);
      }
    }
  }
  const anchor = (i: number) => `rc-${iv.accession}-${i + 1}`;
  const jump = (i: number) => {
    onOpenChange(true);
    requestAnimationFrame(() => document.getElementById(anchor(i))?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  useEffect(() => {
    if (open) rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  const others = iv.clusters.filter((c) => c.clusterKey !== iv.decidingCluster);
  const pv = plainVerdict(iv.verdict, cluster);
  const main = reasons.filter((r) => !r.informational);
  const context = reasons.filter((r) => r.informational);
  const reasonItem = (reason: (typeof reasons)[number], i: number) => {
    const refs = [...new Set(reason.citations.map((c) => index.get(citationKey(c))!))];
    return (
      <li key={i} className={`reason r-${reason.code}${reason.informational ? " r-info" : ""}`}>
        <span className="reason-icon" aria-hidden="true">
          {iconOf(reason)}
        </span>
        <span>
          
          {readable(reason.message)}
          {refs.length > 0 && (
            <span className="refs">
              {refs.slice(0, 3).map((n) => (
                <button key={n} type="button" className="ref" onClick={() => jump(n)} aria-label={`Source value ${n + 1}`}>
                  [{n + 1}]
                </button>
              ))}
              {refs.length > 3 && (
                <button type="button" className="ref" onClick={() => jump(refs[3])}>
                  +{refs.length - 3}
                </button>
              )}
            </span>
          )}
        </span>
      </li>
    );
  };

  return (
    <article
      ref={rowRef}
      className={`result ${VERDICT[iv.verdict].cls}`}
      id={`res-${iv.accession}`}
      onPointerEnter={() => onHover(iv.accession)}
      onPointerLeave={() => onHover(null)}
    >
      <header className="result-head">
        <VerdictBadge verdict={iv.verdict} />
        <div className="result-id">
          <span className="acc">{iv.accession}</span>
          {inv?.acronym && <span className="acronym">{inv.acronym}</span>}
        </div>
        {cluster?.rank != null && <span className="rank">nearest #{cluster.rank}</span>}
      </header>
      {iv.blockers && iv.blockers.length > 0 ? (
        <ul className="blockers">
          {iv.blockers.map((b, i) => (
            <li key={i} className={b.action?.kind === "switch_regime" ? "blocker blocker-regime" : "blocker"}>
              <span>{b.sentence}</span>
              {b.action && (
                <button type="button" className={`take-btn${b.action.kind === "switch_regime" ? " take-regime" : ""}`} onClick={() => onAction(b.action!, iv.accession)}>
                  {b.action.kind === "switch_regime" ? `Another regime: ${b.action.sentence}` : b.action.sentence}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="result-plain">{pv.sentence}</p>
      )}
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

      {cluster && (
        <p className="cluster-line small">
          <span className="muted">Measured in:</span> {envelopeName(cluster)} · {cluster.tests.length} test
          {cluster.tests.length === 1 ? "" : "s"}
          <br />
          <span className="muted">Technical:</span> <span className="tech">{pv.technical}</span>
        </p>
      )}

      <ul className="reasons">{main.map((r) => reasonItem(r, reasons.indexOf(r)))}</ul>
      {context.length > 0 && (
        <div className="context-box">
          <p className="context-title small muted">Other checks that did not decide the verdict ({context.length})</p>
          <ul className="reasons">{context.map((r) => reasonItem(r, reasons.indexOf(r)))}</ul>
        </div>
      )}

      {others.length > 0 && (
        <p className="others small muted">
          Other regime clusters in this investigation:{" "}
          {others.map((o, i) => (
            <span key={o.clusterKey}>
              {i > 0 && "; "}
              {clusterName(o.clusterKey)} <span className="mono">{o.verdict}</span>
            </span>
          ))}
          . The investigation takes the verdict of its best cluster.
        </p>
      )}

      <details className="receipt-box" open={open} onToggle={(e) => onOpenChange((e.target as HTMLDetailsElement).open)}>
        <summary>
          Receipt: {ordered.length} source value{ordered.length === 1 ? "" : "s"}
        </summary>
        {open && <ReceiptList inv={inv} citations={ordered} ctx={ctx} anchor={anchor} />}
      </details>
    </article>
  );
}

interface Props {
  evaluation: Evaluation;
  dataset: Dataset;
  lookup: Map<string, ConditionRecord>;
  openAccession: string | null;
  onOpenAccession: (a: string | null) => void;
  onHover: (a: string | null) => void;
  onAction: (action: NonNullable<Blocker["action"]>, accession: string) => void;
}

function Results({ evaluation, dataset, lookup, openAccession, onOpenAccession, onHover, onAction }: Props) {
  const [showBarrier, setShowBarrier] = useState(true);
  const ctx: Ctx = { dataset, lookup };
  const invs = new Map(dataset.investigations.map((i) => [i.accession, i]));
  const clusters = new Map([...evaluation.ranked, ...evaluation.unranked].map((c) => [`${c.accession}|${c.clusterKey}`, c]));
  const clusterOf = (iv: InvestigationVerdict) => clusters.get(`${iv.accession}|${iv.decidingCluster}`);

  const rows = evaluation.investigations.toSorted((a, b) => {
    const ca = clusterOf(a);
    const cb = clusterOf(b);
    return ORDER[a.verdict] - ORDER[b.verdict] || (ca?.rank ?? 1e9) - (cb?.rank ?? 1e9) || num(a.accession) - num(b.accession);
  });
  const comparable = rows.filter((r) => r.verdict !== "REGIME_BARRIER");
  const barrier = rows.filter((r) => r.verdict === "REGIME_BARRIER");
  const evaluated = new Set(rows.map((r) => r.accession));
  const notYet = dataset.investigations.filter((i) => !evaluated.has(i.accession));

  const row = (iv: InvestigationVerdict) => (
    <ResultRow
      key={iv.accession}
      iv={iv}
      cluster={clusterOf(iv)}
      inv={invs.get(iv.accession)}
      ctx={ctx}
      open={openAccession === iv.accession}
      onOpenChange={(o) => onOpenAccession(o ? iv.accession : openAccession === iv.accession ? null : openAccession)}
      onHover={onHover}
      onAction={onAction}
    />
  );

  return (
    <section className="results" aria-labelledby="results-h">
      <div className="results-top">
        <h2 id="results-h">The investigations, one card each</h2>
        <p className="muted small">
          Each card says in one sentence where your condition stands, then shows the reasons and the sources. Every verdict is computed by
          the PYRION engine ({evaluation.engine.name} {evaluation.engine.version}): deterministic rules, no language model.
        </p>
      </div>

      <div className="group">
        <h3 className="group-title">
          Same regime, or regime not fully stated <span className="count">{comparable.length}</span>
        </h3>
        {comparable.length === 0 ? (
          <p className="empty">
            No investigation in the extracted PSI records shares the target&apos;s regime. Nothing can be compared to this
            condition; the rows below say why for each one.
          </p>
        ) : (
          comparable.map(row)
        )}
      </div>

      {barrier.length > 0 && (
        <div className="group group-barrier">
          <h3 className="group-title">
            Not comparable: a different physical <Term k="regime barrier">regime</Term> <span className="count">{barrier.length}</span>
            <button type="button" className="linklike small" onClick={() => setShowBarrier((s) => !s)} aria-expanded={showBarrier}>
              {showBarrier ? "Hide" : "Show"}
            </button>
          </h3>
          <p className="muted small">
            A regime barrier is not a low score. Gravity regime, fuel phase and diluent change the physics, so no distance is
            defined across them.
          </p>
          {showBarrier && barrier.map(row)}
        </div>
      )}

      {notYet.length > 0 && (
        <div className="group group-pending">
          <h3 className="group-title">
            No condition records extracted yet <span className="count">{notYet.length}</span>
          </h3>
          <p className="muted small">The engine has nothing to evaluate for these PSI investigations yet. No verdict is shown.</p>
          <ul className="pending">
            {notYet.map((i) => (
              <li key={i.accession}>
                <span className="acc">{i.accession}</span> {i.acronym && <strong>{i.acronym}</strong>}{" "}
                <span className="muted">{i.title}</span>{" "}
                {i.doi && (
                  <a href={doiUrl(i.doi)} target="_blank" rel="noreferrer">
                    doi:{i.doi}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default memo(Results);
