// routesToEvidence (NAVIGATOR N1). Records marked SYNTHETIC are invented to exercise the rules, not NASA data.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  PRESETS,
  REGIME_VALUES,
  canonicalJson,
  evaluate,
  parseConditionCsv,
  presetTarget,
  routesToEvidence,
  type ConditionRecord,
  type Route,
  type Target,
} from '../src/index.ts';
import { loadConditionDir } from '../src/load.ts';
import { fixtureRecords } from './helpers.ts';

const HEAD = 'accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note';
const row = (acc: string, test: string, variable: string, value: string, unit = '') =>
  `${acc},${test},${variable},${value},${unit},${value},${unit},table,SYNTHETIC/${acc}.csv,row=0,SYNTHETIC TEST FIXTURE,verified,SYNTHETIC - not NASA data`;
function synthetic(): ConditionRecord[] {
  const L = [HEAD];
  // PSI-9301: microgravity, diluent N2, fuel phase NOT recorded. Triangle in (O2, pressure).
  L.push(row('PSI-9301', '*', 'gravity_regime', 'microgravity'), row('PSI-9301', '*', 'diluent', 'N2'));
  for (const [t, o2, p] of [['T1', '0.17', '70'], ['T2', '0.30', '70'], ['T3', '0.25', '101.325']]) L.push(row('PSI-9301', t, 'o2_mole_fraction', o2, '1'), row('PSI-9301', t, 'pressure', p, 'kPa'));
  // PSI-9302: only tested with GAS fuel in microgravity (a regime the target below does not share).
  L.push(row('PSI-9302', '*', 'gravity_regime', 'microgravity'), row('PSI-9302', '*', 'fuel_phase', 'gas'), row('PSI-9302', '*', 'diluent', 'N2'));
  L.push(row('PSI-9302', 'T1', 'o2_mole_fraction', '0.21', '1'), row('PSI-9302', 'T1', 'pressure', '101.325', 'kPa'));
  // PSI-9303: solid, microgravity, N2; one test at 21 % and 1 atm.
  L.push(row('PSI-9303', '*', 'gravity_regime', 'microgravity'), row('PSI-9303', '*', 'fuel_phase', 'solid'), row('PSI-9303', '*', 'diluent', 'N2'));
  L.push(row('PSI-9303', 'T1', 'o2_mole_fraction', '0.21', '1'), row('PSI-9303', 'T1', 'pressure', '101.325', 'kPa'), row('PSI-9303', 'T1', 'flow_velocity', '10', 'cm/s'));
  const r = parseConditionCsv(L.join('\n'), 'synthetic.csv');
  assert.deepEqual(r.rejected, []);
  return r.records;
}

const target = (regime: Target['regime'], o2: number, p: number, extra: Target['continuous'] = {}): Target => ({
  regime,
  continuous: { o2_mole_fraction: o2, pressure: p, ...extra },
});
const verdictOf = (records: readonly ConditionRecord[], t: Target, accession: string) => evaluate(records, t).investigations.find((i) => i.accession === accession)?.verdict;

