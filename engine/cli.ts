// PYRION verdicts from the command line.
//
//   node engine/cli.ts                          all presets against data/conditions/*.csv
//   node engine/cli.ts --preset challenge-lunar-base
//   node engine/cli.ts --json > verdicts.json   canonical JSON (byte-identical for the same input)
//   node engine/cli.ts --fixtures               run on the SYNTHETIC test fixtures (not NASA data)
//   node engine/cli.ts --verified-only          count only records a human has verified
//
// The output is the engine's output and nothing else: no model, no network, no clock.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseCsv } from './src/csv.ts';
import {
  PRESETS,
  buildEnvelopes,
  canonicalJson,
  evaluate,
  locateTarget,
  presetTarget,
  type ClusterVerdict,
  type Evaluation,
  type Verdict,
} from './src/index.ts';
import { loadConditionDir } from './src/load.ts';

const ROOT = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const synthetic = flag('--fixtures');
const dir = synthetic ? join(import.meta.dirname, 'test', 'fixtures', 'synthetic') : (option('--conditions') ?? join(ROOT, 'data', 'conditions'));
const presetIds = option('--preset') ? [option('--preset') as string] : PRESETS.map((p) => p.id);
const minimumStatus = flag('--verified-only') ? 'verified' : 'extracted';

const loaded = loadConditionDir(dir);
const shownDir = relative(ROOT, dir).split('\\').join('/') || dir;

if (!loaded.found || loaded.files.length === 0) {
  console.log(`No condition records at ${shownDir} (expected data/conditions/<accession>.csv).`);
  console.log('Nothing to judge. Run with --fixtures to see the engine on SYNTHETIC test data.');
  process.exit(0);
}

// DOIs for display only. The engine itself reads only condition records.
const doi = new Map<string, string>();
const manifest = join(ROOT, 'data', 'manifest', 'investigations.csv');
if (!synthetic && existsSync(manifest)) {
  const rows = parseCsv(readFileSync(manifest, 'utf8'));
  const h = rows[0].cells;
  for (const r of rows.slice(1)) doi.set(r.cells[h.indexOf('accession')], r.cells[h.indexOf('doi')]);
}

const evaluations: Record<string, Evaluation> = {};
for (const id of presetIds) evaluations[id] = evaluate(loaded.records, presetTarget(id), { minimumStatus });
const envelopes = buildEnvelopes(loaded.records, { minimumStatus });

if (flag('--json')) {
  process.stdout.write(
    canonicalJson({
      synthetic,
      conditions: { dir: shownDir, files: loaded.files, rejected: loaded.rejected },
      presets: PRESETS.filter((p) => presetIds.includes(p.id)),
      evaluations,
      envelopes,
      locations: Object.fromEntries(presetIds.map((id) => [id, locateTarget(presetTarget(id), envelopes)])),
    }),
  );
  process.exit(0);
}

const VERDICTS: Verdict[] = ['APPLICABLE', 'EXTRAPOLATION', 'INSUFFICIENT_EVIDENCE', 'REGIME_BARRIER'];
const n = (x: number) => String(Number(x.toPrecision(4)));
const out: string[] = [];
const line = (s = '') => out.push(s);

if (synthetic) line('*** SYNTHETIC TEST FIXTURES — NOT NASA DATA ***');
line(`PYRION applicability engine ${evaluations[presetIds[0]].engine.version}`);
line(
  `Condition records: ${shownDir} — ${loaded.files.length} file(s), ${loaded.records.length} record(s) read, ${loaded.rejected.length} row(s) rejected; counting status ${minimumStatus === 'verified' ? 'verified only' : 'extracted + verified'}.`,
);
for (const r of loaded.rejected) line(`  rejected ${r.file}:${r.line} — ${r.reason}`);

function regimeText(c: ClusterVerdict): string {
  return c.regime.map((s) => (s.state === 'known' ? s.values[0] : s.state === 'missing' ? `${s.axis}?` : `${s.axis}:conflict`)).join(' / ');
}

for (const id of presetIds) {
  const ev = evaluations[id];
  const preset = PRESETS.find((p) => p.id === id);
  line();
  line(`=== ${id}: ${preset?.label ?? ''}`);
  const t = ev.target;
  line(
    `target: ${Object.entries(t.regime).map(([k, v]) => `${k}=${v}`).join(', ')}; ${Object.entries(t.continuous)
      .map(([k, v]) => `${k}=${n(v as number)}`)
      .join(', ')} (pressure in kPa)`,
  );
  const ci = ev.counts.investigations;
  const cc = ev.counts.clusters;
  line(`investigations: ${VERDICTS.map((v) => `${v} ${ci[v]}`).join(' · ')}`);
  line(`clusters:       ${VERDICTS.map((v) => `${v} ${cc[v]}`).join(' · ')}`);
  line(`records: ${ev.counts.recordsUsed} counted, ${ev.counts.recordsFlaggedInsufficient} flagged insufficient_evidence (never counted)`);
  for (const c of [...ev.ranked, ...ev.unranked]) {
    const d = doi.get(c.accession);
    const head = `${c.accession}${d ? ` (doi:${d})` : ''} [${regimeText(c)}] ${c.tests.length} test(s)`;
    const rank = c.rank !== null ? ` #${c.rank} distance ${n(c.distance as number)}` : '';
    line(`  ${c.verdict}${rank} — ${head}`);
    for (const r of c.reasons.filter((x) => !x.informational)) {
      const cite = r.citations[0];
      const where = cite ? `  ← ${cite.accession}/${cite.test_id} ${cite.source_file} ${cite.source_location}${r.citations.length > 1 ? ` (+${r.citations.length - 1})` : ''}` : '';
      line(`      ${r.message}${where}`);
    }
    if (c.rank === null && c.hull) {
      line(`      context only (not a verdict): target (O2, pressure) is ${c.hull.inside ? 'inside' : 'outside'} this cluster's measured hull of ${c.hull.pointCount} point(s)`);
    }
  }
  const loc = locateTarget(presetTarget(id), envelopes);
  const same = loc.filter((l) => l.sameRegime === true);
  line(`envelopes in the same regime as the target: ${same.length} of ${loc.length} regime combination(s)`);
  // Geometry only: where the target's (O2, pressure) falls against each investigation's measured hull,
  // whatever its regime. Context for the chart; not a verdict.
  const per = new Map<string, { inside: boolean; nearest: number }>();
  const listed = new Set<string>();
  for (const l of loc) {
    for (const i of l.investigations) {
      listed.add(i.accession);
      if (i.insideHull === null) continue;
      const e = per.get(i.accession) ?? { inside: false, nearest: Infinity };
      per.set(i.accession, { inside: e.inside || i.insideHull, nearest: Math.min(e.nearest, i.hullDistance as number) });
    }
  }
  const order = [...per.keys()].sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
  line('geometry only, (O2, pressure) plane, any regime (context, not a verdict):');
  const ins = order.filter((a) => per.get(a)?.inside);
  const outs = order.filter((a) => !per.get(a)?.inside);
  line(`  inside the measured hull of a cluster of: ${ins.length > 0 ? ins.join(', ') : 'none'}`);
  line(`  outside every measured hull of: ${outs.length > 0 ? outs.map((a) => `${a} (normalized distance ${n(per.get(a)?.nearest as number)})`).join(', ') : 'none'}`);
  const noPlane = [...listed].filter((a) => !per.has(a)).sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
  if (noPlane.length > 0) line(`  no test with both O2 and pressure: ${noPlane.join(', ')}`);
}

console.log(out.join('\n'));
