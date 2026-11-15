import Link from "next/link";
import { notFound } from "next/navigation";
import { Md } from "@/components/tars/TarsExtras";
import { PrintButton, ShowMe } from "@/components/help/HelpClient";
import { CHAPTERS, chapterBySlug } from "@/lib/help-chapters";
import type { Topic } from "@/lib/tars/help";
import { helpTopics } from "@/lib/tars/topics-server";

export const dynamic = "force-dynamic";

/** The labelled parts of an element topic become bold lead-ins; prose written by hand passes through. */
const prose = (body: string) => body.replace(/^(What it is|What it shows|How to use it|Example|What it does not do):\s*/gm, "**$1.** ");

function TopicView({ t }: { t: Topic }) {
  return (
    <section id={t.id} className="help-topic">
      <h3>{t.title}</h3>
      <Md text={prose(t.body)} />
      <div className="help-topic-foot">
        {t.dataHelp?.[0] && <ShowMe link={t.link} selector={t.highlight ?? `[data-help="${t.dataHelp[0]}"]`} />}
        {t.sources && t.sources.length > 0 && <span className="small muted">Sources: {t.sources.join("; ")}</span>}
      </div>
    </section>
  );
}

export default async function ChapterPage({ params }: { params: Promise<{ chapter: string }> }) {
  const { chapter } = await params;
  const all = (await helpTopics()).filter((t) => t.chapter);
  if (chapter !== "all" && !chapterBySlug(chapter)) notFound();
  const slugs = chapter === "all" ? CHAPTERS.map((c) => c.slug) : [chapter];
  const idx = CHAPTERS.findIndex((c) => c.slug === chapter);
  const prev = idx > 0 ? CHAPTERS[idx - 1] : null;
  const next = idx >= 0 && idx < CHAPTERS.length - 1 ? CHAPTERS[idx + 1] : null;
  return (
    <article className="help-chapter">
      <div className="help-actions no-print">
        <PrintButton />
        {chapter !== "all" && (
          <Link data-help="help-reader-print" href="/help/all" className="small">
            Open the whole manual on one page
          </Link>
        )}
      </div>
      {slugs.map((slug) => {
        const c = chapterBySlug(slug)!;
        const topics = all.filter((t) => t.chapter === slug).toSorted((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title));
        return (
          <section key={slug} className="help-chapter-body">
            <h1>
              {c.n}. {c.title}
            </h1>
            <p className="lead muted">{c.intro}</p>
            {topics.length === 0 && <p className="muted">This chapter is being written.</p>}
            {topics.map((t) => (
              <TopicView key={t.id} t={t} />
            ))}
          </section>
        );
      })}
      {chapter !== "all" && (
        <nav className="help-prevnext no-print" data-help="help-reader-nav" aria-label="Chapters">
          {prev ? (
            <Link data-help="help-reader-nav" href={`/help/${prev.slug}`}>
              ← {prev.n}. {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link data-help="help-reader-nav" href={`/help/${next.slug}`}>
              {next.n}. {next.title} →
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
