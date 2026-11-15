// Checks a structured expert answer before anyone reads it. Pure TypeScript, no I/O (the caller loads the corpus).
//
// The model answers in layers:
//   { layer: "engine" | "nasa" | "expert", text, citations?: [{ doc_id, page, quote }], toolRefs?: [id] }
// and the code decides what stays:
//   nasa    every citation's quote must be on that page of that document, by the same rules as validation/run_all.py
//           (quote_found: verbatim up to spacing and punctuation; numbers_found: the numbers exactly as written,
//           so 1.5 never matches 15). One unverified citation drops the whole block (its text is never shown).
//   engine  may only contain numbers and ids that are in the engine output it references; otherwise the block is dropped.
//   expert  free text, labelled "TARS expert knowledge - not verified against a source". Every number in it must come
//           from a tool result it references, or from a verified quote in the same answer. A number that does not is
//           REPLACED BY CODE with "[number removed: not from a source]" and logged.
//
// Why replace the number, not mark the sentence: the reader sees exactly which figure was withheld, the reasoning
// around it stays readable, and a withheld figure can never be mistaken for a fact. A sentence-level warning would
// leave the untraced figure on screen, one glance away from being believed.

import type { ToolOk, ToolResult } from "./calculators.ts";

export type Layer = "engine" | "nasa" | "expert";

export interface Citation {
  doc_id: string;
  page: number;
  quote: string;
}

export interface AnswerBlock {
  layer: Layer;
  text: string;
  citations?: Citation[];
  toolRefs?: string[];
}

export interface CorpusPage {
  doc_id: string;
  page: number;
  text: string;
  /** The corpus builder writes the address as `url` or `file_url`. */
  url?: string;
  file_url?: string;
  title?: string;
}

export interface Corpus {
  get(doc_id: string, page: number): CorpusPage | undefined;
  /** True when some page of the document is in the corpus. */
  hasDocument(doc_id: string): boolean;
}

export interface CheckContext {
  corpus: Corpus;
  /** Engine outputs the model may restate, by id (an evaluation, a three-part answer, a route set, ...). */
  engine?: Record<string, unknown>;
  /** Calculator results by id (see calculators.ts). */
  tools?: Record<string, ToolResult>;
}

export const EXPERT_LABEL = "TARS expert knowledge — not verified against a source";
export const NASA_LABEL = "NASA source — quote checked on the cited page";
export const ENGINE_LABEL = "PYRION engine — computed by code";
export const NUMBER_REMOVED = "[number removed: not from a source]";
/** A quote shorter than this (letters and digits only) proves nothing and is refused. */
export const MIN_QUOTE_CHARS = 15;

export interface VerifiedCitation extends Citation {
  title?: string;
  url?: string;
}

export interface KeptBlock {
  layer: Layer;
  /** The text shown (an expert block may have had numbers replaced). */
  text: string;
  label: string;
  citations: VerifiedCitation[];
  /** Computed-by-code lines of the tools and engine outputs the block rests on. */
  provenance: string[];
  /** True when at least one number was replaced. */
  flagged: boolean;
}

export interface CheckReport {
  /** Blocks removed entirely. Their text is never shown; the reason is for the log and the UI badge. */
  dropped: { index: number; layer: string; reason: string; detail?: string }[];
  /** Numbers replaced in kept blocks. */
  flaggedNumbers: { index: number; layer: Layer; number: string; reason: string }[];
  verifiedCitations: { index: number; doc_id: string; page: number; title?: string; url?: string }[];
}

export interface CheckResult {
  kept: KeptBlock[];
  report: CheckReport;
}

// ---------- the corpus ----------

export function corpusFromPages(pages: Iterable<CorpusPage>): Corpus {
  const byKey = new Map<string, CorpusPage>();
  const docs = new Set<string>();
  for (const p of pages) {
    byKey.set(`${p.doc_id}#${p.page}`, p);
    docs.add(p.doc_id);
  }
  const resolve = (id: string) => (docs.has(id) ? id : docs.has(`nasa/${id}`) ? `nasa/${id}` : id);
  return {
    get: (doc_id, page) => byKey.get(`${resolve(doc_id)}#${page}`),
    hasDocument: (doc_id) => docs.has(resolve(doc_id)),
  };
}