describe('routesToEvidence: what each kind of route looks like', () => {
  const recs = synthetic();
  const solidMicro = { gravity_regime: 'microgravity', fuel_phase: 'solid', diluent: 'N2' };

  it('leaving open an axis the investigation did not record: "leave fuel phase open: PSI-9301 did not record it"', () => {
    const t = target(solidMicro, 0.25, 90);
    assert.notEqual(verdictOf(recs, t, 'PSI-9301'), 'APPLICABLE');
    const r = routesToEvidence(recs, t);
    const route = r.routes.find((x) => x.accession === 'PSI-9301') as Route;
    assert.equal(route.kind, 'leave_open');
    assert.equal(route.changeCount, 1);
    assert.equal(route.changes[0].kind, 'leave_open');
    assert.equal(route.changes[0].axis, 'fuel_phase');
    assert.equal(route.changes[0].sentence, 'Leave fuel phase open: PSI-9301 did not record it.');
    assert.equal(route.target.regime.fuel_phase, undefined);
    assert.equal(verdictOf(recs, route.target, 'PSI-9301'), 'APPLICABLE');
  });

  it('a move goes to the nearest tested point, with exact values and the records that define the edge', () => {
    const t = target(solidMicro, 0.5, 101.325);
    const route = routesToEvidence(recs, t).routes.find((x) => x.accession === 'PSI-9303') as Route;
    assert.equal(route.kind, 'move');
    const o2 = route.changes.find((c) => c.axis === 'o2_mole_fraction');
    assert.equal(o2?.from, 0.5);
    assert.equal(o2?.to, 0.21);
    assert.equal(route.changes.find((c) => c.axis === 'pressure'), undefined, 'pressure is already tested: no move');
    assert.ok((o2?.citations.length ?? 0) > 0);
    assert.ok(o2?.citations.every((c) => c.accession === 'PSI-9303' && c.source_file.startsWith('SYNTHETIC/')));
    assert.match(route.sentence, /Move oxygen from 50 % to 21 %/);
    assert.ok(route.distance > 0);
    assert.equal(verdictOf(recs, route.target, 'PSI-9303'), 'APPLICABLE');
  });

  it('a move onto a hull edge moves both plane axes to a point on that edge', () => {
    const t = target(solidMicro, 0.17, 110);
    const route = routesToEvidence(recs, t).routes.find((x) => x.accession === 'PSI-9301') as Route;
    const moved = route.changes.filter((c) => c.kind === 'move').map((c) => c.axis);
    assert.ok(moved.includes('pressure'));
    assert.ok((route.target.continuous.pressure as number) < 110);
    assert.equal(verdictOf(recs, route.target, 'PSI-9301'), 'APPLICABLE');
  });

  it('a regime the investigation never tested is kind different_regime and is ranked after every move or leave-open route', () => {
    const t = target(solidMicro, 0.5, 70);
    const r = routesToEvidence(recs, t);
    const gas = r.routes.find((x) => x.accession === 'PSI-9302') as Route;
    assert.equal(gas.kind, 'different_regime');
    assert.equal(gas.changes.find((c) => c.kind === 'switch_regime')?.axis, 'fuel_phase');
    assert.match(gas.sentence, /Switch fuel phase from solid fuel to gaseous fuel/);
    assert.match(gas.sentence, /another regime, not a small step/);
    assert.deepEqual(gas.testedRegimes, [{ gravity_regime: 'microgravity', fuel_phase: 'gas', diluent: 'N2' }]);
    const firstSwitch = r.routes.findIndex((x) => x.kind === 'different_regime');
    assert.ok(r.routes.slice(firstSwitch).every((x) => x.kind === 'different_regime'), 'switches are all after the others');
    assert.equal(verdictOf(recs, gas.target, 'PSI-9302'), 'APPLICABLE');
  });

  it('a regime switch with zero distance still never ranks before a move that costs more', () => {
    const t = target(solidMicro, 0.21, 101.325);
    const r = routesToEvidence(recs, t);
    const gas = r.routes.findIndex((x) => x.accession === 'PSI-9302');
    const open = r.routes.findIndex((x) => x.accession === 'PSI-9301');
    assert.ok(open >= 0 && gas >= 0 && open < gas);
  });

  it('APPLICABLE investigations get no route; the target is not modified', () => {
    const t = target(solidMicro, 0.21, 101.325);
    const before = canonicalJson(t);
    const r = routesToEvidence(recs, t);
    assert.ok(!r.routes.some((x) => x.accession === 'PSI-9303'));
    assert.equal(canonicalJson(t), before);
  });

  it('a target with a gravity level in continuous is handled as informational, with a note', () => {
    const t = target({ gravity_regime: 'microgravity' }, 0.5, 101.325, { gravity_level: 0 });
    const r = routesToEvidence(recs, t);
    assert.ok(r.notes[0].includes('shown, not compared'));
    assert.equal(r.target.continuous.gravity_level, undefined);
    assert.equal(r.target.informational?.gravity_level, 0);
    for (const x of r.routes) assert.equal(verdictOf(recs, x.target, x.accession), 'APPLICABLE');
  });

  it('a target above 1 g routes by switching the gravity regime, never by leaving it open', () => {
    const t: Target = { regime: {}, continuous: { o2_mole_fraction: 0.21, pressure: 101.325 }, informational: { gravity_level: 1.5, gravity_not_covered: 'above 1 g: not covered by this dataset' } };
    const r = routesToEvidence(recs, t);
    assert.ok(r.routes.length > 0);
    for (const x of r.routes) {
      assert.equal(x.kind, 'different_regime');
      assert.equal(verdictOf(recs, x.target, x.accession), 'APPLICABLE');
      assert.equal(x.target.informational?.gravity_not_covered, undefined);
    }
  });

  it('is deterministic and independent of record order', () => {
    const t = target(solidMicro, 0.5, 70);
    const a = canonicalJson(routesToEvidence(recs, t));
    assert.equal(canonicalJson(routesToEvidence([...recs].reverse(), t)), a);
  });

  it('no reason or sentence ever contains "undefined" or "NaN"', () => {
    const r = routesToEvidence(recs, target(solidMicro, 0.5, 70));
    const text = JSON.stringify(r.routes.map((x) => [x.sentence, x.changes.map((c) => c.sentence)]).concat([r.unreachable.map((u) => u.reason)] as never));
    assert.ok(!/undefined|NaN/.test(text));
  });
});

