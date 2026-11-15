// threePartAnswer. Inline records are SYNTHETIC; real records are used when present.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  EXPERIMENT_LABEL,
  PRESETS,
  REGIME_VALUES,
  canonicalJson,
  evaluate,
  parseConditionCsv,
  parseInvestigationCatalog,
  presetTarget,
  sha256Hex,
  threePartAnswer,
  type AnswerMode,
  type ConditionRecord,
  type Target,
  type ThreePartAnswer,
} from '../src/index.ts';
import { loadConditionDir } from '../src/load.ts';

const HEAD = 'accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note';
const row = (acc: string, test: string, variable: string, value: string, unit = '') =>
  `${acc},${test},${variable},${value},${unit},${value},${unit},table,SYNTHETIC/${acc}.csv,row=${test},SYNTHETIC TEST FIXTURE,verified,SYNTHETIC - not NASA data`;
function synthetic(): ConditionRecord[] {
  const L = [HEAD];
  const inv = (acc: string, phase: string, regime: string, o2: string, p: string) =>
    L.push(row(acc, '*', 'gravity_regime', regime), row(acc, '*', 'fuel_phase', phase), row(acc, 'T1', 'o2_mole_fraction', o2, '1'), row(acc, 'T1', 'pressure', p, 'kPa'));
  inv('PSI-9901', 'gas', 'microgravity', '0.21', '101.325'); // comparable at the ISS target
  inv('PSI-9902', 'solid', 'microgravity', '0.21', '95'); // just outside at 101.325
  inv('PSI-9903', 'solid', 'microgravity', '0.21', '30'); // far outside
  // PSI-9904: no pressure recorded (insufficient).
  L.push(row('PSI-9904', '*', 'gravity_regime', 'microgravity'), row('PSI-9904', 'T1', 'o2_mole_fraction', '0.21', '1'));
  // PSI-9905: tested at normal gravity only (a regime barrier for the ISS target).
  inv('PSI-9905', 'solid', 'normal_gravity', '0.21', '101.325');
  const r = parseConditionCsv(L.join('\n'), 's.csv');
  assert.deepEqual(r.rejected, []);
  return r.records;
}
const CATALOG = parseInvestigationCatalog(
  'accession,acronym,title,doi\nPSI-9901,SYN-GAS,Synthetic gas study,10.0000/s1\nPSI-9902,SYN-SOLID,Synthetic solid study,10.0000/s2\nPSI-9903,SYN-FAR,Synthetic far study,10.0000/s3\nPSI-9904,SYN-NOP,Synthetic study without pressure,10.0000/s4\nPSI-9905,SYN-EARTH,Synthetic ground study,10.0000/s5\n',
);

const ISS: Target = { regime: { gravity_regime: 'microgravity' }, continuous: { o2_mole_fraction: 0.21, pressure: 101.325 } };

/** The answer with every `sentence` removed: only facts are left. */
function facts(a: ThreePartAnswer): unknown {
  const strip = (x: unknown): unknown => (Array.isArray(x) ? x.map(strip) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'sentence' && k !== 'mode').map(([k, v]) => [k, strip(v)])) : x);
  return strip(a);
}
const both = (recs: readonly ConditionRecord[], t: Target) => {
  const o = { catalog: CATALOG };
  return { easy: threePartAnswer(recs, t, { ...o, mode: 'easy' }), advanced: threePartAnswer(recs, t, { ...o, mode: 'advanced' }) };
};
const sentences = (a: ThreePartAnswer) => [...a.known, ...a.unknown, ...a.next].map((x) => x.sentence);

function randomTarget(seed: number): Target {
  let s = seed;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const t: Target = { regime: {}, continuous: { o2_mole_fraction: Number((0.1 + rnd() * 0.5).toFixed(3)), pressure: Number((15 + rnd() * 120).toFixed(2)) } };
  for (const a of ['gravity_regime', 'fuel_phase'] as const) if (rnd() < 0.7) t.regime[a] = REGIME_VALUES[a][Math.floor(rnd() * REGIME_VALUES[a].length)];
  return t;
}