/** Reads the text of web/.data/corpus/pages.jsonl. A line that is not valid JSON, or lacks doc_id / page / text, is skipped and counted. */
export function parseCorpusJsonl(jsonl: string): { pages: CorpusPage[]; skipped: number } {
  const pages: CorpusPage[] = [];
  let skipped = 0;
  for (const line of jsonl.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const r = JSON.parse(line) as Partial<CorpusPage>;
      if (typeof r.doc_id === "string" && typeof r.page === "number" && typeof r.text === "string") pages.push(r as CorpusPage);
      else skipped += 1;
    } catch {
      skipped += 1;
    }
  }
  return { pages, skipped };
}

// ---------- quote rules (the same as validation/run_all.py) ----------

const ELISION = /\[\s*(?:\.\.\.|…)\s*\]|…|\.\.\./;

/** Letters and digits only, lower case: spacing, punctuation, ligatures and hyphenation at line breaks do not matter. */
export function lettersOf(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/(\w)-\s*\n\s*(\w)/g, "$1$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

const NUM = /(?<![\w.])[-−]?(?:\d+(?:[.,]\d+)?|\.\d+)(?![\w])/g;

/** Numeric tokens exactly as written (the decimal point is kept, so 1.5 is not 15 and .15 is not 15). */
export function numbersIn(s: string): string[] {
  const t = s.normalize("NFKC").replace(/−/g, "-");
  return [...t.matchAll(NUM)].map((m) => m[0].replace(/^-+/, "")).map((x) => (/^\d+,\d{1,2}$/.test(x) ? x.replace(",", ".") : x));
}

/** Every fragment of the quote (split at elisions) is found in the page, in order. */
export function quoteFound(quote: string, pageText: string): boolean {
  const hay = lettersOf(pageText);
  let pos = 0;
  for (const frag of quote.split(ELISION)) {
    const f = lettersOf(frag);
    if (f === "") continue;
    const i = hay.indexOf(f, pos);
    if (i < 0) return false;
    pos = i + f.length;
  }
  return true;
}

/** The numbers of every fragment appear in the page, in the same order and contiguously, as written. */
export function numbersFound(quote: string, pageText: string): boolean {
  const doc = numbersIn(pageText);
  for (const frag of quote.split(ELISION)) {
    const q = numbersIn(frag);
    if (q.length === 0) continue;
    let ok = false;
    for (let i = 0; i + q.length <= doc.length && !ok; i += 1) ok = q.every((t, k) => doc[i + k] === t);
    if (!ok) return false;
  }
  return true;
}

export type CitationProblem = "malformed" | "document_not_found" | "page_not_found" | "quote_too_short" | "quote_not_found" | "numbers_not_found";

/** null when the citation is good, otherwise why not. */
export function citationProblem(c: unknown, corpus: Corpus): CitationProblem | null {
  const x = c as Partial<Citation> | null;
  if (!x || typeof x.doc_id !== "string" || typeof x.quote !== "string" || typeof x.page !== "number" || !Number.isInteger(x.page) || x.page < 1) return "malformed";
  if (!corpus.hasDocument(x.doc_id)) return "document_not_found";
  const page = corpus.get(x.doc_id, x.page);
  if (!page) return "page_not_found";
  if (lettersOf(x.quote.replace(new RegExp(ELISION.source, "g"), " ")).length < MIN_QUOTE_CHARS) return "quote_too_short";
  if (!quoteFound(x.quote, page.text)) return "quote_not_found";
  if (!numbersFound(x.quote, page.text)) return "numbers_not_found";
  return null;
}

// ---------- numbers in the model's own sentences ----------

/** Identifiers and labels that contain digits but are not quantities: PSI-25, NASA-STD-6001B, FM2, "Test 1". */
const EXEMPT = [/\b[A-Za-z]+(?:-[A-Za-z]+)*-\d+[A-Za-z]*\b/g, /\b(?:Test|Tests|Table|Figure|Section|Part|Phase|Step)\s+\d+\b/gi];

function numberTokens(text: string): { token: string; index: number; end: number }[] {
  let masked = text.replace(/−/g, "-");
  for (const re of EXEMPT) masked = masked.replace(re, (m) => " ".repeat(m.length));
  return [...masked.matchAll(NUM)].map((m) => ({ token: m[0].replace(/^-+/, ""), index: (m.index as number) + (m[0].startsWith("-") ? m[0].length - m[0].replace(/^-+/, "").length : 0), end: (m.index as number) + m[0].length }));
}

/** The value of a written number; NaN for a comma that could be a thousands separator ("101,325"). */
function valueOf(token: string): number {
  if (/^\d+,\d{1,2}$/.test(token)) return Number(token.replace(",", "."));
  if (token.includes(",")) return Number.NaN;
  return Number(token);
}

/** `written` equals `fact` as far as the digits written go (8.2 matches 8.2, 8.19 and 8.204 do not match 8.2 unless they round to it). */
function sameNumber(written: string, fact: number): boolean {
  const v = valueOf(written);
  if (!Number.isFinite(v) || !Number.isFinite(fact)) return false;
  const decimals = (written.split(/[.,]/)[1] ?? "").length;
  return Math.abs(v - fact) < 1e-9 || Number(fact.toFixed(decimals)) === v;
}

function numberAllowed(token: string, facts: readonly number[], quoteTokens: ReadonlySet<string>): boolean {
  if (quoteTokens.has(token)) return true;
  return facts.some((f) => sameNumber(token, f) || (f >= 0 && f <= 1 && sameNumber(token, f * 100)));
}

/** Every number (and every string's numbers) inside a JSON-like value. */
function factsOf(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number") {
    if (Number.isFinite(value)) out.push(value);
  } else if (typeof value === "string") {
    for (const t of numbersIn(value)) {
      const v = valueOf(t);
      if (Number.isFinite(v)) out.push(v);
    }
  } else if (Array.isArray(value)) {
    for (const v of value) factsOf(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) factsOf(v, out);
  }
  return out;
}

