// The gap report for a design band: what PSI covers, the nearest evidence per fuel phase, what FM2 and LUCI would add,
// the minimum test set, the ERL, the sources and a fingerprint. Markdown plus a print-ready HTML page.
// Deterministic (no clock, no model); a PYRION proposal about evidence coverage, never a prediction or a safety assessment.

import { type CatalogEntry } from './experiments.ts';
import { ERL_NOTE, ERL_SCALE, erlFor, type ErlResult } from './erl.ts';
import { canonicalJson } from './json.ts';
import {
  CONVENTION_SOURCE,
  COVERAGE_NOTE,
  PLANNER_LABEL,
  coverage,
  coverageGained,
  fm2Hypothetical,
  luciHypothetical,
  minimumTestSet,
  type DesignBand,
  type FuelPhase,
  type GainResult,
  type MinimumTestSet,
} from './planner.ts';
import { KPA_PER_PSI, type SourceRef } from './presets.ts';
import { sha256Hex } from './sha256.ts';
import { ENGINE_NAME, ENGINE_VERSION, type ConditionRecord, type EngineOptions, type Target, type Verdict } from './types.ts';
import { evaluate } from './verdict.ts';

const PHASES: readonly FuelPhase[] = ['solid', 'liquid', 'gas'];

export interface NearestEvidence {
  fuel_phase: FuelPhase;
  /** The nearest comparable (APPLICABLE or EXTRAPOLATION) cluster with the gravity regime left open; null when none. */
  nearest: { accession: string; acronym?: string; doi?: string; verdict: Verdict; level?: string; distance: number | null; gravity: string[] } | null;
}

export interface GapReportData {
  label: string;
  engine: { name: string; version: string };
  band: { id: string; label: string; gravity: DesignBand['gravity']['regime']; gravityLevel: number; vertices: { label: string; o2_percent: number; pressure_kpa: number; pressure_psia: number; sourced: boolean }[]; closure: string; convention: string };
  coverage: { all: { covered: number; total: number; fraction: number }; byPhase: { fuel_phase: FuelPhase; covered: number; total: number; fraction: number }[]; note: string };
  nearest: NearestEvidence[];
  planned: { fm2: GainResult; fm2WithToleranceBounds: GainResult; luci: GainResult; fm2Shape: string };
  minimumTestSet: MinimumTestSet;
  erl: { atCentre: Pick<ErlResult, 'level' | 'name' | 'reason'>; atVertices: { vertex: string; level: number; name: string }[]; note: string };
  sources: { used: string; title: string; locator: string; url?: string; quote: string }[];
}

export interface GapReport {
  data: GapReportData;
  /** SHA-256 of the canonical JSON of `data`: the same records and band give the same 64 characters. */
  fingerprint: string;
  markdown: string;
  html: string;
}

const pct = (x: number) => `${Math.round(x * 1000) / 10} %`;
const psia = (kpa: number) => Math.round((kpa / KPA_PER_PSI) * 100) / 100;
const label = (v: string) => v.toLowerCase().replace(/_/g, ' ');

function centre(band: DesignBand, phase: FuelPhase | null, withGravity: boolean): Target {
  const n = band.vertices.length;
  const o2 = band.vertices.reduce((s, v) => s + v.o2_mole_fraction, 0) / n;
  const p = band.vertices.reduce((s, v) => s + v.pressure_kpa, 0) / n;
  return { regime: { ...(withGravity ? { gravity_regime: band.gravity.regime } : {}), ...(phase ? { fuel_phase: phase } : {}) }, continuous: { o2_mole_fraction: o2, pressure: p }, ...(withGravity ? { informational: { gravity_level: band.gravity.level } } : {}) };
}

