// The "Evidence brief": a conversation turned into a document a person can hand to someone else and that other person can
// check. Only CHECKED blocks go in (a block must carry one of the three labels, and when a corpus is given every NASA quote
// is verified again on its page). Engine verdicts and the "what would close the gap" section are recomputed by the engine
// from the stated condition, never copied from the model. Pure and deterministic: the date comes in through the context, no
// model is called, and the same conversation gives the same bytes.

import { experimentsNeeded, threePartAnswer, type CatalogEntry, type ConditionRecord, type Target } from "../../../engine/src/index.ts";
import { citationProblem, ENGINE_LABEL, EXPERT_LABEL, NASA_LABEL, type Corpus, type KeptBlock, type VerifiedCitation } from "./claims.ts";

export interface BriefTurn {
  question: string;
  /** The checked blocks of the answer (the `kept` of checkAnswer). Nothing else is used. */
  kept: readonly KeptBlock[];
  /** The condition the engine was asked about, when the question had one. */
  target?: Target | null;
  /** The model that wrote the answer (id and display name), for the "models used" line. */
  model?: { model: string; name?: string } | null;
  /** A second opinion that was shown beside the answer, if any. */
  skeptic?: { verdict: string; model?: { model: string; name?: string } | null; objections: { blockIndex: number; reason: string }[] } | null;
}

export interface BriefContext {
  /** The date line, written by the caller (for example "2026-11-15"). The module never reads a clock. */
  date: string;
  /** With records the brief recomputes the engine part (verdict sentences with receipts, fingerprint, what would close the gap). */
  records?: readonly ConditionRecord[];
  catalog?: Record<string, CatalogEntry>;
  /** With a corpus every NASA quote is verified again on its page; a block with an unverified quote is left out. */
  corpus?: Corpus;
  /** Extra model names (for example the one that split claims), shown in "Models used". */
  extraModels?: readonly string[];
  title?: string;
}

export interface BibliographyEntry {
  n: number;
  kind: "document" | "investigation";
  /** Title, or the investigation id and acronym. */
  title: string;
  doc_id?: string;
  /** PDF page numbers cited, ascending. */
  pages: number[];
  url?: string;
  doi?: string;
  ntrs_id?: string;
}

export interface Brief {
  markdown: string;
  /** A complete, self-contained HTML document with print styles. */
  html: string;
  bibliography: BibliographyEntry[];
  /** Why a block was left out (never the block's words). */
  left_out: string[];
  /** One 64-character fingerprint per question with a condition. */
  fingerprints: string[];
  models: string[];
}