const ID_RE = /\bPSI-\d+\b|\b10\.\d{4,9}\/[^\s,;)"']+/g;

function idsOf(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") for (const m of value.matchAll(ID_RE)) out.add(m[0].replace(/[.]+$/, ""));
  else if (Array.isArray(value)) for (const v of value) idsOf(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) idsOf(v, out);
  return out;
}

const toolFacts = (r: ToolResult): number[] => (r.ok ? [...r.numbers, ...factsOf(r.display), ...Object.values(r.also).map((m) => m.value)] : []);

// ---------- the check ----------

export function checkAnswer(answer: unknown, ctx: CheckContext): CheckResult {
  const kept: KeptBlock[] = [];
  const report: CheckReport = { dropped: [], flaggedNumbers: [], verifiedCitations: [] };
  if (!Array.isArray(answer)) {
    report.dropped.push({ index: -1, layer: "answer", reason: "malformed", detail: "the answer is not a list of blocks" });
    return { kept, report };
  }

  // Pass 1: verify every NASA citation of the whole answer (expert blocks may use any verified quote of the answer).
  const verifiedOf = new Map<number, VerifiedCitation[]>();
  const nasaBad = new Map<number, string>();
  answer.forEach((b: Partial<AnswerBlock> | null, index) => {
    if (!b || b.layer !== "nasa") return;
    const cites = Array.isArray(b.citations) ? b.citations : [];
    if (cites.length === 0) {
      nasaBad.set(index, "no_citation");
      return;
    }
    const good: VerifiedCitation[] = [];
    for (const c of cites) {
      const problem = citationProblem(c, ctx.corpus);
      if (problem) {
        nasaBad.set(index, `citation_${problem}`);
        return;
      }
      const page = ctx.corpus.get(c.doc_id, c.page) as CorpusPage;
      const url = page.url ?? page.file_url;
      good.push({ doc_id: c.doc_id, page: c.page, quote: c.quote, ...(page.title ? { title: page.title } : {}), ...(url ? { url } : {}) });
    }
    verifiedOf.set(index, good);
  });
  const answerQuoteTokens = new Set<string>([...verifiedOf.values()].flat().flatMap((c) => numbersIn(c.quote)));

  // Pass 2: block by block.
  answer.forEach((raw: unknown, index) => {
    const b = raw as Partial<AnswerBlock> | null;
    if (!b || typeof b !== "object" || (b.layer !== "engine" && b.layer !== "nasa" && b.layer !== "expert") || typeof b.text !== "string" || b.text.trim() === "") {
      report.dropped.push({ index, layer: String((b as { layer?: unknown } | null)?.layer ?? "?"), reason: "malformed" });
      return;
    }
    const layer = b.layer;
    const refs = Array.isArray(b.toolRefs) ? b.toolRefs.filter((r): r is string => typeof r === "string") : [];

    if (layer === "nasa") {
      const bad = nasaBad.get(index);
      if (bad) {
        report.dropped.push({ index, layer, reason: bad });
        return;
      }
      const cites = verifiedOf.get(index) as VerifiedCitation[];
      const quoteTokens = new Set(cites.flatMap((c) => numbersIn(c.quote)));
      const { text, flagged } = replaceUntraced(b.text, index, layer, [], quoteTokens, report);
      for (const c of cites) report.verifiedCitations.push({ index, doc_id: c.doc_id, page: c.page, ...(c.title ? { title: c.title } : {}), ...(c.url ? { url: c.url } : {}) });
      kept.push({ layer, text, label: NASA_LABEL, citations: cites, provenance: [], flagged });
      return;
    }

    if (layer === "engine") {
      const outputs = refs.map((r) => ctx.engine?.[r]);
      if (refs.length === 0 || outputs.some((o) => o === undefined)) {
        // An engine block without an engine output to stand on has not earned its label.
        report.dropped.push({ index, layer, reason: refs.length === 0 ? "engine_block_without_reference" : "unknown_engine_reference", detail: refs.join(", ") });
        return;
      }
      const facts = outputs.flatMap((o) => factsOf(o));
      const ids = new Set<string>();
      for (const o of outputs) idsOf(o, ids);
      const badNumber = numberTokens(b.text).find((t) => !numberAllowed(t.token, facts, new Set()));
      if (badNumber) {
        report.dropped.push({ index, layer, reason: "number_not_in_engine_output", detail: badNumber.token });
        return;
      }
      const badId = (b.text.match(ID_RE) ?? []).map((x) => x.replace(/[.]+$/, "")).find((x) => !ids.has(x));
      if (badId) {
        report.dropped.push({ index, layer, reason: "id_not_in_engine_output", detail: badId });
        return;
      }
      kept.push({ layer, text: b.text, label: ENGINE_LABEL, citations: [], provenance: refs.map((r) => `engine output "${r}"`), flagged: false });
      return;
    }

    // expert
    const tools = refs.map((r) => ctx.tools?.[r]);
    const engineOut = refs.map((r) => ctx.engine?.[r]);
    const unknownRef = refs.find((r, i) => tools[i] === undefined && engineOut[i] === undefined);
    if (unknownRef !== undefined) {
      report.dropped.push({ index, layer, reason: "unknown_reference", detail: unknownRef });
      return;
    }
    const facts = [...tools.flatMap((t) => (t ? toolFacts(t) : [])), ...engineOut.flatMap((o) => (o === undefined ? [] : factsOf(o)))];
    const { text, flagged } = replaceUntraced(b.text, index, layer, facts, answerQuoteTokens, report);
    const provenance = tools.flatMap((t) => (t && t.ok ? [`${(t as ToolOk).display} — ${(t as ToolOk).provenance}`] : []));
    kept.push({ layer, text, label: EXPERT_LABEL, citations: [], provenance, flagged });
  });

  return { kept, report };
}

/** Replace each number that is neither in `facts` nor in `quoteTokens`; log each one. */
function replaceUntraced(
  text: string,
  index: number,
  layer: Layer,
  facts: readonly number[],
  quoteTokens: ReadonlySet<string>,
  report: CheckReport,
): { text: string; flagged: boolean } {
  const bad = numberTokens(text).filter((t) => !numberAllowed(t.token, facts, quoteTokens));
  if (bad.length === 0) return { text, flagged: false };
  let out = text;
  // Logged in reading order; replaced from the end so the earlier positions stay valid.
  for (const t of bad) report.flaggedNumbers.push({ index, layer, number: t.token, reason: layer === "nasa" ? "not in the verified quote" : "not from a tool result or a verified quote" });
  for (const t of [...bad].sort((a, b) => b.index - a.index)) out = out.slice(0, t.index) + NUMBER_REMOVED + out.slice(t.end);
  return { text: out, flagged: true };
}
