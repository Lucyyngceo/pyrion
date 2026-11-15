// Server only. "Evidence gaps that matter": for a habitat condition, every value that is not stated in PSI and blocks a
// comparison, and the range that value would need to have for the investigation to become comparable. Nothing is assumed:
// the engine is run on candidate values in memory and the reachable range is reported. Deterministic, no model.

import { evaluate, type ConditionRecord, type Target, type Verdict } from "./engine";
import { serverData } from "./server-eval";

export type GapAxis = "o2_mole_fraction" | "pressure";

export interface DataGap {
  accession: string;
  axis: GapAxis;
  /** Tests of this investigation that have the other plane axis but not this one. */
  tests: string[];
  /** Range of the missing value (in engine units: mole fraction, kPa) that would make the investigation comparable. */
  range: [number, number] | null;
  /** Best verdict reachable by stating the value. */
  reachable: Verdict | null;
  reachableLevel?: string;
  /** Why it would still not be inside, when it would only be just outside (the engine's own sentence). */
  reason: string;
  /** True when the investigation already has comparable data and only some of its tests lack this value (a partial gap). */
  partial?: boolean;
  /** The other plane axis of the listed tests as stated in PSI (engine units), so a reader sees which tests these are. */
  otherValues?: [number, number];
}

const GRID: Record<GapAxis, { from: number; to: number; step: number }> = {
  o2_mole_fraction: { from: 0.1, to: 0.6, step: 0.0025 },
  pressure: { from: 20, to: 200, step: 0.25 },
};

const usable = (r: ConditionRecord) => r.status !== "insufficient_evidence";

function hypo(acc: string, test: string, axis: GapAxis, v: number): ConditionRecord {
  return {
    accession: acc,
    test_id: test,
    variable: axis,
    value: String(v),
    unit: axis === "pressure" ? "kPa" : "1",
    value_original: String(v),
    unit_original: axis === "pressure" ? "kPa" : "1",
    method: "document",
    source_file: "candidate value (not a NASA source)",
    source_location: "in memory only",
    quote: "",
    status: "extracted",
    note: "Candidate value used only to compute the range the record would need; never evidence.",
    origin: { file: "gaps", line: 0 },
  };
}

const RANK: Record<Verdict, number> = { APPLICABLE: 0, EXTRAPOLATION: 1, INSUFFICIENT_EVIDENCE: 2, REGIME_BARRIER: 3 };

// The records do not change while the server runs, so each target is computed once.
const memo = new Map<string, Promise<DataGap[]>>();

/** The gaps for one habitat target, best (most reachable) first. Memoized per target. */
export function evidenceGaps(target: Target): Promise<DataGap[]> {
  const key = JSON.stringify(target);
  let p = memo.get(key);
  if (!p) {
    p = computeGaps(target);
    memo.set(key, p);
  }
  return p;
}

async function computeGaps(target: Target): Promise<DataGap[]> {
  const { records } = await serverData();
  const base = evaluate(records, target);
  const gaps: DataGap[] = [];
  for (const iv of base.investigations) {
    const partial = iv.verdict === "EXTRAPOLATION";
    if (iv.verdict !== "INSUFFICIENT_EVIDENCE" && !partial) continue;
    // Insufficient: the blocking axes. Partial: both plane axes, for tests that state one and not the other.
    const axes: GapAxis[] = partial
      ? ["o2_mole_fraction", "pressure"]
      : (iv.blockers ?? []).filter((b) => (b.code === "NO_USABLE_VALUE" || b.code === "AXIS_NOT_RECORDED") && (b.axis === "o2_mole_fraction" || b.axis === "pressure")).map((b) => b.axis as GapAxis);
    for (const axis of axes) {
      const other: GapAxis = axis === "pressure" ? "o2_mole_fraction" : "pressure";
      const mine = records.filter((r) => r.accession === iv.accession);
      const has = (a: GapAxis) => new Set(mine.filter((r) => usable(r) && r.variable === a).map((r) => r.test_id));
      const withOther = has(other);
      const withThis = has(axis);
      const tests = [...withOther].filter((t) => !withThis.has(t)).sort();
      if (tests.length === 0) {
        if (partial) continue;
        gaps.push({ accession: iv.accession, axis, tests: [], range: null, reachable: null, reason: `No test of this investigation states ${other === "pressure" ? "pressure" : "oxygen"} either, so one value alone would not place it.` });
        continue;
      }
      const g = GRID[axis];
      let best: Verdict | null = null;
      let bestLevel: string | undefined;
      let lo = Infinity;
      let hi = -Infinity;
      let reason = "";
      for (let v = g.from; v <= g.to + 1e-9; v += g.step) {
        const val = Number(v.toFixed(4));
        const ev = evaluate([...mine, ...tests.map((t) => hypo(iv.accession, t, axis, val))], target);
        const r = ev.investigations.find((x) => x.accession === iv.accession);
        if (!r || (r.verdict !== "APPLICABLE" && !(r.verdict === "EXTRAPOLATION" && r.extrapolationLevel === "just_outside"))) continue;
        // A partial gap matters only when stating the value would put the investigation inside the tested range.
        if (partial && r.verdict !== "APPLICABLE") continue;
        if (best === null || RANK[r.verdict] < RANK[best]) {
          best = r.verdict;
          bestLevel = r.extrapolationLevel;
          lo = Infinity;
          hi = -Infinity;
          const c = [...ev.ranked, ...ev.unranked].find((x) => x.accession === iv.accession);
          reason = c?.reasons.find((x) => !x.informational)?.message ?? "";
        }
        if (r.verdict === best) {
          lo = Math.min(lo, val);
          hi = Math.max(hi, val);
        }
      }
      if (partial && best === null) continue;
      const ov = mine.filter((r) => usable(r) && r.variable === other && tests.includes(r.test_id)).map((r) => Number(r.value)).filter(Number.isFinite);
      gaps.push({
        accession: iv.accession,
        axis,
        tests,
        range: best ? [lo, hi] : null,
        reachable: best,
        ...(bestLevel ? { reachableLevel: bestLevel } : {}),
        reason,
        ...(partial ? { partial: true } : {}),
        ...(ov.length ? { otherValues: [Math.min(...ov), Math.max(...ov)] as [number, number] } : {}),
      });
    }
  }
  return gaps.sort((a, b) => (a.reachable ? RANK[a.reachable] : 9) - (b.reachable ? RANK[b.reachable] : 9) || b.tests.length - a.tests.length || a.accession.localeCompare(b.accession, "en", { numeric: true }));
}
