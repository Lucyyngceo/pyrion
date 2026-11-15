import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COMPARISON_NOTE, NEVER_COMPARED, comparisonScope, type Target } from '../src/index.ts';

describe('comparisonScope', () => {
  const t: Target = { regime: { gravity_regime: 'partial_gravity', fuel_phase: 'solid' }, continuous: { o2_mole_fraction: 0.3, pressure: 70.3, gravity_level: 0.16 } };
  it('lists what the target stated as compared, and never counts the gravity level', () => {
    const s = comparisonScope(t);
    assert.deepEqual(s.compared, ['gravity regime', 'fuel phase', 'oxygen', 'pressure']);
  });
  it('lists open regime axes and the variables no verdict compares', () => {
    const s = comparisonScope(t);
    assert.ok(s.notCompared.includes('diluent gas (left open)'));
    assert.ok(s.notCompared.includes('flame type (left open)'));
    for (const v of NEVER_COMPARED) assert.ok(s.notCompared.includes(v));
    assert.equal(s.note, COMPARISON_NOTE);
  });
  it('says plainly that a verdict is not a test at the exact condition', () => {
    assert.match(COMPARISON_NOTE, /not a finding that a test was run at this exact condition/);
  });
});