describe('sha256Hex', () => {
  it('matches the standard vectors and Node on arbitrary text (including multi-byte characters)', () => {
    assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    for (const t of ['x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'é€😀'.repeat(50), JSON.stringify({ a: [1, 2, 3] })]) assert.equal(sha256Hex(t), createHash('sha256').update(t).digest('hex'));
  });
});

describe('threePartAnswer on synthetic records', () => {
  const recs = synthetic();
  const { easy, advanced } = both(recs, ISS);

  it('known: the APPLICABLE investigation with its receipts (accession, acronym, DOI, record ids)', () => {
    assert.equal(advanced.known.length, 1);
    const c = advanced.known[0].citations[0];
    assert.deepEqual([c.accession, c.acronym, c.doi], ['PSI-9901', 'SYN-GAS', '10.0000/s1']);
    assert.ok(c.recordIds.length >= 2);
    assert.ok(c.recordIds.every((id) => id.startsWith('PSI-9901|T1|') && id.includes('SYNTHETIC/PSI-9901.csv')));
    assert.match(advanced.known[0].sentence, /^PSI-9901 SYN-GAS \(doi:10\.0000\/s1\) is comparable: \d+ recorded values support this condition\.$/);
    assert.match(easy.known[0].sentence, /^A NASA experiment \(Synthetic gas study\) tested conditions like yours\.$/);
  });
  it('unknown: outside levels, insufficient by kind with counts, regime barriers; always "in PSI", never "no data exists"', () => {
    const by = (kind: string) => advanced.unknown.filter((u) => u.kind === kind);
    const outside = by('outside');
    assert.deepEqual(outside.map((u) => u.kind === 'outside' && [u.level, u.count]), [['just_outside', 1], ['far_outside', 1]]);
    const insufficient = by('insufficient');
    assert.ok(insufficient.some((u) => u.kind === 'insufficient' && u.code === 'AXIS_NOT_RECORDED' && u.axis === 'pressure' && u.count === 1 && u.accessions[0] === 'PSI-9904'));
    const regime = by('regime');
    assert.ok(regime.some((u) => u.kind === 'regime' && u.axis === 'gravity_regime' && u.accessions.includes('PSI-9905')));
    for (const u of advanced.unknown) {
      assert.ok(/in PSI/.test(u.sentence), u.sentence);
      assert.ok(!/no data exists/i.test(u.sentence));
    }
  });
  it('next: at most 3 routes, regime switches labelled, then the "What would close this gap" proposal', () => {
    const routes = advanced.next.filter((n) => n.kind === 'route');
    assert.ok(routes.length >= 1 && routes.length <= 3);
    const last = advanced.next[advanced.next.length - 1];
    assert.equal(last.kind, 'proposal');
    assert.ok(last.sentence.startsWith(EXPERIMENT_LABEL));
    assert.equal(last.kind === 'proposal' && last.action.label, EXPERIMENT_LABEL);
    for (const n of advanced.next) if (n.kind === 'route' && n.action.routeKind === 'different_regime') assert.match(n.sentence, /another regime, not a small step/);
    for (const n of easy.next) if (n.kind === 'route' && n.action.routeKind === 'different_regime') assert.match(n.sentence, /a different situation, not a small step/);
  });
  it('steps are the tools that actually ran; an answer with nothing to close runs only evaluate', () => {
    assert.deepEqual(advanced.steps, ['evaluate', 'routesToEvidence', 'experimentsNeeded']);
    const one = parseConditionCsv([HEAD, row('PSI-9906', '*', 'gravity_regime', 'microgravity'), row('PSI-9906', 'T1', 'o2_mole_fraction', '0.21', '1'), row('PSI-9906', 'T1', 'pressure', '101.325', 'kPa')].join('\n'), 's.csv').records;
    const a = threePartAnswer(one, ISS, { mode: 'advanced' });
    assert.deepEqual(a.steps, ['evaluate']);
    assert.deepEqual(a.next, []);
    assert.equal(a.known.length, 1);
    assert.deepEqual(a.unknown, []);
  });
  it('the fingerprint is the SHA-256 of the canonical evaluation, equal in both modes, independent of record order, and different for another target', () => {
    assert.match(advanced.fingerprint, /^[0-9a-f]{64}$/);
    assert.equal(advanced.fingerprint, easy.fingerprint);
    assert.equal(advanced.fingerprint, createHash('sha256').update(canonicalJson(evaluate(recs, ISS))).digest('hex'));
    assert.equal(threePartAnswer([...recs].reverse(), ISS, { mode: 'advanced' }).fingerprint, advanced.fingerprint);
    assert.notEqual(threePartAnswer(recs, { ...ISS, continuous: { ...ISS.continuous, pressure: 90 } }, { mode: 'advanced' }).fingerprint, advanced.fingerprint);
  });
  it('rejects an unknown mode', () => {
    assert.throws(() => threePartAnswer(recs, ISS, { mode: 'expert' as AnswerMode }), RangeError);
  });
});

describe('easy and advanced give the same facts', () => {
  const targets: Array<[string, Target]> = [
    ['Moon Base', presetTarget('challenge-lunar-base')],
    ['ISS', ISS],
    ['NASA exploration atmosphere', presetTarget('nesc-10.2psia-26.5o2-lunar')],
    ['random target', randomTarget(20261114)],
    ['another random target', randomTarget(7)],
  ];
  const sets: Array<[string, ConditionRecord[]]> = [['synthetic', synthetic()]];
  const dir = join(import.meta.dirname, '..', '..', 'data', 'conditions');
  if (existsSync(dir)) sets.push(['real', loadConditionDir(dir).records]);
  for (const [setName, recs] of sets) {
    for (const [name, t] of targets) {
      it(`${setName} / ${name}: strip the wording and the answers are identical; the wording rules hold`, () => {
        const { easy, advanced } = both(recs, t);
        assert.deepEqual(facts(easy), facts(advanced));
        assert.equal(easy.mode, 'easy');
        assert.equal(advanced.mode, 'advanced');
        assert.notDeepEqual(sentences(easy), sentences(advanced), 'the wording does differ');
        // Easy: no digits beyond oxygen %, pressure and gravity; no acronym.
        for (const s of sentences(easy)) {
          const text = s.replace(/\d+(?:\.\d+)?\s*(?:%|kPa|psia| g\b)/g, '').replace(/\(\s*\d+(?:\.\d+)? psia\)/g, '');
          assert.ok(!/\d/.test(text), `easy sentence has a number: ${s}`);
          if (setName === 'synthetic') assert.ok(!/\b[A-Z]{2,}[A-Z0-9-]*\b/.test(s.replace(/NASA/g, '')), `easy sentence has an acronym: ${s}`);
          assert.ok(!/PSI\b/.test(s), s);
        }
        // Advanced: never "no data exists", "in PSI" in the statements about what is not known.
        for (const u of advanced.unknown) assert.ok(/in PSI/.test(u.sentence) && !/no data exists/i.test(u.sentence), u.sentence);
        for (const s of sentences(advanced)) assert.ok(!/undefined|NaN|[a-z0-9]+_[a-z0-9_]+/.test(s), s);
        assert.ok(advanced.next.filter((n) => n.kind === 'route').length <= 3);
      });
    }
  }
  it('Moon Base on the real records: nothing applies, the untested regime is named, the proposal closes the list', () => {
    if (!existsSync(dir)) return;
    const real = loadConditionDir(dir).records;
    const manifest = join(import.meta.dirname, '..', '..', 'data', 'manifest', 'investigations.csv');
    const catalog = existsSync(manifest) ? parseInvestigationCatalog(readFileSync(manifest, 'utf8')) : undefined;
    const a = threePartAnswer(real, presetTarget('challenge-lunar-base'), { mode: 'advanced', ...(catalog ? { catalog } : {}) });
    assert.equal(a.known[0].sentence, 'Nothing in PSI applies directly to this condition.');
    assert.equal(a.known[0].citations.length, 0);
    assert.ok(a.unknown.some((u) => u.kind === 'regime' && u.axis === 'gravity_regime' && u.value === 'partial_gravity'));
    assert.equal(a.next[a.next.length - 1].kind, 'proposal');
    assert.ok(PRESETS.length > 0);
  });
});
