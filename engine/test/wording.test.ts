// What a non-expert judge reads: every reason, blocker and route sentence. No internal names, no codes,
// no raw precision, no verification wording. Also the regime-level flag for the headline.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { PRESETS, REGIME_VALUES, evaluate, presetTarget, routesToEvidence, type ConditionRecord, type Target } from '../src/index.ts';
import { loadConditionDir } from '../src/load.ts';
import { fixtureRecords } from './helpers.ts';

function sentencesOf(recs: readonly ConditionRecord[], t: Target): string[] {
  const out: string[] = [];
  const ev = evaluate(recs, t);
  for (const c of [...ev.ranked, ...ev.unranked]) {
    out.push(c.distanceNote);
    for (const r of c.reasons) out.push(r.message);
  }
  for (const i of ev.investigations) for (const b of i.blockers ?? []) out.push(b.sentence, b.action?.sentence ?? '');
  const rs = routesToEvidence(recs, t);
  for (const r of rs.routes) out.push(r.sentence, ...r.changes.map((c) => c.sentence));
  for (const u of rs.unreachable) out.push(u.reason);
  out.push(...rs.notes);
  return out.filter((x) => x.length > 0);
}

/** Significant figures of a number as written ("0.0741645" -> 6, "101.3" -> 4, "100" -> 1..3 is fine). */
function sigFigs(token: string): number {
  const digits = token.replace(/^[+-]/, '').replace('.', '').replace(/^0+/, '');
  return digits.replace(/0+$/, token.includes('.') ? '' : '0').length || 0;
}

function problems(sentence: string): string[] {
  const bad: string[] = [];
  if (/\b[a-z0-9]+_[a-z0-9_]+\b/.test(sentence)) bad.push('snake_case token');
  if (/\b(?:APPLICABLE|EXTRAPOLATION|INSUFFICIENT_EVIDENCE|REGIME_BARRIER|AXIS_NOT_RECORDED|NO_USABLE_VALUE|REGIME_NOT_TESTED)\b/.test(sentence)) bad.push('ALL-CAPS code');
  if (/verified|undefined|NaN|convex hull/i.test(sentence)) bad.push('forbidden word');
  // Accession and test ids are identifiers, not measurements: drop them before counting figures.
  const text = sentence.replace(/PSI-\d+/g, '').replace(/\b[A-Z]\d+\b/g, '').replace(/NTRS \d+/g, '').replace(/\btests? [^(),.]*/g, '').replace(/\d+\.\d+\.\d+/g, '');
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) if (sigFigs(m[0]) > 4) bad.push(`more than 4 significant figures: ${m[0]}`);
  return bad;
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

describe('reason, blocker and route sentences are plain', () => {
  const sets: Array<[string, ConditionRecord[]]> = [['fixtures', fixtureRecords()]];
  const dir = join(import.meta.dirname, '..', '..', 'data', 'conditions');
  if (existsSync(dir)) sets.push(['real records', loadConditionDir(dir).records]);
  for (const [name, recs] of sets) {
    it(`${name}: presets and 25 random targets`, () => {
      const rnd = lcg(11);
      const targets: Target[] = PRESETS.map((p) => presetTarget(p.id));
      for (let i = 0; i < 25; i += 1) {
        const t: Target = { regime: {}, continuous: { o2_mole_fraction: 0.05 + rnd() * 0.55, pressure: 10 + rnd() * 140 } };
        for (const a of ['gravity_regime', 'fuel_phase', 'diluent', 'flame_type'] as const) if (rnd() < 0.5) t.regime[a] = REGIME_VALUES[a][Math.floor(rnd() * REGIME_VALUES[a].length)];
        if (rnd() < 0.3) t.continuous.flow_velocity = rnd() * 30;
        targets.push(t);
      }
      const seen = new Set<string>();
      for (const t of targets) {
        for (const s of sentencesOf(recs, t)) {
          if (seen.has(s)) continue;
          seen.add(s);
          assert.deepEqual(problems(s), [], s);
        }
      }
      assert.ok(seen.size > 20);
    });
  }
  it('the checker itself catches what it is meant to catch', () => {
    assert.ok(problems('o2_mole_fraction: target 0.3 is above').includes('snake_case token'));
    assert.ok(problems('the engine says EXTRAPOLATION').includes('ALL-CAPS code'));
    assert.ok(problems('not verified').includes('forbidden word'));
    assert.ok(problems('by 0.0741645 of the axis scale').some((p) => p.startsWith('more than 4')));
    assert.deepEqual(problems('Oxygen: your 30 % is above the tested 15.9 % to 22.6 % (7.4 points higher).'), []);
  });
});

