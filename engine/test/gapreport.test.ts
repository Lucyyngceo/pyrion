// The gap report: what the document says must follow from the planner's numbers, and be the same bytes every time.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { MOON_BASE_BAND, PLANNER_LABEL, ERL_NOTE, coverage, fm2Hypothetical, gapReport } from '../src/index.ts';
import { loadConditionDir } from '../src/load.ts';
import { fixtureRecords } from './helpers.ts';

const fixtures = fixtureRecords();
const catalog = { 'PSI-9001': { acronym: 'SYN1', title: 'Synthetic one', doi: '10.0000/syn1' } };
const REAL = join(import.meta.dirname, '..', '..', 'data', 'conditions');

describe('gapReport (fixtures)', () => {
  const r = gapReport(fixtures, MOON_BASE_BAND, catalog);

  it('carries the label, the fingerprint and the engine version', () => {
    assert.equal(r.data.label, 'PYRION proposal — evidence coverage, not a prediction or a safety assessment');
    assert.equal(r.data.label, PLANNER_LABEL);
    assert.match(r.fingerprint, /^[0-9a-f]{64}$/);
    assert.ok(r.markdown.includes(r.fingerprint));
    assert.ok(r.markdown.includes(PLANNER_LABEL));
    assert.match(r.markdown, /pyrion-applicability-engine 0\.2\.0/);
  });

  it('says what PSI covers: 0 %, overall and per fuel phase', () => {
    assert.equal(r.data.coverage.all.fraction, 0);
    assert.deepEqual(r.data.coverage.byPhase.map((p) => p.fraction), [0, 0, 0]);
    assert.match(r.markdown, /\*\*0 %\*\* \(0 of 81\)/);
    assert.equal(r.data.coverage.all.covered, coverage(fixtures, MOON_BASE_BAND).covered);
  });

  it('says that FM2 covers a line, with the numbers of the planner', () => {
    assert.equal(r.data.planned.fm2Shape, 'line');
    assert.equal(r.data.planned.fm2.cellsGained, 9);
    assert.match(r.markdown, /Shape: \*\*line\*\*/);
    assert.match(r.markdown, /covers a LINE of the band, not an area/);
    assert.match(r.markdown, /LUCI: cannot be placed/);
    assert.match(r.markdown, /never written to the data/);
  });

  it('lists the minimum test set with what is covered and what is missing', () => {
    assert.equal(r.data.minimumTestSet.points.length, 4);
    assert.match(r.markdown, /Missing: 2 of 4 points\. FM2 contributes 2/);
    assert.match(r.markdown, /missing/);
    assert.match(r.markdown, /already covered by FM2 \(planned\)/);
  });

  it('gives the ERL with the convention note and the scale', () => {
    assert.equal(r.data.erl.atCentre.level, 0);
    assert.ok(r.markdown.includes(ERL_NOTE));
    assert.match(r.markdown, /ERL 0 \(no test\)/);
    assert.match(r.markdown, /ERL 4 — measured/);
    assert.equal(r.data.erl.atVertices.length, 4);
  });

  it('cites its sources with quotes: the NESC atmospheres, the challenge, lunar gravity, FM2 page 10', () => {
    const text = r.data.sources.map((s) => `${s.used} ${s.title} ${s.locator} ${s.quote}`).join('\n');
    assert.match(text, /8\.2 psia\/34% O2/);
    assert.match(text, /30% or greater, with a corresponding pressure of 10\.2 psi or less/);
    assert.match(text, /glunar = 0\.16 gearth/);
    assert.match(text, /FM2 \(planned\)[^\n]*PDF p\. 10/);
    assert.match(text, /LUCI/);
  });

  it('names the nearest evidence per fuel phase, or says there is none', () => {
    assert.equal(r.data.nearest.length, 3);
    assert.ok(r.data.nearest.every((n) => n.nearest === null || typeof n.nearest.accession === 'string'));
    assert.match(r.markdown, /## Nearest evidence per fuel phase/);
  });

  it('is deterministic, and the HTML is a complete print-ready page with the same content', () => {
    const again = gapReport(fixtures, MOON_BASE_BAND, catalog);
    assert.equal(again.markdown, r.markdown);
    assert.equal(again.html, r.html);
    assert.equal(again.fingerprint, r.fingerprint);
    assert.match(r.html, /^<!doctype html>/);
    assert.ok(r.html.includes('@media print'));
    assert.ok(r.html.includes(r.fingerprint));
    assert.ok(r.html.includes('<h2>Minimum test set</h2>'));
    assert.equal((r.html.match(/<ul>/g) ?? []).length, (r.html.match(/<\/ul>/g) ?? []).length);
  });

  it('a different band or different records change the fingerprint', () => {
    const other = gapReport(fixtures.slice(0, Math.floor(fixtures.length / 2)), MOON_BASE_BAND, catalog);
    assert.notEqual(other.fingerprint, r.fingerprint);
    const moved = gapReport(fixtures, { ...MOON_BASE_BAND, vertices: MOON_BASE_BAND.vertices.map((v) => ({ ...v, o2_mole_fraction: v.o2_mole_fraction })), gravity: { ...MOON_BASE_BAND.gravity, level: 0.165 } }, catalog);
    assert.notEqual(moved.fingerprint, r.fingerprint);
  });

  it('never claims safety or prediction in its own words', () => {
    const body = r.markdown.replace(PLANNER_LABEL, '').replace(ERL_NOTE, '');
    assert.doesNotMatch(body, /\b(is safe|are safe|will burn|will not burn|validated by NASA|first in the world)\b/i);
  });
});

describe('gapReport (real records)', { skip: !existsSync(REAL) }, () => {
  const real = existsSync(REAL) ? loadConditionDir(REAL).records : [];

  it('today: 0 % covered, ERL 0 because no PSI test is in partial gravity, FM2 gains a line only', () => {
    const r = gapReport(real, MOON_BASE_BAND);
    assert.equal(r.data.coverage.all.fraction, 0);
    assert.equal(r.data.erl.atCentre.level, 0);
    assert.match(r.data.erl.atCentre.reason, /No PSI test in partial gravity anywhere/);
    assert.equal(r.data.planned.fm2Shape, 'line');
    assert.equal(r.data.planned.fm2.hullAreaFraction, 0);
    assert.equal(r.data.planned.fm2.cellsGained, 9);
    assert.equal(fm2Hypothetical().records.every((x) => x.note.startsWith('HYPOTHETICAL')), true);
  });
});
