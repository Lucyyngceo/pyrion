// The three-part answer: what PSI supports, where the evidence ends and why, and what to do next.
// Deterministic: every fact (citations, kinds, counts, actions) comes from the engine's own tools; the two modes
// differ only in WORDING. Remove every `sentence` field and the easy and advanced answers are identical.

import { canonicalJson } from './json.ts';
import { EXPERIMENT_LABEL, experimentsNeeded, type CatalogEntry } from './experiments.ts';
import { axisLabel, levelSentence, plural, valueLabel } from './labels.ts';
import { EXTRAPOLATION_LEVEL_ORDER, type ExtrapolationLevel } from './levels.ts';
import { routesToEvidence, formatAxisValue, type Route } from './navigator.ts';
import { sha256Hex } from './sha256.ts';
import { ENGINE_NAME, ENGINE_VERSION, type BlockerCode, type Citation, type ContinuousAxis, type EngineOptions, type ConditionRecord, type Target } from './types.ts';
import { evaluate } from './verdict.ts';

export type AnswerMode = 'easy' | 'advanced';

export interface AnswerCitation {
  accession: string;
  acronym?: string;
  doi?: string;
  /** Receipts: `accession|test|variable|source file|location` of the records behind the statement. */
  recordIds: string[];
}

export interface KnownItem {
  sentence: string;
  citations: AnswerCitation[];
}

export type UnknownItem =
  | { sentence: string; kind: 'regime'; axis: string; value?: string; testedValues?: string[]; count: number; accessions: string[] }
  | { sentence: string; kind: 'outside'; level: ExtrapolationLevel; count: number; accessions: string[] }
  | { sentence: string; kind: 'insufficient'; code: BlockerCode; axis: string | null; count: number; accessions: string[] };

export type NextItem =
  | {
      sentence: string;
      kind: 'route';
      action: { routeKind: Route['kind']; accession: string; acronym?: string; doi?: string; changes: { kind: string; axis: string; from?: number | string; to?: number | string }[] };
    }
  | { sentence: string; kind: 'proposal'; action: { label: string; gapKind: string; pointCount: number; firstPriority?: string } };

export interface ThreePartAnswer {
  mode: AnswerMode;
  engine: { name: string; version: string };
  target: Target;
  known: KnownItem[];
  unknown: UnknownItem[];
  next: NextItem[];
  /** SHA-256 of the canonical JSON of the engine's evaluation: the same question and records give the same 64 characters. */
  fingerprint: string;
  /** The tools that actually ran, in order. */
  steps: string[];
}

const COUNT_WORDS = ['no', 'one', 'two', 'three'];
const countWord = (n: number) => COUNT_WORDS[n] ?? 'several';

const EASY_LEVEL: Record<ExtrapolationLevel, string> = {
  combination: 'tested each setting on its own, but never this combination',
  just_outside: 'only just outside what was tested',
  outside: 'outside what was tested',
  far_outside: 'far outside what was tested',
};

/** What an experiment "did" or "has", in plain words, agreeing with how many there are. */
function easyBlocker(code: BlockerCode, axis: string | null, n: number): string {
  const label = axis ? axisLabel(axis) : 'a setting you asked about';
  switch (code) {
    case 'AXIS_NOT_RECORDED':
      return `did not record ${label}`;
    case 'NO_USABLE_VALUE':
      return `${plural(n, 'has', 'have')} ${label} values we cannot rely on yet`;
    case 'RECORDS_DISAGREE':
      return `${plural(n, 'has records', 'have records')} that disagree about ${label}`;
    case 'AXES_NOT_RECORDED_TOGETHER':
      return 'measured the settings you asked about at different times, never together';
    case 'VALUES_NOT_PAIRED':
      return 'did not say which oxygen and pressure values go together';
    default:
      return 'cannot be compared yet';
  }
}

const recordId = (c: Citation) => `${c.accession}|${c.test_id}|${c.variable}|${c.source_file}|${c.source_location}`;
const uniqSorted = (xs: string[]) => [...new Set(xs)].sort();

