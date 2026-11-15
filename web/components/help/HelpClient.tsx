"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { highlight, storePending } from "@/lib/tars/bridge";
import { MIN_SCORE, searchTopics, type Topic } from "@/lib/tars/help";

export interface TocTopic {
  id: string;
  title: string;
  chapter: string;
  keywords: string[];
  snippet: string;
}
export interface TocChapter {
  slug: string;
  n: number;
  title: string;
  topics: { id: string; title: string }[];
}

/** The table of contents: every chapter and every topic. The chapter you are reading is open. */
export function Toc({ chapters }: { chapters: TocChapter[] }) {
  const path = usePathname();
  const active = path.split("/")[2] ?? "";
  return (
    <nav className="help-toc" data-help="help-reader-toc" aria-label="Table of contents">
      {chapters.map((c) => (
        <details key={c.slug} open={c.slug === active}>
          <summary data-help="help-reader-toc">
            <Link data-help="help-reader-toc" href={`/help/${c.slug}`} aria-current={c.slug === active ? "page" : undefined}>
              {c.n}. {c.title}
            </Link>
          </summary>
          <ul>
            {c.topics.map((t) => (
              <li key={t.id}>
                <Link data-help="help-reader-toc" href={`/help/${c.slug}#${t.id}`}>
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </nav>
  );
}

/** Search over titles, keywords and the start of each topic: choosing a result jumps to the topic. */
export function HelpSearch({ topics }: { topics: TocTopic[] }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const asTopics = useMemo<Topic[]>(() => topics.map((t) => ({ id: t.id, title: t.title, keywords: t.keywords, link: "/", body: t.snippet, chapter: t.chapter })), [topics]);
  const hits = useMemo(() => (q.trim().length < 2 ? [] : searchTopics(asTopics, q, 8).filter((h) => h.score >= MIN_SCORE * 0.5)), [asTopics, q]);
  return (
    <div className="help-search no-print">
      <input data-help="help-reader-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the manual…" aria-label="Search the manual" />
      {q.trim().length >= 2 && (
        <ul className="help-hits">
          {hits.map((h) => (
            <li key={h.topic.id}>
              <button
                data-help="help-reader-search"
                type="button"
                onClick={() => {
                  setQ("");
                  router.push(`/help/${h.topic.chapter}#${h.topic.id}`);
                }}
              >
                {h.topic.title}
              </button>
            </li>
          ))}
          {hits.length === 0 && <li className="muted small">No topic matches.</li>}
        </ul>
      )}
    </div>
  );
}

/** "Show me": go to the page and outline the element(s) the topic describes. */
export function ShowMe({ link, selector }: { link: string; selector: string }) {
  const router = useRouter();
  return (
    <button
      data-help="help-reader-show-me"
      type="button"
      className="show-me no-print"
      onClick={() => {
        storePending({ highlight: selector });
        router.push(link);
        window.setTimeout(() => highlight(selector, 2), 800);
      }}
    >
      Show me
    </button>
  );
}

export function PrintButton() {
  return (
    <button data-help="help-reader-print" type="button" className="chip no-print" onClick={() => window.print()} title="Print, or save as PDF from the print dialog">
      Print / download as PDF
    </button>
  );
}