const KNOWN_LABELS = new Set([ENGINE_LABEL, NASA_LABEL, EXPERT_LABEL]);
const doiUrl = (doi: string) => `https://doi.org/${doi}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const quoteLine = (s: string) => oneLine(s).replace(/"/g, "'");

/** Keep only blocks that are checked: a known label, and (with a corpus) NASA quotes that verify again. */
function checkedBlocks(turnIndex: number, kept: readonly KeptBlock[], corpus: Corpus | undefined, leftOut: string[]): KeptBlock[] {
  const out: KeptBlock[] = [];
  kept.forEach((b, i) => {
    const where = `question ${turnIndex + 1}, block ${i + 1}`;
    if (!b || typeof b.text !== "string" || !KNOWN_LABELS.has(b.label)) return void leftOut.push(`${where}: not a checked block (no valid label)`);
    if (b.layer === "nasa") {
      if (b.citations.length === 0) return void leftOut.push(`${where}: a NASA block without a citation`);
      if (corpus) {
        const bad = b.citations.map((c) => citationProblem(c, corpus)).find((p) => p !== null);
        if (bad) return void leftOut.push(`${where}: its NASA quote did not verify again (${bad})`);
      }
    }
    if (b.layer === "engine" && b.provenance.length === 0) return void leftOut.push(`${where}: an engine block without provenance`);
    out.push(b);
  });
  return out;
}

class Bibliography {
  private docs = new Map<string, BibliographyEntry>();
  private order: string[] = [];
  private add(key: string, make: () => Omit<BibliographyEntry, "n" | "pages">, page?: number): BibliographyEntry {
    let e = this.docs.get(key);
    if (!e) {
      e = { n: this.order.length + 1, pages: [], ...make() };
      this.docs.set(key, e);
      this.order.push(key);
    }
    if (page !== undefined && !e.pages.includes(page)) e.pages.push(page);
    return e;
  }
  cite(c: VerifiedCitation): BibliographyEntry {
    return this.add(`doc:${c.doc_id}`, () => ({ kind: "document", title: c.title ?? c.doc_id, doc_id: c.doc_id, ...(c.url ? { url: c.url } : {}), ...(c.doi ? { doi: c.doi } : {}), ...(c.ntrs_id ? { ntrs_id: c.ntrs_id } : {}) }), c.page);
  }
  investigation(accession: string, acronym?: string, doi?: string, title?: string): BibliographyEntry {
    return this.add(`inv:${accession}`, () => ({ kind: "investigation", title: `${accession}${acronym ? ` ${acronym}` : ""}${title ? ` — ${title}` : ""}`, ...(doi ? { doi } : {}) }));
  }
  entries(): BibliographyEntry[] {
    return this.order.map((k) => {
      const e = this.docs.get(k) as BibliographyEntry;
      return { ...e, pages: [...e.pages].sort((a, b) => a - b) };
    });
  }
}

const ref = (e: BibliographyEntry, page?: number) => (page !== undefined ? `[${e.n}, p. ${page}]` : `[${e.n}]`);

interface Section {
  heading: string;
  /** Markdown lines. */
  lines: string[];
}

export function buildBrief(conversation: readonly BriefTurn[], ctx: BriefContext): Brief {
  const bib = new Bibliography();
  const leftOut: string[] = [];
  const fingerprints: string[] = [];
  const models: string[] = [];
  const addModel = (m: { model: string; name?: string } | null | undefined) => {
    if (!m) return;
    const label = m.name ? `${m.name} (${m.model})` : m.model;
    if (!models.includes(label)) models.push(label);
  };
  for (const m of ctx.extraModels ?? []) if (!models.includes(m)) models.push(m);

  let engineLine = "";
  const turns: Section[] = [];
  const gapSections: string[][] = [];

  conversation.forEach((turn, t) => {
    addModel(turn.model);
    const blocks = checkedBlocks(t, turn.kept, ctx.corpus, leftOut);
    const lines: string[] = [`> ${oneLine(turn.question)}`, ""];

    // Engine verdicts: recomputed from the condition, with receipts and the fingerprint.
    if (turn.target && ctx.records) {
      const a = threePartAnswer(ctx.records, turn.target, { mode: "advanced", ...(ctx.catalog ? { catalog: ctx.catalog } : {}) });
      engineLine = `${a.engine.name} ${a.engine.version}`;
      fingerprints.push(a.fingerprint);
      lines.push("**Engine verdicts (computed by code)**", "");
      const cite = (c: { accession: string; acronym?: string; doi?: string }) => {
        const e = bib.investigation(c.accession, c.acronym, c.doi, ctx.catalog?.[c.accession]?.title);
        return ref(e);
      };
      for (const k of a.known) lines.push(`- Known: ${k.sentence} ${k.citations.map(cite).join(" ")}`.trim());
      for (const k of a.known) for (const c of k.citations) if (c.recordIds.length) lines.push(`  - Receipts for ${c.accession}: ${c.recordIds.map((r) => `\`${r}\``).join(", ")}`);
      for (const u of a.unknown) lines.push(`- Not known: ${u.sentence}`);
      for (const n of a.next) lines.push(`- Next: ${n.sentence}`);
      lines.push(`- Fingerprint (SHA-256 of the engine's evaluation): \`${a.fingerprint}\``, "");

      const g = experimentsNeeded(ctx.records, turn.target, ctx.catalog ? { catalog: ctx.catalog } : {});
      const gap: string[] = [`**Question ${t + 1}.** ${g.gap.sentence}`];
      for (const d of g.gap.detail) gap.push(`- ${d}`);
      for (const p of g.priority.slice(0, 5)) gap.push(`- Priority ${p.rank}: ${p.sentence}`);
      gap.push(`- ${g.testMatrix.sentence}`, `- ${g.label}`);
      gapSections.push(gap);
    } else if (turn.target) {
      lines.push("**Engine verdicts:** not recomputed here (no records were supplied).", "");
    }

    // Checked blocks, each under its own label.
    const nasa = blocks.filter((b) => b.layer === "nasa");
    const engine = blocks.filter((b) => b.layer === "engine");
    const expert = blocks.filter((b) => b.layer === "expert");

    if (engine.length) {
      lines.push("**What the engine and calculators computed**", "");
      for (const b of engine) lines.push(`- ${oneLine(b.text)}`, ...b.provenance.map((p) => `  - ${oneLine(p)}`));
      lines.push("");
    }
    if (nasa.length) {
      lines.push("**What NASA sources say (quotes checked on the cited page)**", "");
      for (const b of nasa) {
        const refs = b.citations.map((c) => ref(bib.cite(c), c.page)).join(" ");
        lines.push(`- ${oneLine(b.text)} ${refs}`);
        for (const c of b.citations) lines.push(`  - "${quoteLine(c.quote)}" — ${oneLine(c.title ?? c.doc_id)}, PDF p. ${c.page}`);
      }
      lines.push("");
    }
    if (expert.length) {
      lines.push(`**TARS expert reasoning** — *${EXPERT_LABEL}*`, "");
      for (const b of expert) lines.push(`- ${oneLine(b.text)}${b.flagged ? " *(a number that was not from a source was removed)*" : ""}`);
      lines.push("");
    }
    if (turn.skeptic && turn.skeptic.verdict !== "unavailable") {
      addModel(turn.skeptic.model);
      lines.push(`**Second opinion** (a different model family; shown beside the answer, it did not change it): ${turn.skeptic.verdict}`);
      for (const o of turn.skeptic.objections) lines.push(`- Block ${o.blockIndex + 1}: ${oneLine(o.reason)}`);
      lines.push("");
    }
    if (blocks.length === 0) lines.push("_No checked block from this answer could be included._", "");
    turns.push({ heading: `Question ${t + 1}`, lines });
  });

  const entries = bib.entries();
  const md: string[] = [`# ${ctx.title ?? "Evidence brief"}`, "", `Date: ${ctx.date}`, `Prepared with PYRION${engineLine ? ` (${engineLine})` : ""}. Only checked statements are included: every NASA quote was found on the cited page, every engine number was computed by code, and the expert layer is labelled as not verified against a source.`, ""];
  md.push("## Questions and findings", "");
  for (const s of turns) md.push(`### ${s.heading}`, "", ...s.lines);
  md.push("## What would close this gap", "");
  if (gapSections.length === 0) md.push("_No condition was evaluated, so there is no gap to describe._", "");
  for (const g of gapSections) md.push(...g, "");
  if (gapSections.length) md.push("_This is a PYRION proposal (a testable plan), not a NASA plan._", "");
  md.push("## Models used", "");
  if (models.length === 0) md.push("- None recorded.");
  for (const m of models) md.push(`- ${m}`);
  md.push("- The verdicts, numbers and quote checks above were produced by code, not by a model.", "");
  md.push("## Bibliography", "");
  if (entries.length === 0) md.push("_No source was cited._");
  for (const e of entries) {
    const bits = [`[${e.n}] ${e.title}`];
    if (e.doc_id) bits.push(`document \`${e.doc_id}\``);
    if (e.pages.length) bits.push(`PDF p. ${e.pages.join(", ")}`);
    if (e.url) bits.push(e.url);
    if (e.doi) bits.push(`DOI ${doiUrl(e.doi)}`);
    if (e.ntrs_id) bits.push(`NTRS ${e.ntrs_id}`);
    md.push(`- ${bits.join(" — ")}`);
  }
  md.push("", "## How to verify", "");
  md.push("1. For each NASA quote, open the URL or DOI in the bibliography, go to the PDF page given, and find the quoted words on that page (the page number is the PDF page, not the printed one).");
  md.push("2. For each engine verdict, rerun PYRION with the same condition and records: the 64-character fingerprint above must be identical; a different fingerprint means different records or a different engine version.");
  md.push("3. Receipts (`investigation|test|variable|source file|location`) point to the exact record behind each statement.");
  md.push("4. Anything labelled TARS expert knowledge is not verified against a source; treat it as a question to check, not as a fact.");
  if (leftOut.length) md.push("", "## Left out", "", ...leftOut.map((l) => `- ${l}`));
  const markdown = md.join("\n") + "\n";

  return { markdown, html: toHtml(markdown, ctx.title ?? "Evidence brief"), bibliography: entries, left_out: leftOut, fingerprints, models };
}