export function threePartAnswer(
  records: readonly ConditionRecord[],
  target: Target,
  options: EngineOptions & { catalog?: Record<string, CatalogEntry>; mode: AnswerMode },
): ThreePartAnswer {
  const { catalog, mode, ...engineOptions } = options;
  if (mode !== 'easy' && mode !== 'advanced') throw new RangeError(`mode must be "easy" or "advanced", not "${String(mode)}"`);
  const easy = mode === 'easy';
  const archive = easy ? "NASA's combustion archive" : 'PSI';

  // The gravity level selects the regime and is only shown (no record carries it), as everywhere in the engine.
  const t: Target = { regime: { ...target.regime }, continuous: { ...target.continuous }, ...(target.informational ? { informational: { ...target.informational } } : {}) };
  if (t.continuous.gravity_level !== undefined) {
    t.informational = { ...t.informational, gravity_level: t.continuous.gravity_level };
    delete t.continuous.gravity_level;
  }

  const steps: string[] = ['evaluate'];
  const ev = evaluate(records, t, engineOptions);
  const fingerprint = sha256Hex(canonicalJson(ev));
  const cat = (acc: string) => catalog?.[acc];

  // ---- known ----
  const applicable = ev.investigations.filter((i) => i.verdict === 'APPLICABLE');
  const known: KnownItem[] = applicable.map((i) => {
    const cluster = ev.ranked.find((c) => c.accession === i.accession && c.clusterKey === i.decidingCluster);
    const ids = uniqSorted((cluster?.reasons ?? []).filter((r) => r.code === 'inside_range' || r.code === 'inside_hull').flatMap((r) => r.citations.map(recordId)));
    const c = cat(i.accession);
    const citation: AnswerCitation = { accession: i.accession, ...(c ? { acronym: c.acronym, doi: c.doi } : {}), recordIds: ids };
    const sentence = easy
      ? `A NASA experiment${c && c.title ? ` (${c.title})` : ''} tested conditions like yours.`
      : `${i.accession}${c ? ` ${c.acronym} (doi:${c.doi})` : ''} is comparable: ${ids.length} recorded ${plural(ids.length, 'value', 'values')} support this condition.`;
    return { sentence, citations: [citation] };
  });
  if (known.length === 0) known.push({ sentence: `Nothing in ${archive} applies directly to this condition.`, citations: [] });

  // ---- unknown ----
  const unknown: UnknownItem[] = [];
  if (ev.regimeUntested) {
    const r = ev.regimeUntested;
    const tested = r.testedValues.map(valueLabel).join(' and ');
    unknown.push({
      kind: 'regime',
      axis: r.axis,
      value: r.value,
      testedValues: r.testedValues,
      count: ev.investigations.length,
      accessions: ev.investigations.map((i) => i.accession),
      sentence: easy
        ? `Nothing in ${archive} was tested in ${valueLabel(r.value)}; the experiments there were run in ${tested || 'other conditions'}.`
        : `No test in ${archive} was run in ${valueLabel(r.value)}; the investigations state only ${tested || 'other regimes'}.`,
    });
  }
  const barrierByAxis = new Map<string, { accs: string[]; tested: Set<string> }>();
  const insuff = new Map<string, { code: BlockerCode; axis: string | null; accs: string[] }>();
  for (const i of ev.investigations) {
    for (const b of i.blockers ?? []) {
      if (b.code === 'REGIME_NOT_TESTED') {
        if (ev.regimeUntested && b.axis === 'gravity_regime') continue;
        const e = barrierByAxis.get(b.axis ?? '') ?? { accs: [], tested: new Set<string>() };
        e.accs.push(i.accession);
        for (const v of b.testedValues ?? []) e.tested.add(v);
        barrierByAxis.set(b.axis ?? '', e);
      } else {
        const k = `${b.code}|${b.axis ?? ''}`;
        const e = insuff.get(k) ?? { code: b.code, axis: b.axis, accs: [] };
        e.accs.push(i.accession);
        insuff.set(k, e);
      }
    }
  }
  for (const [axis, e] of [...barrierByAxis.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const accs = uniqSorted(e.accs);
    const tested = [...e.tested].sort();
    unknown.push({
      kind: 'regime',
      axis,
      testedValues: tested,
      count: accs.length,
      accessions: accs,
      sentence: easy
        ? `${cap1(countWord(accs.length))} ${plural(accs.length, 'experiment was', 'experiments were')} run with a different ${axisLabel(axis)}, so ${plural(accs.length, 'it', 'they')} cannot be compared.`
        : `${accs.length} ${plural(accs.length, 'investigation', 'investigations')} in ${archive} ${plural(accs.length, 'was', 'were')} tested only in a different ${axisLabel(axis)} (${tested.map(valueLabel).join(', ')}).`,
    });
  }
  for (const level of EXTRAPOLATION_LEVEL_ORDER) {
    const accs = ev.investigations.filter((i) => i.verdict === 'EXTRAPOLATION' && i.extrapolationLevel === level).map((i) => i.accession);
    if (accs.length === 0) continue;
    unknown.push({
      kind: 'outside',
      level,
      count: accs.length,
      accessions: accs,
      sentence: easy
        ? `${cap1(countWord(accs.length))} ${plural(accs.length, 'experiment', 'experiments')} ${plural(accs.length, 'is', 'are')} close, but ${plural(accs.length, 'it', 'they')} ${EASY_LEVEL[level]}.`
        : `${accs.length} ${plural(accs.length, 'investigation', 'investigations')} in ${archive}: ${levelSentence(level).toLowerCase()}.`,
    });
  }
  for (const e of [...insuff.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((x) => x[1])) {
    const accs = uniqSorted(e.accs);
    unknown.push({
      kind: 'insufficient',
      code: e.code,
      axis: e.axis,
      count: accs.length,
      accessions: accs,
      sentence: easy
        ? `${cap1(countWord(accs.length))} ${plural(accs.length, 'experiment', 'experiments')} ${easyBlocker(e.code, e.axis, accs.length)}.`
        : `${accs.length} ${plural(accs.length, 'investigation', 'investigations')} in ${archive}: ${advancedBlocker(e.code, e.axis)}`,
    });
  }

  // ---- next ----
  const next: NextItem[] = [];
  if (applicable.length < ev.investigations.length) {
    steps.push('routesToEvidence');
    const rs = routesToEvidence(records, t, engineOptions);
    for (const r of rs.routes.slice(0, 3)) {
      const c = cat(r.accession);
      next.push({
        kind: 'route',
        action: {
          routeKind: r.kind,
          accession: r.accession,
          ...(c ? { acronym: c.acronym, doi: c.doi } : {}),
          changes: r.changes.map((x) => ({ kind: x.kind, axis: x.axis, ...(x.from !== undefined ? { from: x.from } : {}), ...(x.to !== undefined ? { to: x.to } : {}) })),
        },
        sentence: easy ? easyRoute(r, c) : r.sentence,
      });
    }
    steps.push('experimentsNeeded');
    const ex = experimentsNeeded(records, t, { ...engineOptions, ...(catalog ? { catalog } : {}) });
    const first = ex.priority[0];
    next.push({
      kind: 'proposal',
      action: { label: EXPERIMENT_LABEL, gapKind: ex.gap.kind, pointCount: ex.testMatrix.pointCount, ...(first ? { firstPriority: first.kind } : {}) },
      sentence: easy
        ? 'What would close this gap: a new set of experiments around your condition. This is our proposal, not a NASA plan.'
        : `${EXPERIMENT_LABEL}: ${ex.testMatrix.pointCount} test ${plural(ex.testMatrix.pointCount, 'point', 'points')} around the target${first ? `; first priority: ${first.sentence}` : ''}`,
    });
  }

  return { mode, engine: { name: ENGINE_NAME, version: ENGINE_VERSION }, target: t, known, unknown, next, fingerprint, steps };
}

const cap1 = (s: string) => (s.length === 0 ? s : s[0].toUpperCase() + s.slice(1));

function advancedBlocker(code: BlockerCode, axis: string | null): string {
  const label = axis ? axisLabel(axis) : '';
  switch (code) {
    case 'AXIS_NOT_RECORDED':
      return `did not record ${label}.`;
    case 'NO_USABLE_VALUE':
      return `the ${label} records cannot be used as evidence (flagged as insufficient in the extraction).`;
    case 'RECORDS_DISAGREE':
      return `the records disagree on ${label}.`;
    case 'AXES_NOT_RECORDED_TOGETHER':
      return 'no single test records all the axes you set together.';
    case 'VALUES_NOT_PAIRED':
      return 'several oxygen and pressure values are listed without saying which go together.';
    default:
      return `${code}.`;
  }
}

function easyRoute(r: Route, c: CatalogEntry | undefined): string {
  const who = c && c.title ? `the experiment "${c.title}"` : 'a NASA experiment';
  const parts = r.changes.map((x) => {
    if (x.kind === 'move') return `change ${axisLabel(x.axis)} to ${formatAxisValue(x.axis as ContinuousAxis, x.to as number)}`;
    if (x.kind === 'leave_open') return `leave ${axisLabel(x.axis)} open`;
    return `look at ${valueLabel(String(x.to))} instead (a different situation, not a small step)`;
  });
  return `To compare with ${who}: ${parts.join(', ')}.`;
}
