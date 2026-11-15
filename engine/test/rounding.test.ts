// Wording a judge reads: no raw floats in sentences, and no "tested only in" for records that merely lack comparable values.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MOON_BASE_BAND, MINIMUM_TEST_SET_RULE, erlFor, evaluate, experimentsNeeded, gapReport, routesToEvidence, threePartAnswer, type Target } from '../src/index.ts';
import { fixtureRecords } from './helpers.ts';

const records = fixtureRecords();
const ugly: Target[] = [
  { regime: { gravity_regime: 'microgravity', fuel_phase: 'solid' }, continuous: { o2_mole_fraction: 0.22721982701616103, pressure: 83.123456789 } },
  { regime: { gravity_regime: 'normal_gravity' }, continuous: { o2_mole_fraction: 0.3123456, pressure: 101.31234567 } },
  { regime: { gravity_regime: 'partial_gravity' }, continuous: { o2_mole_fraction: 0.34000001, pressure: 56.53700980398055 } },
];

function strings(x: unknown, path = '', out: { path: string; text: string }[] = []): { path: string; text: string }[] {
  if (path.includes('citations')) return out; // receipts carry the record values as written in the data
  if (typeof x === 'string') out.push({ path, text: x });
  else if (Array.isArray(x)) x.forEach((v, i) => strings(v, `${path}[${i}]`, out));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) strings(v, `${path}.${k}`, out);
  return out;
}

describe('no raw floats in engine sentences', () => {
  for (const [i, t] of ugly.entries()) {
    it(`target ${i}: no number with five or more decimals outside receipts`, () => {
      const ev = evaluate(records, t);
      const parts: unknown[] = [
        experimentsNeeded(records, t),
        threePartAnswer(records, t, { mode: 'easy' }),
        threePartAnswer(records, t, { mode: 'advanced' }),
        routesToEvidence(records, t),
        ev.investigations,
        [...ev.ranked, ...ev.unranked].map((c) => ({ note: c.distanceNote, reasons: c.reasons.map((r) => r.message), axes: c.axes })),
        erlFor(records, t),
      ];
      const bad = strings(parts).filter((s) => /\d+\.\d{5,}/.test(s.text) && !/doi:|10\.\d{4}\//.test(s.text));
      assert.deepEqual(bad.map((b) => `${b.path}: ${b.text.slice(0, 80)}`), []);
    });
  }

  it('the gap report has none either', () => {
    assert.doesNotMatch(gapReport(records, MOON_BASE_BAND).markdown, /\d+\.\d{5,}/);
  });
});

describe('regime wording: comparable records, not "tested only in"', () => {
  it('blocker, route and three-part sentences say "comparable ... records only in"', () => {
    const t: Target = { regime: { gravity_regime: 'normal_gravity', fuel_phase: 'liquid' }, continuous: { o2_mole_fraction: 0.22, pressure: 90 } };
    const ev = evaluate(records, t);
    const sentences = [
      ...ev.investigations.flatMap((i) => (i.blockers ?? []).map((b) => b.sentence)),
      ...strings(routesToEvidence(records, t)).map((s) => s.text),
      ...strings(threePartAnswer(records, t, { mode: 'advanced' })).map((s) => s.text),
      ...strings(threePartAnswer(records, t, { mode: 'easy' })).map((s) => s.text),
    ];
    assert.ok(sentences.some((s) => /comparable (oxygen and pressure )?records only/.test(s)));
    assert.deepEqual(sentences.filter((s) => /\b(?:was|were) tested only in\b/.test(s)), []);
  });
});

describe('the minimum test set never reads as "this closes the gap"', () => {
  it('states the convention, the per-material scope and the non-monotonic limits', () => {
    assert.match(MINIMUM_TEST_SET_RULE, /PYRION's convention that the region between measured tests counts as covered/);
    assert.match(MINIMUM_TEST_SET_RULE, /separately for each material, flow velocity and sample thickness/);
    assert.match(MINIMUM_TEST_SET_RULE, /thresholds and need not behave monotonically/);
    assert.match(MINIMUM_TEST_SET_RULE, /Olson and T'ien/);
  });

  it('the gap report heading and closing sentence carry the convention', () => {
    const md = gapReport(records, MOON_BASE_BAND).markdown;
    assert.match(md, /## Minimum test set \(under PYRION's convention\)/);
    assert.match(md, /would not by itself show that the band is safe/);
  });
});
