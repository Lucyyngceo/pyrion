// PROVISIONAL applicability rules used by the web app until the PYRION engine (../engine)
// is connected. Same mechanism, kept deliberately simple:
//   - regime axes (gravity regime, fuel phase, diluent) are barriers: no distance across them;
//   - O2 and pressure are compared against the convex hull of the measured test points;
//   - anything not stated in the records is INSUFFICIENT_EVIDENCE, never a guess.
// Pure TypeScript, no Node APIs: it runs in the browser.

import { convexHull, distanceToHull, type Pt } from "./hull";
import { DILUENT_LABEL, GRAVITY_LABEL, fmt, kPa, pctO2 } from "./units";
import type {
  ConditionRecord,
  EnvelopeLayer,
  EnvelopePoint,
  Investigation,
  InvestigationResult,
  Reason,
  Regime,
  Target,
} from "./types";

const REGIME_AXES = ["gravity_regime", "fuel_phase", "diluent"] as const;
type RegimeAxis = (typeof REGIME_AXES)[number];

const AXIS_NAME: Record<RegimeAxis, string> = {
  gravity_regime: "Gravity regime",
  fuel_phase: "Fuel phase",
  diluent: "Diluent",
};

const valueLabel = (axis: RegimeAxis, v: string) =>
  axis === "gravity_regime" ? GRAVITY_LABEL[v] ?? v : axis === "diluent" ? DILUENT_LABEL[v] ?? v : v;

export interface TestView {
  accession: string;
  test_id: string;
  vars: Map<string, ConditionRecord>;
}

/** One view per test. Records with test_id "*" apply to every test of the investigation. */
export function groupTests(records: ConditionRecord[]): Map<string, TestView[]> {
  const byAcc = new Map<string, ConditionRecord[]>();
  for (const r of records) {
    if (r.status === "insufficient_evidence") continue;
    const list = byAcc.get(r.accession);
    if (list) list.push(r);
    else byAcc.set(r.accession, [r]);
  }
  const out = new Map<string, TestView[]>();
  for (const [acc, recs] of byAcc) {
    const common = recs.filter((r) => r.test_id === "*");
    const ids = [...new Set(recs.filter((r) => r.test_id !== "*").map((r) => r.test_id))];
    if (ids.length === 0) ids.push("*");
    out.set(
      acc,
      ids.map((id) => {
        const vars = new Map<string, ConditionRecord>();
        for (const r of common) if (!vars.has(r.variable)) vars.set(r.variable, r);
        if (id !== "*") {
          const own = new Set<string>();
          for (const r of recs) {
            if (r.test_id !== id || own.has(r.variable)) continue;
            vars.set(r.variable, r);
            own.add(r.variable);
          }
        }
        return { accession: acc, test_id: id, vars };
      }),
    );
  }
  return out;
}

function num(r: ConditionRecord | undefined): number | undefined {
  if (!r) return undefined;
  const v = Number.parseFloat(r.value);
  return Number.isFinite(v) ? v : undefined;
}

type Measured = { v: number; r: ConditionRecord };

function o2Of(t: TestView): Measured | undefined {
  const r = t.vars.get("o2_mole_fraction");
  const v = num(r);
  return r && v !== undefined && v >= 0 && v <= 1 ? { v, r } : undefined;
}
function pressureOf(t: TestView): Measured | undefined {
  const r = t.vars.get("pressure");
  const v = num(r);
  return r && v !== undefined && v > 0 ? { v, r } : undefined;
}
function regimeOf(t: TestView): Regime | undefined {
  const g = t.vars.get("gravity_regime")?.value;
  const f = t.vars.get("fuel_phase")?.value;
  const d = t.vars.get("diluent")?.value;
  if (!g || !f || !d) return undefined;
  return { gravity_regime: g, fuel_phase: f, diluent: d } as Regime;
}

export const regimeKey = (r: Regime) => `${r.gravity_regime}|${r.fuel_phase}|${r.diluent}`;

