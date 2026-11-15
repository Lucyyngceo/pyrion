// Compare a set of atmospheres: one row per condition (oxygen %, total pressure, oxygen partial pressure, gravity, verdict
// counts, solid-fuel status, nearest evidence) and a ranking "most evidence behind it" with its rule stated. Every number
// comes from the engine or from the calculators of calculators.ts; no model is involved and nothing is estimated.
// (Named compareConditionSet: `compareAtmospheres` is already the name of the pressure calculator in calculators.ts.)

import { evaluate, experimentsNeeded, parseQuantity, PRESETS, presetTarget, sha256Hex, canonicalJson, type CatalogEntry, type ConditionRecord, type Target, type Verdict } from "../../../engine/src/index.ts";
import { o2PartialPressure, type Measured } from "./calculators.ts";

/** A preset id, or a condition written as a person would ("34 %", "8.2 psia"), or a ready-made Target. */
export type ConditionInput =
  | string
  | {
      name?: string;
      o2?: string | number;
      pressure?: string | Measured;
      /** "microgravity", "partial_gravity", ... Left out: the gravity regime stays open and the row says so. */
      gravity_regime?: string;
      /** A gravity level in g, shown only (it selects the regime, it is never compared). */
      gravity_level?: number;
      target?: Target;
    };

export interface ComparisonRow {
  /** Position in the input list (0-based). */
  index: number;
  name: string;
  /** "preset" with its id, or "given". */
  source: string;
  ok: boolean;
  /** Why the row could not be computed (a unit the parser refuses, an unknown preset). Such a row is not ranked. */
  error?: string;
  o2_percent?: number;
  total_kpa?: number;
  total_psia?: number;
  /** Oxygen partial pressure, from o2PartialPressure. */
  pO2_kpa?: number;
  pO2_psia?: number;
  /** The calculator's own sentence, with its provenance. */
  pO2_display?: string;
  pO2_provenance?: string;
  gravity: { regime: string | null; level: number | null };
  counts?: Record<Verdict, number>;
  /** Best verdict among solid-fuel investigations ("NONE": no solid-fuel investigation is comparable). */
  solid_fuel?: { best: string; level?: string; investigations: string[] };
  /** The nearest ranked cluster: nearest APPLICABLE or EXTRAPOLATION evidence, null when nothing is ranked. */
  nearest?: { accession: string; acronym?: string; doi?: string; verdict: Verdict; level?: string; distance: number | null } | null;
  /** SHA-256 of the engine's evaluation for this condition. */
  fingerprint?: string;
  rank?: number;
}

export interface ComparisonResult {
  rows: ComparisonRow[];
  /** Row indexes, best first; tied rows share a rank. Rows that failed are not in it. */
  ranking: { index: number; name: string; rank: number }[];
  /** The ranking rule, in words, always shown with the ranking. */
  rule: string;
  markdown: string;
}

export const RANKING_RULE =
  "Ranking = most evidence in PSI behind the condition, by this rule only: (1) more investigations that are comparable (APPLICABLE), then (2) more investigations that need extrapolation, then (3) the better verdict for solid fuel, then (4) the smaller distance to the nearest measured evidence. Equal on all four = tied. It says how much measured evidence PSI holds near a condition; it does not say which atmosphere is safer or better.";

const SOLID_ORDER: Record<string, number> = { APPLICABLE: 2, EXTRAPOLATION: 1 };
const label = (v: string) => v.toLowerCase().replace(/_/g, " ");

export function toTarget(input: ConditionInput): { name: string; source: string; target?: Target; gravity: { regime: string | null; level: number | null }; error?: string } {
  if (typeof input === "string") {
    const preset = PRESETS.find((p) => p.id === input);
    if (!preset) return { name: input, source: "preset", gravity: { regime: null, level: null }, error: `"${input}" is not a preset id (${PRESETS.map((p) => p.id).join(", ")}).` };
    const t = presetTarget(input);
    return { name: preset.label, source: `preset ${input}`, target: t, gravity: { regime: t.regime.gravity_regime ?? null, level: t.continuous.gravity_level ?? null } };
  }
  const name = input.name ?? "condition";
  if (input.target) {
    const t = input.target;
    return { name, source: "given", target: t, gravity: { regime: t.regime.gravity_regime ?? null, level: t.continuous.gravity_level ?? t.informational?.gravity_level ?? null } };
  }
  const continuous: Target["continuous"] = {};
  if (input.o2 !== undefined) {
    const q = parseQuantity(String(input.o2), "o2_mole_fraction");
    if (!q.ok) return { name, source: "given", gravity: { regime: null, level: null }, error: q.message };
    continuous.o2_mole_fraction = q.value;
  }
  if (input.pressure !== undefined) {
    const written = typeof input.pressure === "string" ? input.pressure : `${input.pressure.value} ${input.pressure.unit}`;
    const q = parseQuantity(written, "pressure");
    if (!q.ok) return { name, source: "given", gravity: { regime: null, level: null }, error: q.message };
    continuous.pressure = q.value;
  }
  if (input.gravity_level !== undefined) continuous.gravity_level = input.gravity_level;
  const regime: Target["regime"] = input.gravity_regime ? { gravity_regime: input.gravity_regime } : {};
  return { name, source: "given", target: { regime, continuous }, gravity: { regime: input.gravity_regime ?? null, level: input.gravity_level ?? null } };
}

export interface CompareContext {
  records: readonly ConditionRecord[];
  catalog?: Record<string, CatalogEntry>;
}

