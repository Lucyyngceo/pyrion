// Server only: the NASA library for the expert chat (web/.data/corpus, built by tools/build_corpus.py).
// BM25 search over the chunks, whole pages by (doc_id, page), and the corpus the claim checker verifies quotes against.
// When the corpus is not on this server the library is null and the chat works without the NASA layer.

import { open, readFile } from "node:fs/promises";
import { join } from "node:path";
import { corpusFromPages, parseCorpusJsonl, type Corpus, type CorpusPage } from "./claims";

const DIR = join(process.cwd(), ".data", "corpus");
const STOP = new Set("a an and are as at be by for from in is it of on or that the this to was were with".split(" "));
const TOKEN = /[a-z0-9]+(?:[.\-][a-z0-9]+)*/g;

/** The same tokenization as tools/build_corpus.py, so queries meet the index. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const t of text.normalize("NFKC").toLowerCase().match(TOKEN) ?? []) {
    if (STOP.has(t)) continue;
    out.push(t);
    if (t.includes("-")) out.push(...t.split("-").filter((p) => p && !STOP.has(p)));
  }
  return out;
}

export interface Passage {
  doc_id: string;
  page_start: number;
  page_end: number;
  title: string;
  url: string;
  text: string;
  score: number;
}

export interface Library {
  search(query: string, top?: number): Promise<Passage[]>;
  page(doc_id: string, page: number): CorpusPage | undefined;
  corpus: Corpus;
}

interface Index {
  k1: number;
  b: number;
  N: number;
  avgdl: number;
  chunks: [string, number, number, number][];
  postings: Record<string, number[]>;
}

let cache: Promise<Library | null> | null = null;

export function loadLibrary(): Promise<Library | null> {
  cache ??= (async () => {
    try {
      const [idx, pagesText] = await Promise.all([readFile(join(DIR, "bm25.json"), "utf8").then((t) => JSON.parse(t) as Index), readFile(join(DIR, "pages.jsonl"), "utf8")]);
      const { pages } = parseCorpusJsonl(pagesText);
      const corpus = corpusFromPages(pages);
      const byKey = new Map(pages.map((p) => [`${p.doc_id}#${p.page}`, p]));
      return {
        corpus,
        page: (doc_id, page) => byKey.get(`${doc_id}#${page}`) ?? byKey.get(`nasa/${doc_id}#${page}`),
        async search(query, top = 5) {
          const scores = new Map<number, number>();
          for (const term of new Set(tokenize(query))) {
            const post = idx.postings[term];
            if (!post) continue;
            const df = post.length / 2;
            const idf = Math.log(1 + (idx.N - df + 0.5) / (df + 0.5));
            for (let j = 0; j < post.length; j += 2) {
              const d = post[j];
              const tf = post[j + 1];
              const dl = idx.chunks[d][3];
              scores.set(d, (scores.get(d) ?? 0) + (idf * tf * (idx.k1 + 1)) / (tf + idx.k1 * (1 - idx.b + (idx.b * dl) / idx.avgdl)));
            }
          }
          const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, top);
          const fh = await open(join(DIR, "chunks.jsonl"), "r");
          try {
            const out: Passage[] = [];
            for (const [d, score] of ranked) {
              const [, off, len] = idx.chunks[d];
              const buf = Buffer.alloc(len);
              await fh.read(buf, 0, len, off);
              const r = JSON.parse(buf.toString("utf8")) as { doc_id: string; page_start: number; page_end: number; title?: string; url?: string; text: string };
              out.push({ doc_id: r.doc_id, page_start: r.page_start, page_end: r.page_end, title: r.title ?? "", url: r.url ?? "", text: r.text, score: Math.round(score * 1000) / 1000 });
            }
            return out;
          } finally {
            await fh.close();
          }
        },
      } satisfies Library;
    } catch (e) {
      console.warn("[pyrion] NASA library not available:", e instanceof Error ? e.message : e);
      return null;
    }
  })();
  return cache;
}
