"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PRESET_VIEWS } from "@/lib/presets";

interface Cmd {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** Ctrl+K (or "/") opens a command palette: presets, pages, sections. Keyboard only, no network. */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const path = usePathname();

  const cmds = useMemo<Cmd[]>(() => {
    const go = (href: string) => () => router.push(href);
    const preset = (id: string) => () => {
      if (path === "/") window.dispatchEvent(new CustomEvent("pyrion:preset", { detail: id }));
      else router.push(`/?preset=${id}`);
    };
    const scroll = (id: string) => () => {
      if (path !== "/") router.push(`/#${id}`);
      else document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    return [
      ...PRESET_VIEWS.map((v) => ({ id: `p-${v.preset.id}`, group: "Target preset", label: v.short, hint: v.summary, run: preset(v.preset.id) })),
      { id: "s-env", group: "Section", label: "Evidence envelope", run: scroll("envelope-h") },
      { id: "s-res", group: "Section", label: "Verdicts, one row per investigation", run: scroll("results-h") },
      { id: "s-tvp", group: "Section", label: "Text similarity vs condition similarity", run: scroll("tvp-h") },
      { id: "g-landing", group: "Page", label: "Home: what PYRION is", hint: "/", run: go("/") },
      { id: "g-home", group: "Page", label: "Dashboard", hint: "/envelope", run: go("/envelope") },
      { id: "g-lenses", group: "Page", label: "Safety lenses: prevention, detection, suppression", hint: "/lenses", run: go("/lenses") },
      { id: "g-more", group: "Page", label: "Fire-safety equipment & Earth", hint: "/more", run: go("/more") },
      { id: "g-planner", group: "Page", label: "Mission Planner: the Moon Base band", hint: "/planner", run: go("/planner") },
      { id: "g-inv", group: "Page", label: "Investigations: the 24 PSI studies", hint: "/investigations", run: go("/investigations") },
      { id: "g-bridge", group: "Page", label: "Bridge: transfer hypothesis (not evidence)", hint: "/bridge", run: go("/bridge") },
      { id: "g-method", group: "Page", label: "Method: how PYRION decides", hint: "/method", run: go("/method") },
      { id: "g-why", group: "Page", label: "Why this exists: a note from the author", hint: "/why", run: go("/why") },
      { id: "g-data", group: "Page", label: "Data: lineage and coverage", hint: "/data", run: go("/data") },
    ];
  }, [router, path]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? cmds.filter((c) => `${c.group} ${c.label} ${c.hint ?? ""}`.toLowerCase().includes(t)) : cmds;
  }, [cmds, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest("input, select, textarea, [contenteditable]");
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
        setQ("");
        setI(0);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  if (!open)
    return (
      <button data-help="command-palette-button" type="button" className="cmdk-hint" onClick={() => setOpen(true)} aria-label="Open command palette">
        <kbd>Ctrl</kbd>
        <kbd>K</kbd>
      </button>
    );

  const run = (c: Cmd | undefined) => {
    if (!c) return;
    setOpen(false);
    c.run();
  };

  return (
    <div className="cmdk-scrim" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cmdk-input">
          <span aria-hidden="true">&gt;</span>
          <input data-help="command-palette-input"
            ref={input}
            value={q}
            placeholder="Jump to a preset, section or page…"
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setI((x) => Math.min(list.length - 1, x + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setI((x) => Math.max(0, x - 1));
              } else if (e.key === "Enter") run(list[i]);
            }}
            aria-label="Search commands"
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="cmdk-list" role="listbox">
          {list.map((c, k) => (
            <li data-help="command-palette-item"
              key={c.id}
              role="option"
              aria-selected={k === i}
              className={k === i ? "on" : undefined}
              onPointerEnter={() => setI(k)}
              onClick={() => run(c)}
            >
              <span className="cmdk-group">{c.group}</span>
              <span className="cmdk-label">{c.label}</span>
              {c.hint && <span className="cmdk-hint-text">{c.hint}</span>}
            </li>
          ))}
          {list.length === 0 && <li className="cmdk-empty">No match</li>}
        </ul>
      </div>
    </div>
  );
}
