import type { Metadata } from "next";
import { HelpSearch, Toc, type TocChapter, type TocTopic } from "@/components/help/HelpClient";
import { CHAPTERS } from "@/lib/help-chapters";
import { helpTopics } from "@/lib/tars/topics-server";
import "../help.css";

export const metadata: Metadata = { title: "Help · PYRION Ω", description: "The manual of PYRION: every page, button and number, chapter by chapter." };
export const dynamic = "force-dynamic";

export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const topics = (await helpTopics()).filter((t) => t.chapter && CHAPTERS.some((c) => c.slug === t.chapter));
  const chapters: TocChapter[] = CHAPTERS.map((c) => ({
    slug: c.slug,
    n: c.n,
    title: c.title,
    topics: topics
      .filter((t) => t.chapter === c.slug)
      .toSorted((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title))
      .map((t) => ({ id: t.id, title: t.title })),
  }));
  const search: TocTopic[] = topics.map((t) => ({ id: t.id, title: t.title, chapter: t.chapter as string, keywords: t.keywords, snippet: t.body.slice(0, 320) }));
  return (
    <main className="page help-reader">
      <aside className="help-side">
        <HelpSearch topics={search} />
        <Toc chapters={chapters} />
      </aside>
      <div className="help-main">{children}</div>
    </main>
  );
}
