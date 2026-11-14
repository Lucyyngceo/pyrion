"use client";

import { memo, useMemo } from "react";
import type { Evaluation, Verdict } from "@/lib/engine";
import type { Investigation } from "@/lib/types";

// Side by side: the same question ranked by text similarity of PSI titles (TF-IDF, cosine)
// and by the engine's physical verdicts. Deterministic, no language model.

const STOP = new Set(
  "a an and as at by for from in into of on or the to via with under is are be this that its it vs".split(" "),
);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));

function tfidfRank(docs: { id: string; text: string }[], query: string) {
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

const ORDER: Record<Verdict, number> = { APPLICABLE: 0, EXTRAPOLATION: 1, INSUFFICIENT_EVIDENCE: 2, REGIME_BARRIER: 3 };
const SHORT: Record<Verdict, string> = {
  APPLICABLE: "applicable",
  EXTRAPOLATION: "extrapolation",
  INSUFFICIENT_EVIDENCE: "insufficient evidence",
  REGIME_BARRIER: "not comparable",
};
const CLS: Record<Verdict, string> = { APPLICABLE: "v-app", EXTRAPOLATION: "v-ext", INSUFFICIENT_EVIDENCE: "v-ins", REGIME_BARRIER: "v-bar" };
const N = 8;

function TextVsPhysics({
  evaluation,
  investigations,
  query,
  onHover,
}: {
  evaluation: Evaluation;
  investigations: Investigation[];
  query: string;
  onHover: (a: string | null) => void;
}) {
  const verdictOf = useMemo(() => new Map(evaluation.investigations.map((i) => [i.accession, i.verdict])), [evaluation]);
  const inv = useMemo(() => new Map(investigations.map((i) => [i.accession, i])), [investigations]);

  const text = useMemo(
    () =>
      tfidfRank(
        investigations.filter((i) => verdictOf.has(i.accession)).map((i) => ({ id: i.accession, text: [i.acronym, i.title, ...(i.publications ?? [])].join(" ") })),
        query,
      ).slice(0, N),
    [investigations, verdictOf, query],
  );
  const physics = useMemo(() => {
    const rank = new Map([...evaluation.ranked].map((c) => [c.accession, c.rank ?? 1e9]));
    return evaluation.investigations
      .toSorted((a, b) => ORDER[a.verdict] - ORDER[b.verdict] || (rank.get(a.accession) ?? 1e9) - (rank.get(b.accession) ?? 1e9))
      .slice(0, N);
  }, [evaluation]);

  const textTopNotComparable = text.slice(0, 3).filter((t) => verdictOf.get(t.id) === "REGIME_BARRIER").length;

  const Row = ({ id, i, right }: { id: string; i: number; right: React.ReactNode }) => {
    const v = verdictOf.get(id);
    return (
      <li className="tvp-row" onPointerEnter={() => onHover(id)} onPointerLeave={() => onHover(null)}>
        <span className="tvp-rank">{i + 1}</span>
        <span className="tvp-name">
          <span className="acc">{id}</span> {inv.get(id)?.acronym}
        </span>
        <span className={`tvp-v ${v ? CLS[v] : ""}`}>{v ? SHORT[v] : ""}</span>
        {right}
      </li>
    );
  };

  return (
    <section className="card tvp" aria-labelledby="tvp-h">
      <div className="card-head">
        <h2 id="tvp-h">Ranked by text similarity vs. ranked by physics</h2>
        <p className="muted small">
          The same target, ranked two ways. Left: TF-IDF cosine similarity between the target description and each PSI
          investigation&apos;s text: its title plus the titles of the publications PSI lists for it. Right: the engine&apos;s physical verdicts. Each row shows the physical verdict
          of that investigation.
        </p>
      </div>
      <div className="tvp-cols">
        <div>
          <h3 className="tvp-h">By text similarity</h3>
          <ol className="tvp-list">
            {text.map((t, i) => (
              <Row key={t.id} id={t.id} i={i} right={<span className="tvp-score">{t.score.toFixed(2)}</span>} />
            ))}
          </ol>
        </div>
        <div>
          <h3 className="tvp-h">By physics</h3>
          <ol className="tvp-list">
            {physics.map((p, i) => (
              <Row key={p.accession} id={p.accession} i={i} right={<span className="tvp-score" />} />
            ))}
          </ol>
        </div>
      </div>
      <p className="small tvp-note">
        Query: <q>{query}</q>
        {textTopNotComparable > 0 &&
          ` ${textTopNotComparable} of the top 3 by text similarity measured a different physical regime (not comparable).`}
      </p>
    </section>
  );
}

export default memo(TextVsPhysics);
