"use client";

import { useRef, useState } from "react";

interface PageData {
  title: string;
  url: string;
  text: string;
}
const cache = new Map<string, Promise<PageData | null>>();

const load = (doc: string, page: number): Promise<PageData | null> => {
  const key = `${doc}#${page}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/library/page?doc_id=${encodeURIComponent(doc)}&page=${page}`)
      .then((r) => (r.ok ? (r.json() as Promise<PageData>) : null))
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
};

/** The page text around the quote, with the quoted sentence marked. The quote was verified by code; this only shows where. */
function around(text: string, quote: string): { before: string; hit: string; after: string } | null {
  const words = quote.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (words.length === 0) return null;
  const m = new RegExp(words.join("[\\s\\W]*"), "i").exec(text);
  if (!m) return null;
  const s = Math.max(0, m.index - 500);
  const e = Math.min(text.length, m.index + m[0].length + 500);
  return { before: (s > 0 ? "… " : "") + text.slice(s, m.index), hit: m[0], after: text.slice(m.index + m[0].length, e) + (e < text.length ? " …" : "") };
}

/** A NASA quote that, on hover or focus, shows the real page of the corpus with the quotation highlighted. */
export function CitationQuote({ doc_id, page, quote, title, url }: { doc_id: string; page: number; quote: string; title?: string; url?: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PageData | null | undefined>(undefined);
  const timer = useRef(0);
  const show = () => {
    window.clearTimeout(timer.current);
    setOpen(true);
    if (data === undefined) void load(doc_id, page).then(setData);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 250);
  };
  const seg = data ? around(data.text, quote) : null;
  return (
    <blockquote data-help="tars-citation-preview" className="tars-quote" tabIndex={0} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      “{quote}”
      <footer className="small muted">
        {title ?? doc_id}, p. {page}
        {url && (
          <>
            {" · "}
            <a data-help="tars-document-link" href={url} target="_blank" rel="noreferrer">
              open the document
            </a>
          </>
        )}
      </footer>
      {open && (
        <div className="tars-pagepop" role="note" onMouseEnter={show} onMouseLeave={hide}>
          <strong className="small">{data?.title || title || doc_id}, page {page}</strong>
          {data === undefined && <p className="small muted">Loading the page…</p>}
          {data === null && <p className="small muted">The page text is not available on this server.</p>}
          {data && seg && (
            <p className="small">
              {seg.before}
              <mark>{seg.hit}</mark>
              {seg.after}
            </p>
          )}
          {data && !seg && <p className="small">{data.text.slice(0, 1000)}</p>}
        </div>
      )}
    </blockquote>
  );
}
