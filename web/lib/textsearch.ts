// TF-IDF cosine ranking over short texts. Pure, deterministic. Shared by the text-vs-physics block and the Copilot's text_search tool.

const STOP = new Set(
  "a an and as at by for from in into of on or the to via with under is are be this that its it vs".split(" "),
);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));

export function tfidfRank(docs: { id: string; text: string }[], query: string): { id: string; score: number }[] {
  const dt = docs.map((d) => tokens(d.text));
  const df = new Map<string, number>();
  for (const ts of dt) for (const t of new Set(ts)) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log((1 + docs.length) / (1 + (df.get(t) ?? 0))) + 1;
  const vec = (ts: string[]) => {
    const v = new Map<string, number>();
    for (const t of ts) v.set(t, (v.get(t) ?? 0) + 1);
    for (const [t, n] of v) v.set(t, n * idf(t));
    return v;
  };
  const norm = (v: Map<string, number>) => Math.sqrt([...v.values()].reduce((a, b) => a + b * b, 0)) || 1;
  const q = vec(tokens(query));
  const qn = norm(q);
  return docs
    .map((d, i) => {
      const v = vec(dt[i]);
      let dot = 0;
      for (const [t, w] of q) dot += w * (v.get(t) ?? 0);
      return { id: d.id, score: dot / (qn * norm(v)) };
    })
    .toSorted((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
}