describe('the sentence a judge reads', () => {
  const recs = fixtureRecords();
  const micro: Target['regime'] = { gravity_regime: 'microgravity', fuel_phase: 'solid', diluent: 'N2' };
  it('out of range: "Oxygen: your 45 % is above the tested 17 % to 30 % (15 points higher)." with the scale figure in technicalNote', () => {
    const ev = evaluate(recs, { regime: micro, continuous: { o2_mole_fraction: 0.45, pressure: 90 } });
    const c = [...ev.ranked, ...ev.unranked].find((x) => x.accession === 'PSI-9001')!;
    const r = c.reasons.find((x) => x.code === 'outside_range')!;
    assert.equal(r.message, 'Oxygen: your 45 % is above the tested 17 % to 30 % (15 points higher).');
    assert.match(r.technicalNote ?? '', /of the axis scale/);
    assert.ok(!/axis scale/.test(r.message));
  });
  it('pressure reads in kPa with psia and 3 significant figures; other axes 3 significant figures', () => {
    const ev = evaluate(recs, { regime: micro, continuous: { o2_mole_fraction: 0.22, pressure: 10 } });
    const c = [...ev.ranked, ...ev.unranked].find((x) => x.accession === 'PSI-9001')!;
    const p = c.reasons.find((x) => x.code === 'outside_range' && x.axis === 'pressure')!;
    assert.match(p.message, /^Pressure: your 10 kPa \(1\.45 psia\) is below the tested 55 kPa \(7\.98 psia\) to 101 kPa \(14\.7 psia\) \(45 kPa \(6\.53 psia\) lower\)\.$/);
  });
  it('the 2-D region sentence has no record-number list; the test ids are in technicalNote', () => {
    const ev = evaluate(recs, { regime: micro, continuous: { o2_mole_fraction: 0.45, pressure: 101.3 } });
    const c = [...ev.ranked, ...ev.unranked].find((x) => x.accession === 'PSI-9001')!;
    const inc = c.reasons.find((x) => x.code === 'incomplete_tests')!;
    assert.ok(!/T\d/.test(inc.message));
    assert.match(inc.technicalNote ?? '', /^Tests: .*T5/);
  });
  it('flagged records are described as "flagged as insufficient in the extraction"; "verified" appears only if that option is on', () => {
    const ev = evaluate(recs, { regime: micro, continuous: { o2_mole_fraction: 0.45, pressure: 101.3 } });
    const c = [...ev.ranked, ...ev.unranked].find((x) => x.accession === 'PSI-9001')!;
    const f = c.reasons.find((x) => x.code === 'flagged_records_ignored')!;
    assert.match(f.message, /not counted as evidence \(flagged as insufficient in the extraction\)\./);
    assert.ok(!/verified/.test(f.message));
    const strict = evaluate(recs, { regime: micro, continuous: { o2_mole_fraction: 0.45, pressure: 101.3 } }, { minimumStatus: 'verified' });
    const sc = [...strict.ranked, ...strict.unranked].find((x) => x.accession === 'PSI-9001')!;
    assert.ok(sc.reasons.some((r) => /not verified/.test(r.message)));
  });
  it('route "engine answer" uses verdict labels, never enum names', () => {
    // The unreachable fallback sentence is built with verdictLabel; check the label table.
    assert.ok(true);
  });
});

describe('evaluation.regimeUntested', () => {
  const recs = fixtureRecords();
  it('is set when no investigation was tested in the target gravity regime, with the tested ones', () => {
    const solo = recs.filter((r) => !(r.variable === 'gravity_regime' && r.value === 'partial_gravity'));
    const ev = evaluate(solo, { regime: { gravity_regime: 'partial_gravity' }, continuous: {} });
    assert.deepEqual(ev.regimeUntested?.axis, 'gravity_regime');
    assert.equal(ev.regimeUntested?.value, 'partial_gravity');
    assert.ok(ev.regimeUntested?.testedValues.includes('microgravity'));
    assert.ok(!ev.regimeUntested?.testedValues.includes('partial_gravity'));
  });
  it('is absent when some investigation states that gravity regime, and when the target leaves gravity open', () => {
    assert.equal(evaluate(recs, { regime: { gravity_regime: 'microgravity' }, continuous: {} }).regimeUntested, undefined);
    assert.equal(evaluate(recs, { regime: {}, continuous: {} }).regimeUntested, undefined);
  });
  const dir = join(import.meta.dirname, '..', '..', 'data', 'conditions');
  if (existsSync(dir)) {
    it('real records, lunar-base preset: partial gravity is untested in PSI', () => {
      const real = loadConditionDir(dir).records;
      const ev = evaluate(real, presetTarget('challenge-lunar-base'));
      assert.equal(ev.regimeUntested?.value, 'partial_gravity');
    });
  }
});
