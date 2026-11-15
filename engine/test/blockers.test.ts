// NAVIGATOR N3: fixed reason codes for INSUFFICIENT_EVIDENCE / REGIME_BARRIER investigations. SYNTHETIC records.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { PRESETS, REGIME_VALUES, evaluate, parseConditionCsv, presetTarget, routesToEvidence, type ConditionRecord, type Evaluation, type Target } from '../src/index.ts';
import { loadConditionDir } from '../src/load.ts';
import { fixtureRecords } from './helpers.ts';

const HEAD = 'accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note';
const row = (acc: string, test: string, variable: string, value: string, unit = '', status = 'verified') =>
  `${acc},${test},${variable},${value},${unit},${value},${unit},table,SYNTHETIC/${acc}.csv,row=0,SYNTHETIC TEST FIXTURE,${status},SYNTHETIC - not NASA data`;
function records(): ConditionRecord[] {
  const L = [HEAD];
  const point = (acc: string, o2 = '0.21', p = '101.325') => L.push(row(acc, 'T1', 'o2_mole_fraction', o2, '1'), row(acc, 'T1', 'pressure', p, 'kPa'));
  // 9401: fuel phase not recorded.
  L.push(row('PSI-9401', '*', 'gravity_regime', 'microgravity'));
  point('PSI-9401');
  // 9402: only gas fuel.
  L.push(row('PSI-9402', '*', 'gravity_regime', 'microgravity'), row('PSI-9402', '*', 'fuel_phase', 'gas'));
  point('PSI-9402');
  // 9403: fuel phase recorded but flagged insufficient_evidence (never counts).
  L.push(row('PSI-9403', '*', 'gravity_regime', 'microgravity'), row('PSI-9403', '*', 'fuel_phase', 'solid', '', 'insufficient_evidence'));
  point('PSI-9403');
  // 9404: records disagree on fuel phase (two tests, same cluster key is impossible, so two values on '*').
  L.push(row('PSI-9404', '*', 'gravity_regime', 'microgravity'), row('PSI-9404', '*', 'fuel_phase', 'solid'), row('PSI-9404', '*', 'fuel_phase', 'liquid'));
  point('PSI-9404');
  // 9405: no flow velocity recorded.
  L.push(row('PSI-9405', '*', 'gravity_regime', 'microgravity'), row('PSI-9405', '*', 'fuel_phase', 'solid'));
  point('PSI-9405');
  // 9406: O2 only in one test, pressure only in the other.
  L.push(row('PSI-9406', '*', 'gravity_regime', 'microgravity'), row('PSI-9406', '*', 'fuel_phase', 'solid'));
  L.push(row('PSI-9406', 'T1', 'o2_mole_fraction', '0.21', '1'), row('PSI-9406', 'T2', 'pressure', '101.325', 'kPa'));
  const r = parseConditionCsv(L.join('\n'), 's.csv');
  assert.deepEqual(r.rejected, []);
  return r.records;
}

const solid: Target = { regime: { gravity_regime: 'microgravity', fuel_phase: 'solid' }, continuous: { o2_mole_fraction: 0.21, pressure: 101.325 } };
const blockersOf = (ev: Evaluation, acc: string) => ev.investigations.find((i) => i.accession === acc)?.blockers ?? [];

describe('blockers: fixed codes, plain sentence, action', () => {
  const recs = records();
  const ev = evaluate(recs, solid);

  it('AXIS_NOT_RECORDED: "PSI-9401 did not record fuel phase" with the action "Leave fuel phase open."', () => {
    const b = blockersOf(ev, 'PSI-9401');
    assert.equal(b.length, 1);
    assert.equal(b[0].code, 'AXIS_NOT_RECORDED');
    assert.equal(b[0].axis, 'fuel_phase');
    assert.equal(b[0].sentence, 'PSI-9401 did not record fuel phase.');
    assert.deepEqual(b[0].action, { kind: 'leave_open', axis: 'fuel_phase', sentence: 'Leave fuel phase open.' });
  });
  it('REGIME_NOT_TESTED: lists the tested values and the switch action (another regime)', () => {
    const b = blockersOf(ev, 'PSI-9402');
    assert.equal(b[0].code, 'REGIME_NOT_TESTED');
    assert.deepEqual(b[0].testedValues, ['gas']);
    assert.equal(b[0].sentence, 'PSI-9402 was tested only in gaseous fuel, not in solid fuel (fuel phase).');
    assert.equal(b[0].action?.kind, 'switch_regime');
    assert.equal(b[0].action?.to, 'gas');
    assert.match(b[0].action?.sentence ?? '', /another regime, not a small step/);
  });
  it('NO_USABLE_VALUE: records exist but are flagged', () => {
    const b = blockersOf(ev, 'PSI-9403');
    assert.equal(b[0].code, 'NO_USABLE_VALUE');
    assert.equal(b[0].axis, 'fuel_phase');
    assert.match(b[0].sentence, /has records for fuel phase, but none can be used as evidence/);
  });
  it('RECORDS_DISAGREE: names both values', () => {
    const b = blockersOf(ev, 'PSI-9404');
    assert.equal(b[0].code, 'RECORDS_DISAGREE');
    assert.deepEqual(b[0].testedValues, ['liquid', 'solid']);
    assert.match(b[0].sentence, /disagree on fuel phase \(liquid fuel \/ solid fuel\)/);
  });
  it('a continuous axis the investigation did not record is AXIS_NOT_RECORDED too', () => {
    const t: Target = { ...solid, continuous: { ...solid.continuous, flow_velocity: 10 } };
    const b = blockersOf(evaluate(recs, t), 'PSI-9405');
    assert.equal(b[0].code, 'AXIS_NOT_RECORDED');
    assert.equal(b[0].axis, 'flow_velocity');
    assert.equal(b[0].action?.sentence, 'Leave flow velocity open.');
  });
  it('axes recorded in different tests only: AXES_NOT_RECORDED_TOGETHER', () => {
    const b = blockersOf(evaluate(recs, solid), 'PSI-9406');
    assert.ok(b.some((x) => x.code === 'AXES_NOT_RECORDED_TOGETHER' && x.axis === null));
  });
  it('APPLICABLE and EXTRAPOLATION investigations carry no blockers', () => {
    for (const i of ev.investigations) if (i.verdict === 'APPLICABLE' || i.verdict === 'EXTRAPOLATION') assert.equal(i.blockers, undefined, i.accession);
  });
  it('the action matches what routesToEvidence would do', () => {
    const rs = routesToEvidence(recs, solid);
    const open = rs.routes.find((r) => r.accession === 'PSI-9401');
    assert.equal(open?.changes[0].sentence, 'Leave fuel phase open: PSI-9401 did not record it.');
    const sw = rs.routes.find((r) => r.accession === 'PSI-9402');
    assert.equal(sw?.changes.find((c) => c.kind === 'switch_regime')?.to, blockersOf(ev, 'PSI-9402')[0].action?.to);
  });
});

