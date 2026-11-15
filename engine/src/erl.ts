// Evidence Readiness Levels (ERL): how much MEASURED evidence PSI holds for a condition, on a 0-4 scale.
// PYRION convention, like NASA's TRL, for evidence; it measures how much tested evidence exists near a condition, never safety.
// Everything is read from evaluate(): the level is a relabelling of the engine's own verdicts and extrapolation levels.

import { bestLevel, type ExtrapolationLevel } from './levels.ts';
import { evaluate } from './verdict.ts';
import type { ConditionRecord, EngineOptions, Target, Verdict } from './types.ts';

export type ErlLevel = 0 | 1 | 2 | 3 | 4;

export const ERL_NOTE =
  "PYRION convention, like NASA's TRL, for evidence; it measures how much tested evidence exists near a condition, never safety.";

/** The scale, highest first. `means` is the plain-words definition shown next to a level. */
export const ERL_SCALE: readonly { level: ErlLevel; name: string; means: string }[] = [
  { level: 4, name: 'inside the tested-point envelope', means: "The condition lies inside the region spanned by tested points, allowing PYRION's stated tolerance; this does not establish a test at the exact condition." },
  { level: 3, name: 'near or combination extrapolation', means: 'The condition is just outside the tested region, or its settings lie within individual tested ranges but outside their joint oxygen-pressure envelope.' },
  { level: 2, name: 'outside the tested region', means: "The condition lies outside the tested region and beyond PYRION's near-extrapolation category." },
  { level: 1, name: 'different regime', means: 'Oxygen-pressure evidence exists only in a different gravity, fuel or atmosphere regime.' },
  { level: 0, name: 'insufficient evidence', means: 'The extracted PSI records do not support a comparison for this condition.' },
];

/** Extrapolation level -> ERL (near: just_outside and combination; far: outside and far_outside). */
export const ERL_OF_EXTRAPOLATION: Readonly<Record<ExtrapolationLevel, ErlLevel>> = { combination: 3, just_outside: 3, outside: 2, far_outside: 2 };

export interface ErlOfInvestigation {
  accession: string;
  verdict: Verdict;
  extrapolationLevel?: ExtrapolationLevel;
  /** null: the extracted records of this investigation cannot be compared with the target (insufficient evidence). */
  level: ErlLevel | null;
}

export interface ErlResult {
  level: ErlLevel;
  name: string;
  perInvestigation: ErlOfInvestigation[];
  reason: string;
  note: string;
}

const nameOf = (l: ErlLevel) => ERL_SCALE.find((s) => s.level === l)?.name ?? '';

export function erlOfVerdict(verdict: Verdict, level?: ExtrapolationLevel): ErlLevel | null {
  if (verdict === 'APPLICABLE') return 4;
  if (verdict === 'EXTRAPOLATION') return ERL_OF_EXTRAPOLATION[level ?? 'far_outside'];
  if (verdict === 'REGIME_BARRIER') return 1;
  return null;
}

/** The ERL of a target: the best level among the investigations, 0 when none is comparable at all. */
export function erlFor(records: readonly ConditionRecord[], target: Target, options: EngineOptions = {}): ErlResult {
  const ev = evaluate(records, target, options);
  const per: ErlOfInvestigation[] = ev.investigations.map((i) => ({
    accession: i.accession,
    verdict: i.verdict,
    ...(i.extrapolationLevel ? { extrapolationLevel: i.extrapolationLevel } : {}),
    level: erlOfVerdict(i.verdict, i.extrapolationLevel),
  }));
  const levels = per.map((p) => p.level).filter((l): l is ErlLevel => l !== null);
  let level: ErlLevel;
  let reason: string;
  if (ev.regimeUntested) {
    level = 0;
    const tested = ev.regimeUntested.testedValues.join(' and ') || 'other regimes';
    reason = `No PSI test in ${ev.regimeUntested.value.replace(/_/g, ' ')} anywhere; the investigations state only ${tested.replace(/_/g, ' ')}.`;
  } else if (levels.length === 0) {
    level = 0;
    reason = 'No investigation can be compared with this condition: the extracted records are insufficient for it.';
  } else {
    level = Math.max(...levels) as ErlLevel;
    const n = per.filter((p) => p.level === level).length;
    const ex = bestLevel(per.filter((p) => p.level === level && p.verdict === 'EXTRAPOLATION').map((p) => p.extrapolationLevel));
    reason =
      level === 4
        ? `${n} investigation${n === 1 ? ' is' : 's are'} comparable (measured).`
        : level === 1
          ? `${n} investigation${n === 1 ? ' has' : 's have'} comparable records only in another regime.`
          : `The nearest evidence is an extrapolation (${(ex ?? '').replace(/_/g, ' ')}); ${n} investigation${n === 1 ? '' : 's'} at this level.`;
  }
  return { level, name: nameOf(level), perInvestigation: per, reason, note: ERL_NOTE };
}

