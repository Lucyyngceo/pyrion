"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** The main sections, in order. Everything else (Bridge, Method, Data, Proof, Help, Lenses, More, Why) is linked from the home page and the footer. */
const MAIN = [
  { href: "/", label: "Home", help: "nav-home" },
  { href: "/envelope", label: "Envelope", help: "nav-envelope" },
  { href: "/planner", label: "Mission Planner", help: "nav-planner" },
  { href: "/investigations", label: "Investigations", help: "nav-investigations" },
  { href: "/tars", label: "TARS SI", help: "nav-tars", ai: true },
];

export default function SiteNav() {
  const path = usePathname();
  const [menu, setMenu] = useState(false);

  // Close the mobile menu on navigation and on Escape.
  useEffect(() => {
    setMenu(false);
  }, [path]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const current = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
  return (
    <nav className={`sitenav${menu ? " nav-open" : ""}`} aria-label="Sections">
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
                <Link data-help={l.help} href={l.href} className={l.ai ? "nav-ai" : undefined} aria-current={current(l.href) ? "page" : undefined}>
                  {l.ai && <span aria-hidden="true">✦ </span>}
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <span className="sitenav-sub">NASA Space Apps 2026 · Flame in Freefall</span>
      </div>
    </nav>
  );
}