describe('no "undefined" or raw distance in reason text', () => {
  const sets: Array<[string, ConditionRecord[]]> = [['fixtures', fixtureRecords()], ['inline', records()]];
  const dir = join(import.meta.dirname, '..', '..', 'data', 'conditions');
  if (existsSync(dir)) sets.push(['real', loadConditionDir(dir).records]);
  const lcg = (seed: number) => {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  };
  for (const [name, recs] of sets) {
    it(`${name}: every reason, blocker and distance note, for presets and random targets`, () => {
      const rnd = lcg(7);
      const targets: Target[] = PRESETS.map((p) => presetTarget(p.id));
      for (let i = 0; i < 25; i += 1) {
        const t: Target = { regime: {}, continuous: { o2_mole_fraction: 0.05 + rnd() * 0.55, pressure: 10 + rnd() * 140 } };
        for (const a of ['gravity_regime', 'fuel_phase', 'diluent', 'flame_type'] as const) if (rnd() < 0.5) t.regime[a] = REGIME_VALUES[a][Math.floor(rnd() * REGIME_VALUES[a].length)];
        if (rnd() < 0.3) t.continuous.flow_velocity = rnd() * 30;
        targets.push(t);
      }
      for (const t of targets) {
        const e = evaluate(recs, t);
        for (const c of [...e.ranked, ...e.unranked]) {
          assert.ok(!/undefined|NaN/.test(c.distanceNote), c.distanceNote);
          for (const r of c.reasons) assert.ok(!/undefined|NaN/.test(r.message), r.message);
        }
        for (const inv of e.investigations) {
          if (inv.verdict === 'INSUFFICIENT_EVIDENCE' || inv.verdict === 'REGIME_BARRIER') {
            assert.ok((inv.blockers ?? []).length > 0, `${inv.accession} ${inv.verdict} has a blocker`);
            for (const b of inv.blockers ?? []) assert.ok(!/undefined|NaN/.test(b.sentence + (b.action?.sentence ?? '')), b.sentence);
          }
        }
      }
    });
  }
});

describe('plural agreement in summary sentences', () => {
  const H = 'accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note';
  const build = (extraTests: number) => {
    const L = [H, row('PSI-9601', '*', 'gravity_regime', 'microgravity'), row('PSI-9601', 'T1', 'o2_mole_fraction', '0.21', '1'), row('PSI-9601', 'T1', 'pressure', '101.325', 'kPa')];
    // Tests that lack pressure (and so are not part of the envelope).
    for (let i = 0; i < extraTests; i += 1) L.push(row('PSI-9601', `X${i + 1}`, 'o2_mole_fraction', '0.25', '1'));
    return parseConditionCsv(L.join('\n'), 's.csv').records;
  };
  const message = (extra: number) => {
    const ev = evaluate(build(extra), { regime: { gravity_regime: 'microgravity' }, continuous: { o2_mole_fraction: 0.21, pressure: 101.325 } });
    return [...ev.ranked, ...ev.unranked].flatMap((c) => c.reasons.map((r) => r.message)).find((m) => /lack/.test(m)) as string;
  };
  it('1 of N tests lacks ... so it is not part; 2 of N tests lack ... so they are not part', () => {
    assert.match(message(1), /1 of 2 tests lacks a usable value for pressure, so it is not part of this envelope/);
    assert.match(message(2), /2 of 3 tests lack a usable value for pressure, so they are not part of this envelope/);
  });
  it('no "(s)" placeholders remain in engine reason text', () => {
    const msgs = [message(1), message(2)];
    for (const m of msgs) assert.ok(!/\(s\)/.test(m), m);
  });
});
