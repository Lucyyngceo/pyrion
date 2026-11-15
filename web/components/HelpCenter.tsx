"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { highlight, storePending } from "@/lib/tars/bridge";
import { MIN_SCORE, searchTopics, type Topic } from "@/lib/tars/help";
import { useRouter } from "next/navigation";

interface HelpTopic extends Topic {
  page: string;
  chapter?: string;
}

const PAGES: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "envelope", label: "Dashboard" },
  { id: "bridge", label: "Bridge" },
  { id: "data", label: "Data" },
  { id: "method", label: "Method" },
  { id: "why", label: "Why" },
  { id: "tars", label: "TARS" },
  { id: "planner", label: "Planner" },
  { id: "global", label: "Everywhere" },
  { id: "overview", label: "Overviews" },
];

/**
 * The Help center (a searchable list of every topic, by page) and Help mode (click any element to read its topic).
 * Both read web/content/help/*.md, the same topics TARS Support and the expert chat use.
 */
export default function HelpCenter() {
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<HelpTopic[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState("all");
  const [helpMode, setHelpMode] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const path = usePathname();

  const load = async () => {
    if (topics.length > 0) return topics;
    try {
      const r = await fetch("/api/tars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "help-all" }) });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { topics?: HelpTopic[] };
      setTopics(d.topics ?? []);
      setLoadFailed(false);
      return d.topics ?? [];
    } catch {
      setLoadFailed(true);
      return [];
    }
  };

  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<string | undefined>).detail;
      void load();
      setSelected(id ?? null);
      setOpen(true);
    };
    const onMode = (e: Event) => setHelpMode((e as CustomEvent<boolean | undefined>).detail ?? ((m) => !m)(false));
    window.addEventListener("pyrion:help", onOpen);
    window.addEventListener("pyrion:help-mode", onMode);
    return () => {
      window.removeEventListener("pyrion:help", onOpen);
      window.removeEventListener("pyrion:help-mode", onMode);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics.length]);

  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      // Whatever opened the center (the ? menu, Help mode, a link on /tars), the topics are loaded now; a failed load is retried.
      void load();
    } else if (dialog.current?.open) dialog.current.close();
  }, [open]);

  // Help mode: a click on any element with a topic opens the topic and does not run the element's action. The help UI itself stays usable.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-help-mode", helpMode);
    if (!helpMode) return;
    void load();
    const on = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || t.closest(".help-pop, .help-center, .help-mode-banner, .help-btn")) return;
      const el = t.closest("[data-help]");
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      setSelected(el.getAttribute("data-help"));
      setOpen(true);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !open && setHelpMode(false);
    document.addEventListener("click", on, true);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", on, true);
      window.removeEventListener("keydown", esc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helpMode, open]);

  // Dev only: every interactive element must carry a topic, and every id must have one. (The test suite enforces the same on the source.)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const t = window.setTimeout(async () => {
      const list = await load();
      const known = new Set(list.map((x) => x.id));
      const bare = [...document.querySelectorAll("button, a[href], input, select, textarea, summary, [role=button], [role=menuitem], [role=option]")].filter(
        (el) => !el.closest("[data-help]") && !el.closest("nextjs-portal"),
      );
      const unknown = [...document.querySelectorAll("[data-help]")].map((el) => el.getAttribute("data-help") ?? "").filter((id) => id && !known.has(id));
      if (bare.length) console.warn(`[pyrion] ${bare.length} interactive element(s) without data-help on ${path}:`, bare);
      if (unknown.length) console.warn(`[pyrion] data-help ids without a topic on ${path}:`, [...new Set(unknown)]);
    }, 2500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const shown = useMemo(() => {
    const inPage = (t: HelpTopic) => page === "all" || (page === "overview" ? !t.page || t.page === "overview" : t.page === page);
    if (q.trim()) return searchTopics(topics, q, 30).filter((h) => h.score >= MIN_SCORE * 0.5).map((h) => h.topic as HelpTopic).filter(inPage);
    return topics.filter(inPage).toSorted((a, b) => a.title.localeCompare(b.title));
  }, [topics, q, page]);
  const topic = topics.find((t) => t.id === selected) ?? null;

  const takeMeThere = (t: HelpTopic) => {
    setOpen(false);
    if (t.link === path) highlight(t.highlight ?? "body");
    else {
      storePending({ highlight: t.highlight });
      router.push(t.link);
    }
  };

  return (
    <>
      {helpMode && (
        <div className="help-mode-banner" data-help="help-mode" role="status">
          <strong>Help mode</strong>: click any element to learn about it. Actions are paused.
          <button data-help="help-mode-off" type="button" onClick={() => setHelpMode(false)}>
            Turn off
          </button>
        </div>
      )}
      <dialog ref={dialog} className="help-center add-source" data-help="help-center" aria-labelledby="hc-title" onClose={() => setOpen(false)} onClick={(e) => e.target === dialog.current && setOpen(false)}>
        <div className="as-head">
          <h2 id="hc-title">Help center</h2>
          <button data-help="help-center-close" type="button" className="as-close" aria-label="Close" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>
        <p className="small muted">Every page, button and number explained. {topics.length > 0 ? `${topics.length} topics.` : loadFailed ? "The topics could not be loaded." : "Loading the topics…"} Press the ? menu, then Help mode, to point at anything.</p>
        <input data-help="help-center-search" type="search" className="hc-search" placeholder="Search the help (for example: zoom, extrapolation, add a source)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the help" />
        <div className="hc-pages" role="group" aria-label="Page">
          {PAGES.map((p) => (
            <button data-help="help-center-page" key={p.id} type="button" className="chip" aria-pressed={page === p.id} onClick={() => setPage(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="hc-body">
          <ul className="hc-list">
            {shown.map((t) => (
              <li key={t.id} className={t.id === selected ? "on" : undefined}>
                <button data-help="help-center-topic" type="button" onClick={() => setSelected(t.id)}>
                  {t.title}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="muted small">No topic matches. Ask TARS instead.</li>}
          </ul>
          <article className="hc-topic" aria-live="polite">
            {topic ? (
              <>
                <h3>{topic.title}</h3>
                {topic.body.split(/\n\n+/).map((para, i) => {
                  const m = /^(What it is|What it shows|How to use it|Example|What it does not do):\s*([\s\S]*)$/.exec(para);
                  return m ? (
                    <p key={i}>
                      <strong>{m[1]}.</strong> {m[2]}
                    </p>
                  ) : (
                    <p key={i}>{para}</p>
                  );
                })}
                <div className="tars-actions">
                  <button data-help="help-center-take-me-there" type="button" className="tars-btn" onClick={() => takeMeThere(topic)}>
                    Take me there
                  </button>
                  <button
                    data-help="help-center-open-manual"
                    type="button"
                    className="tars-btn"
                    onClick={() => {
                      setOpen(false);
                      router.push(`/help/${topic.chapter ?? "what-is-pyrion"}#${topic.id}`);
                    }}
                  >
                    Open in the manual
                  </button>
                  <button
                    data-help="help-center-ask-tars"
                    type="button"
                    className="tars-btn"
                    onClick={() => {
                      setOpen(false);
                      window.dispatchEvent(new CustomEvent("pyrion:tars", { detail: `Explain ${topic.title}` }));
                    }}
                  >
                    Ask TARS about this
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Pick a topic on the left, or search.</p>
            )}
          </article>
        </div>
      </dialog>
    </>
  );
}