/** Measured points grouped by regime combination, each with its convex hull. */
export function buildEnvelope(records: ConditionRecord[]): EnvelopeLayer[] {
  const layers = new Map<string, EnvelopeLayer>();
  for (const tests of groupTests(records).values()) {
    for (const t of tests) {
      const regime = regimeOf(t);
      const o2 = o2Of(t);
      const p = pressureOf(t);
      if (!regime || !o2 || !p) continue;
      const key = regimeKey(regime);
      let layer = layers.get(key);
      if (!layer) {
        layer = { key, regime, points: [], hull: [], accessions: [] };
        layers.set(key, layer);
      }
      const point: EnvelopePoint = {
        accession: t.accession,
        test_id: t.test_id,
        o2: o2.v,
        pressure: p.v,
        records: [o2.r, p.r, ...REGIME_AXES.map((a) => t.vars.get(a)!)],
      };
      layer.points.push(point);
      if (!layer.accessions.includes(t.accession)) layer.accessions.push(t.accession);
    }
  }
  for (const layer of layers.values()) {
    layer.hull = convexHull(layer.points.map((p) => [p.o2, p.pressure] as Pt));
  }
  return [...layers.values()];
}

function rangeReason(axis: string, target: number, vals: Measured[], show: (x: number) => string): Reason {
  let lo = vals[0];
  let hi = vals[0];
  for (const x of vals) {
    if (x.v < lo.v) lo = x;
    if (x.v > hi.v) hi = x;
  }
  const range = lo.v === hi.v ? `only ${show(lo.v)}` : `${show(lo.v)} to ${show(hi.v)}`;
  const records = lo === hi ? [lo.r] : [lo.r, hi.r];
  if (target < lo.v - 1e-9 || target > hi.v + 1e-9) {
    const side = target > hi.v ? "above" : "below";
    return { axis, kind: "outside", text: `${axis} ${show(target)} is ${side} the measured range (${range}).`, records };
  }
  return { axis, kind: "inside", text: `${axis} ${show(target)} is within the measured range (${range}).`, records };
}

