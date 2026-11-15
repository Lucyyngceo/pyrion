"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** The main sections, in order of importance. */
const MAIN = [
  { href: "/example", label: "Example", help: "nav-example" },
  { href: "/envelope", label: "Dashboard", help: "nav-envelope" },
  { href: "/planner", label: "Mission Planner", help: "nav-planner" },
  { href: "/example#ex-gaps", label: "Evidence gaps", help: "nav-gaps" },
  { href: "/investigations", label: "Investigations", help: "nav-investigations" },
  { href: "/tars", label: "Ask TARS", help: "nav-tars", ai: true },
];

/** Behind the "More" menu, in order of importance. */
const MORE = [
  { href: "/lenses", label: "Safety", help: "nav-lenses" },
  { href: "/more", label: "Earth & equipment", help: "nav-more-page" },
  { href: "/data", label: "Data", help: "nav-data" },
  { href: "/proof", label: "Proof", help: "nav-proof" },
  { href: "/method", label: "Method", help: "nav-method" },
  { href: "/bridge", label: "Bridge", help: "nav-bridge" },
  { href: "/help", label: "Help", help: "nav-help" },
  { href: "/why", label: "Why", help: "nav-why" },
];

export default function SiteNav() {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);
  const root = useRef<HTMLElement>(null);

  // Close everything on navigation, on Escape and on a click outside.
  useEffect(() => {
    setMenu(false);
    setMore(false);
  }, [path]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setMore(false);
      }
    };
    const out = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setMore(false);
    };
    window.addEventListener("keydown", esc);
    document.addEventListener("click", out);
    return () => {
      window.removeEventListener("keydown", esc);
      document.removeEventListener("click", out);
    };
  }, []);

  const moreActive = MORE.some((l) => path === l.href || path.startsWith(`${l.href}/`));
  // The home page has its own top bar (sections + Explore the evidence).
  if (path === "/") return null;
  return (
    <nav ref={root} className={`sitenav${menu ? " nav-open" : ""}`} aria-label="Sections">
      <div className="sitenav-inner">
        <Link data-help="nav-brand" href="/" className="sitenav-brand">
          <svg className="mark" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <rect width="26" height="26" rx="7" className="mark-bg" />
            <path d="M5 16 L9 7 L17 5 L21 12 L17 20 L8 21 Z" className="mark-hull" />
            <circle cx="13" cy="13" r="4.2" className="mark-ring" />
            <circle cx="13" cy="13" r="1.4" className="mark-dot" />
          </svg>
          <span className="sitenav-name">PYRION <span className="omega">Ω</span></span>
        </Link>
        <button data-help="nav-menu" type="button" className="nav-burger" aria-expanded={menu} aria-controls="sitenav-links" aria-label="Menu" onClick={() => setMenu((m) => !m)}>
          <span aria-hidden="true">{menu ? "✕" : "☰"}</span>
        </button>
        <div id="sitenav-links" className="sitenav-links">
          <ul>
            {MAIN.map((l) => (
              <li key={l.href}>
                <Link data-help={l.help} href={l.href} className={l.ai ? "nav-ai" : undefined} aria-current={path === l.href ? "page" : undefined}>
                  {l.ai && <span aria-hidden="true">✦ </span>}
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="nav-more">
              <button data-help="nav-more" type="button" className={`nav-more-btn${moreActive ? " is-current" : ""}`} aria-expanded={more} aria-haspopup="true" onClick={() => setMore((m) => !m)}>
                More <span aria-hidden="true">▾</span>
              </button>
              <ul className={`nav-more-list${more ? " is-open" : ""}`}>
                {MORE.map((l) => (
                  <li key={l.href}>
                    <Link data-help={l.help} href={l.href} aria-current={path === l.href ? "page" : undefined}>
                      {l.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <a data-help="nav-code" href="https://github.com/Lucyyngceo/pyrion" target="_blank" rel="noreferrer">
                    Code
                  </a>
                </li>
              </ul>
            </li>
          </ul>
        </div>
        <span className="sitenav-sub">NASA Space Apps 2026 · Flame in Freefall</span>
      </div>
    </nav>
  );
}