// ---- the habitat x material grid ----

export interface Habitat {
  id: string;
  label: string;
  target: Target;
}

/** A mission leg (for example surface stay or transit): overrides the gravity of the habitat's target. */
export interface Leg {
  id: string;
  label: string;
  gravity_regime?: string;
  gravity_level?: number;
}

export interface ErlCell {
  habitat: string;
  /** null: any material. */
  material: string | null;
  leg: string | null;
  level: ErlLevel;
  name: string;
  reason: string;
  /** Investigations that were considered for this cell. */
  investigations: number;
}

export interface ErlBoard {
  habitats: Habitat[];
  materials: (string | null)[];
  legs: (string | null)[];
  cells: ErlCell[];
  note: string;
}

/** Material names as the records state them (the 'material' variable), first-seen order made alphabetical. */
export function materialsOf(records: readonly ConditionRecord[]): string[] {
  const set = new Set<string>();
  for (const r of records) if (r.variable === 'material' && r.status !== 'insufficient_evidence' && r.value.trim() !== '') set.add(r.value.trim());
  return [...set].sort((a, b) => a.localeCompare(b));
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Records of the tests that state this material, plus the investigation-wide records ('*') of those investigations.
 * Other tests of the same investigation (other materials) are left out, so one material never borrows another's evidence.
 * When the material is stated investigation-wide ('*'), every test of that investigation counts.
 */
export function recordsForMaterial(records: readonly ConditionRecord[], material: string): ConditionRecord[] {
  const matching = records.filter((r) => r.variable === 'material' && r.status !== 'insufficient_evidence' && norm(r.value) === norm(material));
  const wholeInvestigation = new Set(matching.filter((r) => r.test_id === '*').map((r) => r.accession));
  const tests = new Set(matching.map((r) => `${r.accession}\u0000${r.test_id}`));
  return records.filter((r) => wholeInvestigation.has(r.accession) || tests.has(`${r.accession}\u0000${r.test_id}`) || (r.test_id === '*' && matching.some((m) => m.accession === r.accession)));
}

function withLeg(t: Target, leg: Leg): Target {
  const out: Target = { regime: { ...t.regime }, continuous: { ...t.continuous }, ...(t.informational ? { informational: { ...t.informational } } : {}) };
  if (leg.gravity_regime) {
    out.regime.gravity_regime = leg.gravity_regime;
    delete out.continuous.gravity_level;
    if (out.informational) delete out.informational.gravity_level;
  }
  if (leg.gravity_level !== undefined) out.continuous.gravity_level = leg.gravity_level;
  return out;
}

/**
 * ERL for every habitat x material (x leg). `materials` omitted: "any material" plus every material the records state.
 * A material that no investigation states gives level 0 with that reason (never a guess).
 */
export function erlBoard(
  records: readonly ConditionRecord[],
  habitats: readonly Habitat[],
  materials?: readonly string[],
  legs?: readonly Leg[],
  options: EngineOptions = {},
): ErlBoard {
  const mats: (string | null)[] = [null, ...(materials ?? materialsOf(records))];
  const legList: (Leg | null)[] = legs && legs.length > 0 ? [...legs] : [null];
  const cells: ErlCell[] = [];
  for (const h of habitats) {
    for (const leg of legList) {
      const target = leg ? withLeg(h.target, leg) : h.target;
      for (const m of mats) {
        const recs = m === null ? records : recordsForMaterial(records, m);
        const base = { habitat: h.id, material: m, leg: leg ? leg.id : null };
        if (recs.length === 0) {
          cells.push({ ...base, level: 0, name: nameOf(0), reason: `No investigation in the extracted records states the material "${m}".`, investigations: 0 });
          continue;
        }
        const e = erlFor(recs, target, options);
        cells.push({ ...base, level: e.level, name: e.name, reason: e.reason, investigations: e.perInvestigation.length });
      }
    }
  }
  return { habitats: [...habitats], materials: mats, legs: legList.map((l) => (l ? l.id : null)), cells, note: ERL_NOTE };
}