export function gapReport(records: readonly ConditionRecord[], band: DesignBand, catalog: Record<string, CatalogEntry> = {}, options: EngineOptions = {}): GapReport {
  // What PSI covers.
  const all = coverage(records, band, options);
  const byPhase = PHASES.map((ph) => {
    const c = coverage(records, band, { ...options, fuelPhase: ph });
    return { fuel_phase: ph, covered: c.covered, total: c.total, fraction: c.fraction };
  });

  // Nearest evidence per fuel phase, gravity regime left open (the question is what exists anywhere in PSI).
  const nearest: NearestEvidence[] = PHASES.map((ph) => {
    const ev = evaluate(records, centre(band, ph, false), options);
    const c = [...ev.ranked, ...ev.unranked].find((x) => (x.verdict === 'APPLICABLE' || x.verdict === 'EXTRAPOLATION') && x.regime.some((s) => s.axis === 'fuel_phase' && s.state === 'known' && s.values[0] === ph));
    if (!c) return { fuel_phase: ph, nearest: null };
    const cat = catalog[c.accession];
    return {
      fuel_phase: ph,
      nearest: { accession: c.accession, ...(cat ? { acronym: cat.acronym, doi: cat.doi } : {}), verdict: c.verdict, ...(c.extrapolationLevel ? { level: c.extrapolationLevel } : {}), distance: c.distance, gravity: c.regime.filter((s) => s.axis === 'gravity_regime' && s.state === 'known').flatMap((s) => [...s.values]) },
    };
  });

  // FM2 and LUCI.
  const fm2 = fm2Hypothetical();
  const fm2Tol = fm2Hypothetical({ withToleranceBounds: true });
  const luci = luciHypothetical();
  const gFm2 = coverageGained(records, band, fm2, { ...options, fuelPhase: 'solid' });
  const gTol = coverageGained(records, band, fm2Tol, { ...options, fuelPhase: 'solid' });
  const gLuci = coverageGained(records, band, luci, options);

  const min = minimumTestSet(records, band, { ...options, fuelPhase: 'solid' });

  // ERL: at the band centre and at each vertex (partial gravity, fuel phase open).
  const atCentre = erlFor(records, centre(band, null, true), options);
  const atVertices = band.vertices.map((v) => {
    const e = erlFor(records, { regime: { gravity_regime: band.gravity.regime }, continuous: { o2_mole_fraction: v.o2_mole_fraction, pressure: v.pressure_kpa }, informational: { gravity_level: band.gravity.level } }, options);
    return { vertex: v.label, level: e.level, name: e.name };
  });

  // Sources.
  const srcSeen = new Set<string>();
  const sources: GapReportData['sources'] = [];
  const addSource = (used: string, s: SourceRef) => {
    const k = `${s.id}|${s.locator}`;
    if (srcSeen.has(k)) return;
    srcSeen.add(k);
    sources.push({ used, title: s.title, locator: s.locator, url: s.url, quote: s.quote });
  };
  addSource('band gravity', band.gravity.source);
  addSource('convention: flammability limits need not be monotonic', CONVENTION_SOURCE as unknown as SourceRef);
  for (const v of [...band.vertices, ...band.edgePoints]) if (v.source) addSource(`band vertex: ${v.label}`, v.source);
  for (const ps of [...fm2.sources, ...luci.sources]) {
    const k = `planned|${ps.id}`;
    if (srcSeen.has(k)) continue;
    srcSeen.add(k);
    sources.push({ used: ps.id.startsWith('fm2') ? 'FM2 (planned)' : 'LUCI', title: ps.name, locator: ps.page === null ? 'web page' : `PDF p. ${ps.page}${ps.slide ? ` (slide ${ps.slide})` : ''}`, quote: ps.quote });
  }

  const data: GapReportData = {
    label: PLANNER_LABEL,
    engine: { name: ENGINE_NAME, version: ENGINE_VERSION },
    band: {
      id: band.id,
      label: band.label,
      gravity: band.gravity.regime,
      gravityLevel: band.gravity.level,
      vertices: band.vertices.map((v) => ({ label: v.label, o2_percent: Math.round(v.o2_mole_fraction * 10000) / 100, pressure_kpa: Math.round(v.pressure_kpa * 100) / 100, pressure_psia: psia(v.pressure_kpa), sourced: v.sourced })),
      closure: band.closure,
      convention: band.convention,
    },
    coverage: { all: { covered: all.covered, total: all.total, fraction: all.fraction }, byPhase, note: COVERAGE_NOTE },
    nearest,
    planned: { fm2: gFm2, fm2WithToleranceBounds: gTol, luci: gLuci, fm2Shape: fm2.shape },
    minimumTestSet: min,
    erl: { atCentre: { level: atCentre.level, name: atCentre.name, reason: atCentre.reason }, atVertices, note: ERL_NOTE },
    sources,
  };
  const fingerprint = sha256Hex(canonicalJson(data));
  const markdown = toMarkdown(data, fingerprint);
  return { data, fingerprint, markdown, html: toHtml(markdown, `Gap report: ${band.label}`) };
}