// ---------- the invariant, on presets and 50 seeded random targets ----------

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
function randomTarget(rnd: () => number): Target {
  const t: Target = { regime: {}, continuous: {} };
  for (const axis of ['gravity_regime', 'fuel_phase', 'diluent', 'flame_type'] as const) {
    if (rnd() < 0.5) {
      const vals = REGIME_VALUES[axis];
      t.regime[axis] = vals[Math.floor(rnd() * vals.length)];
    }
  }
  if (rnd() < 0.9) t.continuous.o2_mole_fraction = Number((0.05 + rnd() * 0.55).toFixed(4));
  if (rnd() < 0.9) t.continuous.pressure = Number((10 + rnd() * 140).toFixed(3));
  if (rnd() < 0.2) t.continuous.flow_velocity = Number((rnd() * 40).toFixed(2));
  if (rnd() < 0.1) t.continuous.sample_thickness = Number((rnd() * 5).toFixed(2));
  return t;
}

function checkInvariant(label: string, recs: readonly ConditionRecord[], t: Target) {
  const ev = evaluate(recs, routesToEvidence(recs, t).target);
  const r = routesToEvidence(recs, t);
  const notApplicable = ev.investigations.filter((i) => i.verdict !== 'APPLICABLE').map((i) => i.accession);
  // Every non-APPLICABLE investigation has a route or an explained reason, and nothing else has a route.
  const covered = [...r.routes.map((x) => x.accession), ...r.unreachable.map((u) => u.accession)].sort();
  assert.deepEqual(covered, [...notApplicable].sort(), `${label}: routes + unreachable cover exactly the non-APPLICABLE investigations`);
  const seen = new Set<string>();
  for (const route of r.routes) {
    assert.ok(!seen.has(route.accession), `${label}: one route per investigation`);
    seen.add(route.accession);
    assert.equal(verdictOf(recs, route.target, route.accession), 'APPLICABLE', `${label}: route of ${route.accession} (${route.kind}): ${route.sentence}`);
    assert.ok(route.changeCount >= 1 && route.changes.length === route.changeCount);
    assert.ok(!/undefined|NaN/.test(route.sentence), `${label}: sentence text`);
    // Gravity regime is never left open; no change is a no-op within the measurement tolerance.
    assert.ok(!route.changes.some((c) => c.kind === 'leave_open' && c.axis === 'gravity_regime'), `${label}: ${route.accession} leaves gravity open`);
    for (const c of route.changes) {
      if (c.kind === 'move') assert.ok(Math.abs((c.to as number) - (c.from as number)) > 0.005 * Math.abs(c.from as number), `${label}: no-op move ${c.sentence}`);
    }
  }
  const firstSwitch = r.routes.findIndex((x) => x.kind === 'different_regime');
  if (firstSwitch >= 0) assert.ok(r.routes.slice(firstSwitch).every((x) => x.kind === 'different_regime'), `${label}: regime switches ranked after every other route`);
  for (let i = 1; i < r.routes.length; i += 1) {
    const a = r.routes[i - 1];
    const b = r.routes[i];
    if ((a.kind === 'different_regime') === (b.kind === 'different_regime')) {
      assert.ok(a.changeCount < b.changeCount || (a.changeCount === b.changeCount && a.distance <= b.distance + 1e-12), `${label}: order by changes then distance`);
    }
  }
}