export function evaluate(
  target: Target,
  records: ConditionRecord[],
  investigations: Investigation[],
): InvestigationResult[] {
  const grouped = groupTests(records);
  const flagged = new Map<string, ConditionRecord[]>();
  for (const r of records) {
    if (r.status !== "insufficient_evidence") continue;
    const list = flagged.get(r.accession) ?? [];
    list.push(r);
    flagged.set(r.accession, list);
  }

  return investigations.map((inv): InvestigationResult => {
    const tests = grouped.get(inv.accession) ?? [];
    const flaggedHere = flagged.get(inv.accession) ?? [];
    const flaggedReason: Reason[] = flaggedHere.length
      ? [
          {
            axis: "Records",
            kind: "missing",
            text: `${flaggedHere.length} extracted value${flaggedHere.length === 1 ? " is" : "s are"} marked insufficient evidence and not used.`,
            records: flaggedHere,
          },
        ]
      : [];

    if (tests.length === 0) {
      return {
        accession: inv.accession,
        verdict: "INSUFFICIENT_EVIDENCE",
        reasons: [
          {
            axis: "Records",
            kind: "missing",
            text: "No condition values extracted from this PSI investigation yet.",
            records: [],
          },
          ...flaggedReason,
        ],
      };
    }

    const known = tests.filter((t) => regimeOf(t));
    if (known.length === 0) {
      const missing = REGIME_AXES.filter((a) => !tests.some((t) => t.vars.has(a))).map((a) => AXIS_NAME[a].toLowerCase());
      return {
        accession: inv.accession,
        verdict: "INSUFFICIENT_EVIDENCE",
        reasons: [
          {
            axis: "Regime",
            kind: "missing",
            text: missing.length
              ? `Not stated in the extracted records: ${missing.join(", ")}. The regime cannot be compared.`
              : "No single test states gravity regime, fuel phase and diluent together. The regime cannot be compared.",
            records: [],
          },
          ...flaggedReason,
        ],
      };
    }

    const matching = known.filter((t) => {
      const r = regimeOf(t)!;
      return r.gravity_regime === target.gravity_regime && r.fuel_phase === target.fuel_phase && r.diluent === target.diluent;
    });

    if (matching.length === 0) {
      const reasons: Reason[] = REGIME_AXES.map((axis): Reason => {
        const byValue = new Map<string, ConditionRecord>();
        for (const t of known) {
          const r = t.vars.get(axis)!;
          if (!byValue.has(r.value)) byValue.set(r.value, r);
        }
        const tv = target[axis] as string;
        const measured = [...byValue.keys()].map((v) => valueLabel(axis, v)).join(", ");
        const targetText =
          axis === "gravity_regime" && target.gravity_regime === "partial_gravity" && target.gravity_level !== undefined
            ? `${valueLabel(axis, tv)} (${fmt(target.gravity_level, 2)} g)`
            : valueLabel(axis, tv);
        const hit = byValue.get(tv);
        if (hit) {
          return { axis: AXIS_NAME[axis], kind: "match", text: `${AXIS_NAME[axis]}: ${targetText}, same as the target.`, records: [hit] };
        }
        return {
          axis: AXIS_NAME[axis],
          kind: "barrier",
          text: `${AXIS_NAME[axis]}: the target is ${targetText}; this investigation measured ${measured}. Different regime, so no distance is computed.`,
          records: [...byValue.values()],
        };
      });
      if (!reasons.some((r) => r.kind === "barrier")) {
        reasons.push({
          axis: "Regime",
          kind: "barrier",
          text: "Each regime axis matches some test, but no single test combines all three as the target does.",
          records: [],
        });
      }
      return { accession: inv.accession, verdict: "REGIME_BARRIER", reasons: [...reasons, ...flaggedReason] };
    }

    const rep = matching[0];
    const regimeReason: Reason = {
      axis: "Regime",
      kind: "match",
      text: `Regime: ${GRAVITY_LABEL[target.gravity_regime]}, ${target.fuel_phase} fuel, ${DILUENT_LABEL[target.diluent]} diluent, same as the target (${matching.length} test${matching.length === 1 ? "" : "s"}).`,
      records: REGIME_AXES.map((a) => rep.vars.get(a)!),
    };

    const o2s = matching.map(o2Of).filter((x): x is Measured => x !== undefined);
    const ps = matching.map(pressureOf).filter((x): x is Measured => x !== undefined);
    const both = matching.filter((t) => o2Of(t) && pressureOf(t));

    if (both.length === 0) {
      const missing = [o2s.length === 0 ? "O₂ mole fraction" : "", ps.length === 0 ? "pressure" : ""].filter(Boolean);
      return {
        accession: inv.accession,
        verdict: "INSUFFICIENT_EVIDENCE",
        reasons: [
          regimeReason,
          {
            axis: "Envelope",
            kind: "missing",
            text: missing.length
              ? `Same regime, but ${missing.join(" and ")} not stated in the extracted records.`
              : "Same regime, but no single test states both O₂ and pressure.",
            records: [...o2s.map((x) => x.r), ...ps.map((x) => x.r)].slice(0, 6),
          },
          ...flaggedReason,
        ],
      };
    }

    const pts = both.map((t) => [o2Of(t)!.v, pressureOf(t)!.v] as Pt);
    const hull = convexHull(pts);
    const d = distanceToHull([target.o2_mole_fraction, target.pressure], hull);
    const reasons: Reason[] = [
      regimeReason,
      rangeReason("O₂", target.o2_mole_fraction, o2s, (x) => pctO2(x)),
      rangeReason("Pressure", target.pressure, ps, (x) => kPa(x)),
    ];
    const n = both.length;
    const hullRecords = both.flatMap((t) => [o2Of(t)!.r, pressureOf(t)!.r]);
    if (d === 0) {
      reasons.push({
        axis: "Envelope",
        kind: "inside",
        text: `Inside the convex hull of ${n} measured (O₂, pressure) test point${n === 1 ? "" : "s"} in this regime.`,
        records: hullRecords,
      });
      return { accession: inv.accession, verdict: "APPLICABLE", reasons: [...reasons, ...flaggedReason], distance: 0 };
    }
    reasons.push({
      axis: "Envelope",
      kind: "outside",
      text:
        hull.length < 3
          ? `Outside the measured envelope: the ${n} test point${n === 1 ? "" : "s"} in this regime cover only a ${hull.length === 1 ? "single point" : "line"} in the (O₂, pressure) plane. A value here would be extrapolated.`
          : `Outside the convex hull of ${n} measured (O₂, pressure) test points in this regime. A value here would be extrapolated.`,
      records: hullRecords,
    });
    return { accession: inv.accession, verdict: "EXTRAPOLATION", reasons: [...reasons, ...flaggedReason], distance: d };
  });
}
