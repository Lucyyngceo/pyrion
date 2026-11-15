"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Envelope", help: "nav-envelope" },
  { href: "/tars", label: "TARS SI", help: "nav-tars", ai: true },
  { href: "/bridge", label: "Bridge", help: "nav-bridge" },
  { href: "/method", label: "Method", help: "nav-method" },
  { href: "/data", label: "Data", help: "nav-data" },
  { href: "/why", label: "Why", help: "nav-why" },
];

export default function SiteNav() {
  const path = usePathname();
  return (
    <nav className="sitenav" aria-label="Sections">
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
        <ul>
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link data-help={l.help} href={l.href} className={l.ai ? "nav-ai" : undefined} aria-current={path === l.href ? "page" : undefined}>
                {l.ai && <span aria-hidden="true">✦ </span>}
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
        <span className="sitenav-sub">NASA Space Apps 2026 · Flame in Freefall</span>
      </div>
    </nav>
  );
}