describe('routesToEvidence: applying a route gives APPLICABLE under evaluate()', () => {
  const sets: Array<[string, ConditionRecord[]]> = [['synthetic fixtures', fixtureRecords()], ['inline synthetic', synthetic()]];
  const realDir = join(import.meta.dirname, '..', '..', 'data', 'conditions');
  if (existsSync(realDir)) sets.push(['real records', loadConditionDir(realDir).records]);

  for (const [name, recs] of sets) {
    it(`${name}: every preset, and with the gravity regime switched`, () => {
      for (const p of PRESETS) {
        checkInvariant(`${name}/${p.id}`, recs, presetTarget(p.id));
        for (const g of ['microgravity', 'normal_gravity'] as const) checkInvariant(`${name}/${p.id}+${g}`, recs, presetTarget(p.id, { gravity_regime: g }));
      }
    });
    it(`${name}: 50 seeded random targets`, () => {
      const rnd = lcg(20261114);
      for (let i = 0; i < 50; i += 1) checkInvariant(`${name}/random#${i}`, recs, randomTarget(rnd));
    });
  }
});

describe('routes: gravity is never left open; no-op moves are dropped', () => {
  const HEAD2 = 'accession,test_id,variable,value,unit,value_original,unit_original,method,source_file,source_location,quote,status,note';
  const r2 = (acc: string, test: string, variable: string, value: string, unit = '') =>
    `${acc},${test},${variable},${value},${unit},${value},${unit},table,SYNTHETIC/${acc}.csv,row=0,SYNTHETIC TEST FIXTURE,verified,SYNTHETIC - not NASA data`;
  const recs = parseConditionCsv(
    [
      HEAD2,
      // PSI-9501 states no gravity regime at all (like an investigation whose records omit it).
      r2('PSI-9501', 'T1', 'o2_mole_fraction', '0.21', '1'), r2('PSI-9501', 'T1', 'pressure', '101.325', 'kPa'),
      // PSI-9502: microgravity, tested as a segment 17-30 % O2 at 70 kPa; target pressure will be inside only via tolerance.
      r2('PSI-9502', '*', 'gravity_regime', 'microgravity'),
      r2('PSI-9502', 'T1', 'o2_mole_fraction', '0.17', '1'), r2('PSI-9502', 'T1', 'pressure', '70', 'kPa'),
      r2('PSI-9502', 'T2', 'o2_mole_fraction', '0.30', '1'), r2('PSI-9502', 'T2', 'pressure', '70', 'kPa'),
    ].join('\n'),
    's.csv',
  ).records;

  it('an investigation that states no gravity regime is unreachable for a target that states gravity, with the fixed reason', () => {
    const r = routesToEvidence(recs, target({ gravity_regime: 'microgravity' }, 0.21, 101.325));
    assert.ok(!r.routes.some((x) => x.accession === 'PSI-9501'));
    assert.equal(r.unreachable.find((u) => u.accession === 'PSI-9501')?.reason, 'the extracted records do not state its gravity regime, so it cannot be compared on gravity');
  });
  it('leaving fuel phase open stays allowed', () => {
    const r = routesToEvidence(synthetic(), target({ gravity_regime: 'microgravity', fuel_phase: 'solid', diluent: 'N2' }, 0.25, 90));
    assert.ok(r.routes.some((x) => x.changes.some((c) => c.kind === 'leave_open' && c.axis === 'fuel_phase')));
  });
  it('a target whose pressure is inside only by tolerance gets no pressure change, only the oxygen move', () => {
    const t = target({ gravity_regime: 'microgravity' }, 0.5, 70.2); // 70.2 is within 0.5 % of 70
    const route = routesToEvidence(recs, t).routes.find((x) => x.accession === 'PSI-9502') as Route;
    assert.deepEqual(route.changes.map((c) => c.axis), ['o2_mole_fraction']);
    assert.ok(!/pressure/.test(route.sentence));
    assert.equal(verdictOf(recs, route.target, 'PSI-9502'), 'APPLICABLE');
  });
  it('the real records: which investigations state no gravity regime (data question for the extraction)', () => {
    const dir = join(import.meta.dirname, '..', '..', 'data', 'conditions');
    if (!existsSync(dir)) return;
    const real = loadConditionDir(dir).records;
    const r = routesToEvidence(real, presetTarget('challenge-lunar-base'));
    const noGravity = r.unreachable.filter((u) => /do not state its gravity regime/.test(u.reason)).map((u) => u.accession);
    console.log(`investigations with no usable gravity_regime record: ${noGravity.join(', ') || 'none'}`);
    assert.ok(!r.routes.some((x) => noGravity.includes(x.accession)));
  });
});
