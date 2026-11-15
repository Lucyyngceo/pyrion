// Recomputes, with the engine itself, what the agent's tools can say about a target: the verdict counts and every number
// that appears in the engine's sentences. Used by run.py to re-check the agent's answer; it needs no server and no model.
//   node validation/tars_battery/engine_check.ts '<target as JSON>'   ->   one JSON object on stdout

import { join } from 'node:path';
import { evaluate, experimentsNeeded, routesToEvidence, threePartAnswer, type Target } from '../../engine/src/index.ts';
import { loadConditionDir } from '../../engine/src/load.ts';
import { compareAtmospheres, o2PartialPressure } from '../../web/lib/expert/calculators.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const input = JSON.parse(process.argv[2] ?? '{}') as { target?: Target; o2?: string[]; pressure?: string[] };
const target = (input.target ?? { regime: {}, continuous: {} }) as Target;
const { records } = loadConditionDir(join(ROOT, 'data', 'conditions'));

// With no target (the agent never set one) its tools about verdicts cannot have produced anything: only the calculators count.
const hasTarget = Object.keys(target.regime).length + Object.keys(target.continuous).length > 0;
const ev = evaluate(records, hasTarget ? target : { regime: {}, continuous: {} });
const a = threePartAnswer(records, target, { mode: 'advanced' });
const r = routesToEvidence(records, target);
const x = experimentsNeeded(records, target);

const sentences: string[] = !hasTarget ? [] : [
  ...a.known.map((k) => k.sentence),
  ...a.unknown.map((u) => u.sentence),
  ...a.next.map((n) => n.sentence),
  ...r.routes.flatMap((q) => [q.sentence, ...q.changes.map((c) => c.sentence)]),
  ...r.unreachable.map((u) => u.reason),
  x.gap.sentence,
  x.testMatrix.sentence,
  x.configuration.sentence,
  x.measurements.sentence,
  x.remainingGap.sentence,
  x.solidsRationale.sentence,
  ...x.priority.map((p) => p.sentence),
  ...x.plannedCoverage.statements.map((s) => s.sentence),
  ...x.additionalAxes.map((p) => p.sentence),
];
const NUM = /(?<![\w.])-?\d+(?:\.\d+)?/g;
const numbers = new Set<number>();
for (const s of sentences) for (const m of s.replace(/PSI-\d+/g, ' ').matchAll(NUM)) numbers.add(Number(m[0]));
if (hasTarget) for (const v of Object.values(ev.counts.investigations)) numbers.add(v);
if (hasTarget) numbers.add(ev.investigations.length);
for (const p of hasTarget ? x.testMatrix.points : []) {
  if (p.o2_mole_fraction !== undefined) numbers.add(Number((p.o2_mole_fraction * 100).toPrecision(4)));
  if (p.pressure_kpa !== undefined) numbers.add(Number(p.pressure_kpa.toPrecision(4)));
}

// The calculators the agent may call for the figures in the question: every oxygen x pressure pair, and every two atmospheres.
const pairs: { o2: string; p: string }[] = [];
for (const o of input.o2 ?? []) for (const p of input.pressure ?? []) pairs.push({ o2: o, p });
const calc = (r: ReturnType<typeof o2PartialPressure>) => {
  if (!r.ok) return;
  for (const n of r.numbers) numbers.add(n);
  for (const m of Object.values(r.also)) numbers.add(Number(m.value.toPrecision(4)));
  for (const m of r.display.matchAll(NUM)) numbers.add(Number(m[0]));
};
for (const pr of pairs) calc(o2PartialPressure(pr.o2, pr.p));
for (const a of pairs) for (const b of pairs) if (a !== b) calc(compareAtmospheres({ o2: a.o2, pressure: a.p }, { o2: b.o2, pressure: b.p }));

const o2 = target.continuous.o2_mole_fraction;
const p = target.continuous.pressure;
const po2 = o2 !== undefined && p !== undefined ? o2PartialPressure(o2, `${p} kPa`) : null;

process.stdout.write(
  JSON.stringify({
    counts: ev.counts.investigations,
    total: ev.investigations.length,
    regimeUntested: ev.regimeUntested ?? null,
    numbers: [...numbers].sort((m, n) => m - n),
    po2: po2 && po2.ok ? { kpa: po2.value, psia: po2.also.pO2_psia.value } : null,
  }),
);