// ---- Markdown (the subset written above) to a print-ready HTML document ----

function inline(s: string): string {
  let h = esc(s);
  h = h.replace(/`([^`]+)`/g, "<code>$1</code>");
  h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  h = h.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  h = h.replace(/_([^_]+)_/g, "<em>$1</em>");
  h = h.replace(/(https?:\/\/[^\s<)]+)/g, '<a href="$1">$1</a>');
  return h;
}

function toHtml(markdown: string, title: string): string {
  const out: string[] = [];
  let depth = 0; // open <ul> levels
  const closeTo = (d: number) => {
    while (depth > d) {
      out.push("</ul>");
      depth -= 1;
    }
  };
  for (const raw of markdown.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (line === "") {
      closeTo(0);
      continue;
    }
    const h = /^(#{1,3}) (.*)$/.exec(line);
    if (h) {
      closeTo(0);
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    if (line.startsWith("> ")) {
      closeTo(0);
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }
    const li = /^( *)- (.*)$/.exec(line);
    if (li) {
      const want = Math.floor(li[1].length / 2) + 1;
      while (depth < want) {
        out.push("<ul>");
        depth += 1;
      }
      closeTo(want);
      out.push(`<li>${inline(li[2])}</li>`);
      continue;
    }
    const ol = /^(\d+)\. (.*)$/.exec(line);
    if (ol) {
      closeTo(0);
      out.push(`<p class="step"><span>${ol[1]}.</span> ${inline(ol[2])}</p>`);
      continue;
    }
    closeTo(0);
    out.push(`<p>${inline(line)}</p>`);
  }
  closeTo(0);
  const css = "body{font:14px/1.5 Georgia,serif;max-width:46rem;margin:2rem auto;padding:0 1rem;color:#111}h1{font-size:1.6rem}h2{font-size:1.2rem;border-bottom:1px solid #999;margin-top:1.6rem}h3{font-size:1rem}blockquote{margin:.5rem 0;padding-left:.8rem;border-left:3px solid #888;color:#333}code{font:12px ui-monospace,Consolas,monospace;word-break:break-all}ul{margin:.2rem 0;padding-left:1.2rem}.step span{font-weight:bold}a{color:#0645ad;word-break:break-all}@media print{body{margin:0;max-width:none}h2{break-after:avoid}li{break-inside:avoid}a{color:inherit}}";
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body>\n${out.join("\n")}\n</body></html>\n`;
}
