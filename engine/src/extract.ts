// Deterministic extraction of quantities from a question, with the vocabulary of parseQuantity.
// No model, no guessing: a number that cannot be assigned to a quantity goes to `leftover`. The values
// returned are the RAW strings exactly as written in the question (slices of it); parseQuantity /
// targetFromQuantities convert them, so the model never converts a unit.

import { findGravityKeywords, foldText, parseQuantity, type GravityClass, type QuantityResult, type TargetQuantities } from './quantity.ts';

export type ExtractIssueCode =
  | 'partial_pressure'
  | 'multiple_values'
  | 'ambiguous_gravity'
  | 'gravity_conflict';

export interface ExtractIssue {
  code: ExtractIssueCode;
  /** Which quantity, when it applies. */
  quantity?: string;
  message: string;
  /** The text pieces involved, as written. */
  text: string[];
}

export interface ExtractedQuantities extends Pick<TargetQuantities, 'gravity' | 'o2' | 'pressure' | 'flow_velocity' | 'sample_thickness' | 'ambient_temperature'> {
  /** Numbers (with their unit word when one follows) that were not assigned to any quantity, in text order. */
  leftover: string[];
  /** Why something was left unassigned although it looked like a quantity. */
  issues: ExtractIssue[];
}

type Kind = 'gravity' | 'o2' | 'pressure' | 'flow_velocity' | 'sample_thickness' | 'ambient_temperature';
interface Candidate {
  kind: Kind;
  start: number;
  end: number;
  raw: string;
}

const NUMBER = String.raw`[+-]?\d+(?:[.,]\d+)*(?:e[+-]?\d+)?`;
// Not a number: part of a word or a code ("PSI-12", "ppO2", "H2O"), or a continuation of another number.
const NUMBER_RE = new RegExp(String.raw`(?<![\w.,])(?<![A-Za-z]-)${NUMBER}`, 'gi');

const UNIT_AFTER = {
  pressure:
    /^\s*(?:kpag|kpa|pa|atmospheres?|atm|barg|mbar|bar|psia|psig|psid|psi|mmhg|torr)(?![a-z0-9])(?:\s*\(\s*(?:abs|absolute|g|gauge)\s*\)|\s+(?:abs|absolute|gauge)(?![a-z]))?/,
  percent: /^\s*(?:%|(?:per\s*cent|percent|por\s*ciento)(?![a-z])|vol\s?%|mol\s?%)(?:\s*(?:by\s+vol(?:ume)?|vol)(?![a-z]))?/,
  gravity: /^\s*g(?:e|0)?(?![a-z0-9/])/,
  velocity: /^\s*(?:cm|mm|m)\s*\/\s*s(?![a-z0-9])/,
  length: /^\s*(?:mm|cm|µm|um|microns?|inch(?:es)?)(?![a-z0-9])/,
  temperature: /^\s*(?:[°º]\s*[ck]|degrees?\s*(?:c|celsius|k|kelvin)|deg\.?\s*c|celsius|kelvin)(?![a-z0-9])/,
} as const;

const O2_WORD = /o2|o₂|oxygen|oxigeno/;
const O2_FRACTION = [
  new RegExp(String.raw`(?:o2|o₂|oxygen|oxigeno)\s+(?:mole\s+|molar\s+)?(?:fraction|fraccion)\s*(?:of|de|=|is|:)?\s*(${NUMBER})`, 'g'),
  new RegExp(String.raw`fraccion\s+(?:molar\s+)?de\s+(?:oxigeno|o2)\s*(?:de|=|:)?\s*(${NUMBER})`, 'g'),
];
const PARTIAL_PRESSURE = /pp\s*o2|partial\s+pressure|presion\s+parcial/;
const PRESSURE_WORDS =
  /(?:(?:normal|standard|sea[- ]level)(?:\s+(?:air|atmospheric))?\s+pressure|sea[- ]level|standard\s+atmosphere|one\s+atmosphere|nivel\s+del\s+mar|presion\s+(?:normal|estandar))(?![a-z])/g;

const CONTEXT: Record<'flow_velocity' | 'sample_thickness' | 'ambient_temperature', RegExp> = {
  flow_velocity: /flow|wind|airflow|velocity|velocidad|flujo|viento/,
  sample_thickness: /thick|espesor|grosor/,
  ambient_temperature: /ambient|room\s+temperature|cabin\s+temperature|ambiente/,
};

const near = (folded: string, from: number, to: number, re: RegExp, width = 30) => re.test(folded.slice(Math.max(0, from - width), Math.min(folded.length, to + width)));