export function compareConditionSet(conditions: readonly ConditionInput[], ctx: CompareContext): ComparisonResult {
  const rows: ComparisonRow[] = conditions.map((input, index): ComparisonRow => {
    const p = toTarget(input);
    const base = { index, name: p.name, source: p.source, gravity: p.gravity };
    if (p.error || !p.target) return { ...base, ok: false, error: p.error ?? "No condition." };
    const t = p.target;
    const o2 = t.continuous.o2_mole_fraction;
    const kpa = t.continuous.pressure;
    const row: ComparisonRow = { ...base, ok: true };
    if (o2 === undefined || kpa === undefined) {
      return { ...base, ok: false, error: "Both an oxygen fraction and a total pressure are needed to compare atmospheres." };
    }
    // Oxygen partial pressure and the displayed figures: the calculator, fed with the same values the engine receives.
    const pp = o2PartialPressure(`${o2 * 100} %`, `${kpa} kPa`);
    if (!pp.ok) return { ...base, ok: false, error: pp.message };
    row.o2_percent = pp.also.o2_percent.value;
    row.total_kpa = pp.also.total_kpa.value;
    row.total_psia = pp.also.total_psia.value;
    row.pO2_kpa = pp.value as number;
    row.pO2_psia = pp.also.pO2_psia.value;
    row.pO2_display = pp.display;
    row.pO2_provenance = pp.provenance;

    const ev = evaluate(ctx.records, t);
    row.counts = ev.counts.investigations;
    row.fingerprint = sha256Hex(canonicalJson(ev));
    const exp = experimentsNeeded(ctx.records, t, ctx.catalog ? { catalog: ctx.catalog } : {});
    const solid = exp.phaseCoverage.find((c) => c.fuel_phase === "solid");
    row.solid_fuel = { best: solid?.best ?? "NONE", ...(solid?.level ? { level: solid.level } : {}), investigations: solid?.investigations ?? [] };
    const first = ev.ranked[0];
    row.nearest = first
      ? { accession: first.accession, ...(ctx.catalog?.[first.accession] ? { acronym: ctx.catalog[first.accession].acronym, doi: ctx.catalog[first.accession].doi } : {}), verdict: first.verdict, ...(first.extrapolationLevel ? { level: first.extrapolationLevel } : {}), distance: first.distance }
      : null;
    return row;
  });

  // Ranking: lexicographic on the four stated keys; equal keys share a rank.
  const key = (r: ComparisonRow) => [-(r.counts?.APPLICABLE ?? 0), -(r.counts?.EXTRAPOLATION ?? 0), -(SOLID_ORDER[r.solid_fuel?.best ?? ""] ?? 0), r.nearest?.distance ?? Number.POSITIVE_INFINITY];
  const cmp = (a: ComparisonRow, b: ComparisonRow) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i += 1) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return a.index - b.index;
  };
  const ok = rows.filter((r) => r.ok).sort(cmp);
  const ranking: ComparisonResult["ranking"] = [];
  ok.forEach((r, i) => {
    const prev = ok[i - 1];
    const tied = prev && key(prev).every((x, k) => x === key(r)[k]);
    r.rank = tied ? (prev.rank as number) : i + 1;
    ranking.push({ index: r.index, name: r.name, rank: r.rank });
  });

  return { rows, ranking, rule: RANKING_RULE, markdown: toMarkdown(rows, ranking) };
}

const num = (x: number | undefined, d = 4) => (x === undefined ? "—" : String(Number(x.toPrecision(d))));

function toMarkdown(rows: ComparisonRow[], ranking: ComparisonResult["ranking"]): string {
  const out: string[] = ["| Condition | O₂ % | Total pressure | O₂ partial pressure | Gravity | Verdicts (applicable / extrapolation / insufficient / regime barrier) | Solid fuel | Nearest evidence |", "|---|---|---|---|---|---|---|---|"];
  for (const r of rows) {
    if (!r.ok) {
      out.push(`| ${r.name} | — | — | — | — | not computed: ${r.error} | — | — |`);
      continue;
    }
    const g = r.gravity.regime ? `${label(r.gravity.regime)}${r.gravity.level !== null ? ` (${num(r.gravity.level)} g)` : ""}` : "not stated (open)";
    const c = r.counts as Record<Verdict, number>;
    const solid = r.solid_fuel?.best === "NONE" || !r.solid_fuel ? "none comparable" : `${label(r.solid_fuel.best)}${r.solid_fuel.level ? ` (${label(r.solid_fuel.level)})` : ""}`;
    const near = r.nearest ? `${r.nearest.accession}${r.nearest.acronym ? ` ${r.nearest.acronym}` : ""}, ${label(r.nearest.verdict)}${r.nearest.level ? ` (${label(r.nearest.level)})` : ""}${r.nearest.doi ? `, doi:${r.nearest.doi}` : ""}` : "none ranked";
    out.push(`| ${r.name} | ${num(r.o2_percent)} | ${num(r.total_kpa)} kPa (${num(r.total_psia)} psia) | ${num(r.pO2_kpa)} kPa (${num(r.pO2_psia)} psia) | ${g} | ${c.APPLICABLE} / ${c.EXTRAPOLATION} / ${c.INSUFFICIENT_EVIDENCE} / ${c.REGIME_BARRIER} | ${solid} | ${near} |`);
  }
  out.push("", "**Most evidence behind it**", "");
  if (ranking.length === 0) out.push("_No condition could be ranked._");
  for (const r of ranking) out.push(`${r.rank}. ${r.name}`);
  out.push("", `_${RANKING_RULE}_`, "", "_O₂ partial pressure and unit conversions: calculators of PYRION (computed by code). Verdicts: the PYRION engine, with the same records for every row._", "");
  return out.join("\n");
}