function toMarkdown(d: GapReportData, fingerprint: string): string {
  const L: string[] = [];
  L.push(`# Gap report: ${d.band.label}`, '', `**${d.label}**`, '', `Engine: ${d.engine.name} ${d.engine.version}. Fingerprint (SHA-256 of this report's data): \`${fingerprint}\``, '');
  L.push('## The band', '');
  L.push(`Gravity: ${label(d.band.gravity)} (${d.band.gravityLevel} g, shown only). Vertices (oxygen, total pressure):`, '');
  for (const v of d.band.vertices) L.push(`- ${v.label}: ${v.o2_percent} % O2, ${v.pressure_psia} psia (${v.pressure_kpa} kPa) — ${v.sourced ? 'sourced' : 'closing corner (PYRION convention)'}`);
  L.push('', `How it is closed: ${d.band.closure}`, '', d.band.convention, '');
  L.push('## What PSI covers today', '');
  L.push(`Cells of the band where at least one investigation is comparable (APPLICABLE): **${pct(d.coverage.all.fraction)}** (${d.coverage.all.covered} of ${d.coverage.all.total}).`, '');
  for (const p of d.coverage.byPhase) L.push(`- ${p.fuel_phase} fuel: ${pct(p.fraction)} (${p.covered} of ${p.total})`);
  L.push('', d.coverage.note, '');
  L.push('## Nearest evidence per fuel phase (gravity regime left open)', '');
  for (const n of d.nearest) {
    if (!n.nearest) L.push(`- ${n.fuel_phase}: no comparable investigation at the centre of the band in PSI.`);
    else {
      const x = n.nearest;
      L.push(`- ${n.fuel_phase}: ${x.accession}${x.acronym ? ` ${x.acronym}` : ''}${x.doi ? ` (doi:${x.doi})` : ''}, ${label(x.verdict)}${x.level ? ` (${label(x.level)})` : ''}${x.distance !== null ? `, normalized distance ${Math.round(x.distance * 1000) / 1000}` : ''}; tested in ${x.gravity.length ? x.gravity.map(label).join(' and ') : 'a gravity regime the records do not state'}.`);
    }
  }
  L.push('', '## What FM2 and LUCI would add (hypothetical)', '');
  L.push('Hypothetical records are built in memory from what the planning documents state; they are never written to the data.', '');
  const g = d.planned;
  L.push(`- FM2 as planned (${g.fm2.tests} tests, one fabric, solid fuel): ${g.fm2.cellsGained} more cells covered (${pct(g.fm2.gainFraction)} of the grid). Shape: **${g.fm2Shape}** — ${g.fm2Shape === 'line' ? 'all four tests are at one pressure (8.2 psia), so FM2 covers a LINE of the band, not an area; the share of the band area inside the hull of its test points is ' + pct(g.fm2.hullAreaFraction) + '.' : 'it spans an area.'}`);
  L.push(`- FM2 with both ends of its stated ± 0.3 psi (optimistic what-if, not a plan): ${g.fm2WithToleranceBounds.cellsGained} cells (${pct(g.fm2WithToleranceBounds.gainFraction)} of the grid); hull area inside the band ${pct(g.fm2WithToleranceBounds.hullAreaFraction)}.`);
  L.push(`- LUCI: ${g.luci.placeable ? 'placed' : 'cannot be placed'}. ${g.luci.note}`, '');
  L.push("## Geometric corner set (PYRION's convention)", '');
  L.push(d.minimumTestSet.rule, '');
  for (const p of d.minimumTestSet.points) L.push(`- ${Math.round(p.o2_mole_fraction * 10000) / 100} % O2, ${psia(p.pressure_kpa)} psia (${p.vertex}) — ${p.coveredBy.length ? 'already covered by ' + p.coveredBy.join(' and ') : 'missing'}`);
  L.push('', `Missing: ${d.minimumTestSet.missing.length} of ${d.minimumTestSet.points.length} points. FM2 contributes ${d.minimumTestSet.fm2Contributes.length} (those on its own line of tests). Testing the missing points would make the band comparable under the convention above; it would not by itself show that the band is safe or that the region between tests behaves like them.`, '');
  L.push('## Evidence Readiness Level', '');
  L.push(`${d.erl.note}`, '', `At the centre of the band: **ERL ${d.erl.atCentre.level} (${d.erl.atCentre.name})**. ${d.erl.atCentre.reason}`, '');
  for (const v of d.erl.atVertices) L.push(`- ${v.vertex}: ERL ${v.level} (${v.name})`);
  L.push('', 'Scale:', '');
  for (const s of ERL_SCALE) L.push(`- ERL ${s.level} — ${s.name}: ${s.means}`);
  L.push('', '## Sources', '');
  for (const s of d.sources) L.push(`- ${s.used}: ${s.title}, ${s.locator}${s.url ? `, ${s.url}` : ''} — "${s.quote.replace(/"/g, "'")}"`);
  L.push('', `_${d.label}._`, '');
  return L.join('\n');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<![\w*])_([^_]+)_(?![\w*])/g, '<em>$1</em>')
    .replace(/(https?:\/\/[^\s<,)]+)/g, '<a href="$1">$1</a>');
}

function toHtml(markdown: string, title: string): string {
  const out: string[] = [];
  let ul = false;
  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();
    if (line === '') {
      if (ul) out.push('</ul>');
      ul = false;
      continue;
    }
    const h = /^(#{1,3}) (.*)$/.exec(line);
    if (h) {
      if (ul) out.push('</ul>');
      ul = false;
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    if (line.startsWith('- ')) {
      if (!ul) out.push('<ul>');
      ul = true;
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (ul) out.push('</ul>');
    ul = false;
    out.push(`<p>${inline(line)}</p>`);
  }
  if (ul) out.push('</ul>');
  const css = 'body{font:14px/1.5 Georgia,serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#111}h1{font-size:1.6rem}h2{font-size:1.2rem;border-bottom:1px solid #999;margin-top:1.6rem}code{font:12px ui-monospace,Consolas,monospace;word-break:break-all}ul{padding-left:1.2rem}a{color:#0645ad;word-break:break-all}@media print{body{margin:0;max-width:none}h2{break-after:avoid}li{break-inside:avoid}a{color:inherit}}';
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body>\n${out.join('\n')}\n</body></html>\n`;
}
