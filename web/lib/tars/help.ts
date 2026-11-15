// TARS Support: help topics (web/content/help/*.md) and keyword retrieval (BM25). Pure, no model, no network.

export interface Topic {
  id: string;
  title: string;
  keywords: string[];
  /** Where "Take me there" goes. */
  link: string;
  /** A CSS selector to highlight after arriving. */
  highlight?: string;
  body: string;
}

/** "---\ntitle: x\nkeywords: a, b\nlink: /\nhighlight: .y\n---\nbody" */
export function parseTopic(id: string, text: string): Topic {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`help topic ${id}: missing front matter`);
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  if (!fm.title || !fm.link) throw new Error(`help topic ${id}: title and link are required`);
  return { id, title: fm.title, keywords: (fm.keywords ?? "").split(",").map((k) => k.trim()).filter(Boolean), link: fm.link, ...(fm.highlight ? { highlight: fm.highlight } : {}), body: m[2].replace(/\r\n/g, "\n").trim() };
}

const STOP = new Set("a an the is are was were be of to in on at for and or do does did how what why when where which who can i my me it this that with about use used using please tell show explain mean means meaning work works".split(" "));

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((w) => !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
}

export interface Hit {
  topic: Topic;
  score: number;
}

const K1 = 1.5;
const B = 0.75;

/** BM25 over title and keywords (weighted by repetition) plus the body. Returns hits best first; an empty list when nothing matches a word. */
export function searchTopics(topics: readonly Topic[], query: string, limit = 3): Hit[] {
  const q = [...new Set(tokens(query))];
  if (topics.length === 0) return [];
  // "what is this?", "help": only common words. The overview answers.
  if (q.length === 0) {
    const overview = topics.find((t) => t.id === "what-is-pyrion");
    return overview ? [{ topic: overview, score: MIN_SCORE + 1 }] : [];
  }
  const docs = topics.map((t) => ({ t, words: [...tokens(t.title), ...tokens(t.title), ...tokens(t.title), ...t.keywords.flatMap(tokens), ...t.keywords.flatMap(tokens), ...t.keywords.flatMap(tokens), ...tokens(t.body)] }));
  const avg = docs.reduce((n, d) => n + d.words.length, 0) / docs.length;
  const df = new Map<string, number>();
  for (const w of q) df.set(w, docs.filter((d) => d.words.includes(w)).length);
  const hits: Hit[] = [];
  for (const d of docs) {
    let score = 0;
    for (const w of q) {
      const f = d.words.filter((x) => x === w).length;
      if (f === 0) continue;
      const n = df.get(w) ?? 0;
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.words.length) / avg)));
    }
    if (score > 0) hits.push({ topic: d.t, score });
  }
  return hits.toSorted((a, b) => b.score - a.score).slice(0, limit);
}

/** Below this the best topic is not an answer, it is a coincidence of one common word. */
export const MIN_SCORE = 1.2;