/**
 * Pull the quantities out of a question. Rules, all deterministic:
 *  - oxygen: a number followed by %, percent, por ciento, vol%, mol% WITH an oxygen word (O2, oxygen, oxígeno)
 *    within 30 characters, or "oxygen fraction of 0.34";
 *  - pressure: a number with a pressure unit (a gauge unit is extracted as written so parseQuantity can refuse
 *    it; a number right after "ppO2" or "partial pressure" is NOT a pressure: issue + leftover), or a phrase
 *    such as "sea level pressure";
 *  - gravity: a number followed by g, or a gravity keyword anywhere (Moon, lunar, Luna, Mars, Marte, ground,
 *    Tierra, microgravity, freefall, ...); two different classes, or a number that disagrees with the keyword,
 *    is an issue and nothing is assigned;
 *  - flow, thickness, ambient temperature: a number with its unit AND a context word (flow, thick, ambient);
 *    "a 2 mm sheet" is not assumed to be a thickness.
 * Two different values for one quantity are never resolved: an issue, and all of them go to leftover.
 */
export function extractQuantities(question: string): ExtractedQuantities {
  const folded = foldText(question);
  const issues: ExtractIssue[] = [];
  const cands: Candidate[] = [];
  const consumed: [number, number][] = [];
  const isConsumed = (i: number) => consumed.some(([a, b]) => i >= a && i < b);
  const leftoverSpans: { start: number; end: number }[] = [];

  // "oxygen fraction of 0.34": the number alone is the raw value.
  for (const re of O2_FRACTION) {
    for (const m of folded.matchAll(re)) {
      const num = m[1];
      const end = (m.index as number) + m[0].length;
      const start = end - num.length;
      cands.push({ kind: 'o2', start, end, raw: question.slice(start, end) });
      consumed.push([start, end]);
    }
  }

  // Pressure phrases without a number.
  for (const m of folded.matchAll(PRESSURE_WORDS)) {
    const start = m.index as number;
    const end = start + m[0].length;
    cands.push({ kind: 'pressure', start, end, raw: question.slice(start, end) });
    consumed.push([start, end]);
  }

  for (const m of folded.matchAll(NUMBER_RE)) {
    const start = m.index as number;
    const tokenEnd = start + m[0].length;
    if (isConsumed(start)) continue;
    const after = folded.slice(tokenEnd);
    const claim = (kind: Kind, unitLen: number) => {
      const end = tokenEnd + unitLen;
      cands.push({ kind, start, end, raw: question.slice(start, end) });
      consumed.push([start, end]);
    };

    // 1/6 g
    const frac = /^\s*\/\s*(\d+(?:\.\d+)?)\s*g(?:e|0)?(?![a-z0-9/])/.exec(after);
    if (frac) {
      claim('gravity', frac[0].length);
      continue;
    }
    const press = UNIT_AFTER.pressure.exec(after);
    if (press) {
      if (PARTIAL_PRESSURE.test(folded.slice(Math.max(0, start - 25), start))) {
        issues.push({
          code: 'partial_pressure',
          quantity: 'pressure',
          message: 'a partial pressure (ppO2) is not the total pressure the engine needs; it was not used',
          text: [question.slice(start, tokenEnd + press[0].length)],
        });
        leftoverSpans.push({ start, end: tokenEnd + press[0].length });
        consumed.push([start, tokenEnd + press[0].length]);
        continue;
      }
      claim('pressure', press[0].length);
      continue;
    }
    const pct = UNIT_AFTER.percent.exec(after);
    if (pct) {
      const unitEnd = tokenEnd + pct[0].length;
      if (near(folded, start, unitEnd, O2_WORD)) claim('o2', pct[0].length);
      else leftoverSpans.push({ start, end: unitEnd });
      if (!near(folded, start, unitEnd, O2_WORD)) consumed.push([start, unitEnd]);
      continue;
    }
    const grav = UNIT_AFTER.gravity.exec(after);
    if (grav) {
      claim('gravity', grav[0].length);
      continue;
    }
    const vel = UNIT_AFTER.velocity.exec(after);
    if (vel) {
      const unitEnd = tokenEnd + vel[0].length;
      if (near(folded, start, unitEnd, CONTEXT.flow_velocity, 40)) claim('flow_velocity', vel[0].length);
      else {
        leftoverSpans.push({ start, end: unitEnd });
        consumed.push([start, unitEnd]);
      }
      continue;
    }
    const len = UNIT_AFTER.length.exec(after);
    if (len) {
      const unitEnd = tokenEnd + len[0].length;
      if (near(folded, start, unitEnd, CONTEXT.sample_thickness)) claim('sample_thickness', len[0].length);
      else {
        leftoverSpans.push({ start, end: unitEnd });
        consumed.push([start, unitEnd]);
      }
      continue;
    }
    // Kelvin written as a bare capital K is only read in the original text, never from the folded one.
    const temp = UNIT_AFTER.temperature.exec(after) ?? (/^\s*K(?![A-Za-z0-9])/.test(question.slice(tokenEnd)) ? /^\s*k/.exec(after) : null);
    if (temp) {
      const unitEnd = tokenEnd + temp[0].length;
      if (near(folded, start, unitEnd, CONTEXT.ambient_temperature, 40)) claim('ambient_temperature', temp[0].length);
      else {
        leftoverSpans.push({ start, end: unitEnd });
        consumed.push([start, unitEnd]);
      }
      continue;
    }
    leftoverSpans.push({ start, end: tokenEnd });
    consumed.push([start, tokenEnd]);
  }

  // Gravity keywords.
  const hits = findGravityKeywords(question);
  const classes = [...new Set(hits.map((h) => h.cls))] as GravityClass[];
  const gravityNumeric = cands.filter((c) => c.kind === 'gravity');
  let keywordCandidate: Candidate | null = null;
  if (classes.length > 1) {
    issues.push({
      code: 'ambiguous_gravity',
      quantity: 'gravity',
      message: `the question names more than one gravity (${classes.join(', ')}); none was used`,
      text: classes.map((c) => {
        const h = hits.find((x) => x.cls === c) as { index: number; length: number };
        return question.slice(h.index, h.index + h.length);
      }),
    });
  } else if (classes.length === 1) {
    const h = hits[0];
    keywordCandidate = { kind: 'gravity', start: h.index, end: h.index + h.length, raw: question.slice(h.index, h.index + h.length) };
  }

  const out: ExtractedQuantities = { leftover: [], issues };
  const parsed = (raw: string, variable: Parameters<typeof parseQuantity>[1]): QuantityResult => parseQuantity(raw, variable);
  const VARIABLE: Record<Kind, Parameters<typeof parseQuantity>[1]> = {
    gravity: 'gravity_level',
    o2: 'o2_mole_fraction',
    pressure: 'pressure',
    flow_velocity: 'flow_velocity',
    sample_thickness: 'sample_thickness',
    ambient_temperature: 'ambient_temperature',
  };

  const assign = (kind: Kind, list: Candidate[]) => {
    const uniq = list.filter((c, i) => list.findIndex((o) => o.raw.toLowerCase() === c.raw.toLowerCase()) === i);
    if (uniq.length === 0) return;
    if (uniq.length > 1) {
      // Several spellings of one value (8.2 psia and 56.54 kPa) are fine when they agree within the tolerance.
      const results = uniq.map((c) => parsed(c.raw, VARIABLE[kind]));
      const first = results[0];
      const agree = results.every((r) => r.ok) && first.ok && results.every((r) => r.ok && Math.abs(r.value - first.value) <= 0.005 * Math.abs(first.value));
      if (!agree) {
        issues.push({
          code: 'multiple_values',
          quantity: kind,
          message: `the question gives more than one value for ${kind}; none was used`,
          text: uniq.map((c) => c.raw),
        });
        for (const c of uniq) leftoverSpans.push({ start: c.start, end: c.end });
        return;
      }
    }
    out[kind] = uniq[0].raw;
  };

  // Gravity: a number and a keyword must agree, or neither is used.
  if (gravityNumeric.length > 0 && keywordCandidate) {
    const n = parsed(gravityNumeric[0].raw, 'gravity_level');
    const k = parsed(keywordCandidate.raw, 'gravity_level');
    if (n.ok && k.ok && n.gravity_regime !== k.gravity_regime) {
      issues.push({
        code: 'gravity_conflict',
        quantity: 'gravity',
        message: `"${gravityNumeric[0].raw}" and "${keywordCandidate.raw}" describe different gravity regimes; none was used`,
        text: [gravityNumeric[0].raw, keywordCandidate.raw],
      });
      for (const c of gravityNumeric) leftoverSpans.push({ start: c.start, end: c.end });
    } else {
      assign('gravity', gravityNumeric);
    }
  } else if (gravityNumeric.length > 0) {
    assign('gravity', gravityNumeric);
  } else if (keywordCandidate) {
    out.gravity = keywordCandidate.raw;
  }
  for (const kind of ['o2', 'pressure', 'flow_velocity', 'sample_thickness', 'ambient_temperature'] as const) {
    assign(kind, cands.filter((c) => c.kind === kind));
  }

  out.leftover = leftoverSpans
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .filter((s, i, a) => i === 0 || s.start !== a[i - 1].start)
    .map((s) => question.slice(s.start, s.end).trim());
  return out;
}
