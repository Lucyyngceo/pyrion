import { verdictLabel } from "@/lib/engine";
import StatusSymbol, { type StatusLevel } from "./StatusSymbol";
import Term from "./Term";

const ROWS: { key: "APPLICABLE" | "EXTRAPOLATION" | "INSUFFICIENT_EVIDENCE" | "REGIME_BARRIER"; label: React.ReactNode; level: StatusLevel }[] = [
  { key: "APPLICABLE", label: verdictLabel("APPLICABLE"), level: "normal" },
  { key: "EXTRAPOLATION", label: <Term k="extrapolation">{verdictLabel("EXTRAPOLATION")}</Term>, level: "caution" },
  { key: "INSUFFICIENT_EVIDENCE", label: <Term k="insufficient evidence">{verdictLabel("INSUFFICIENT_EVIDENCE")}</Term>, level: "standby" },
  { key: "REGIME_BARRIER", label: <Term k="regime barrier">{verdictLabel("REGIME_BARRIER")}</Term>, level: "off" },
];

/** Segmented ring of verdicts by investigation, with the counts beside it. Segments are drawn as arcs
 *  with a small gap; an empty category draws nothing. */
export default function VerdictRing({ counts, of }: { counts: Record<string, number>; of?: number }) {
  const total = ROWS.reduce((n, r) => n + (counts[r.key] ?? 0), 0);
  const R = 46;
  const C = 2 * Math.PI * R;
  const GAP = total > 1 ? 3 : 0;
  let offset = 0;
  return (
    <div className="vring">
      <svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label={`Verdicts for ${total} investigations`}>
        <circle cx="60" cy="60" r={R} className="vring-track" />
        {[...Array(36)].map((_, i) => {
          const a = (i / 36) * Math.PI * 2;
          const r2 = (v: number) => Math.round(v * 100) / 100;
          return (
            <line
              key={i}
              x1={r2(60 + Math.cos(a) * 54)}
              y1={r2(60 + Math.sin(a) * 54)}
              x2={r2(60 + Math.cos(a) * (i % 9 === 0 ? 58 : 56))}
              y2={r2(60 + Math.sin(a) * (i % 9 === 0 ? 58 : 56))}
              className="vring-tick"
            />
          );
        })}
        {ROWS.map((r) => {
          const n = counts[r.key] ?? 0;
          if (n === 0 || total === 0) return null;
          const len = (n / total) * C;
          const el = (
            <circle
              key={r.key}
              cx="60"
              cy="60"
              r={R}
              className={`vring-seg st-${r.level}`}
              strokeDasharray={`${Math.max(0.5, len - GAP).toFixed(2)} ${C.toFixed(2)}`}
              strokeDashoffset={(-offset).toFixed(2)}
              transform="rotate(-90 60 60)"
            />
          );
          offset += len;
          return el;
        })}
        <text x="60" y="58" textAnchor="middle" className="vring-n">
          {total}
        </text>
        <text x="60" y="74" textAnchor="middle" className="vring-k">
          INVESTIGATIONS
        </text>
      </svg>
      {of !== undefined && of > total && (
        <p className="vring-of small muted">
          of {of} investigations in PSI · {of - total} have no extracted values yet
        </p>
      )}
      <dl className="vring-legend" aria-label="Verdict counts, by investigation">
        {ROWS.map((r) => (
          <div key={r.key} className={(counts[r.key] ?? 0) === 0 ? "zero" : undefined}>
            <dt>
              <StatusSymbol level={r.level} size={10} /> {r.label}
            </dt>
            <dd>{counts[r.key] ?? 0}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
