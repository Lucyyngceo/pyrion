// The lens matrix: investigations x safety legs and investigations x phenomena. A filled cell has at least one
// verbatim quote (hover or keyboard focus shows it with its source). An empty cell means no quote was found.

import { cellTip, displayName, type LensInvestigation } from "@/lib/lenses/model";

export default function LensMatrix({ rows, legs, phenomena }: { rows: LensInvestigation[]; legs: string[]; phenomena: string[] }) {
  const cell = (key: string, entries: { quote: string; source: { kind: "psi" | "challenge"; file: string; key?: string; line?: number } }[], label: string) =>
    entries.length ? (
      <td key={key} className="lens-on">
        <span className="lens-dot" tabIndex={0} aria-label={`${label}: ${entries.length} quote${entries.length > 1 ? "s" : ""}`}>
          ●<span className="lens-tip" role="tooltip">{cellTip(entries)}</span>
        </span>
      </td>
    ) : (
      <td key={key} className="lens-off" aria-label={`${label}: no quote`}>·</td>
    );
  return (
    <div className="lens-table-wrap">
      <table className="lens-table">
        <thead>
          <tr>
            <th scope="col">Investigation</th>
            {legs.map((l) => (
              <th scope="col" key={l} className="lens-leg">{l}</th>
            ))}
            {phenomena.map((p) => (
              <th scope="col" key={p} className="lens-ph">{p}</th>
            ))}
            <th scope="col">strength</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.accession}>
              <th scope="row" title={r.title}>
                {displayName(r)} <small className="muted">{r.accession}</small>
              </th>
              {legs.map((l) => cell(l, r.legs[l] ?? [], `${displayName(r)} ${l}`))}
              {phenomena.map((p) => cell(p, r.phenomena[p] ?? [], `${displayName(r)} ${p}`))}
              <td className={`lens-strength lens-${r.strength.value}`}>
                <span className="lens-dot" tabIndex={0} aria-label={`${displayName(r)} strength ${r.strength.value}`}>
                  {r.strength.value}
                  <span className="lens-tip" role="tooltip">{cellTip([r.strength])}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
