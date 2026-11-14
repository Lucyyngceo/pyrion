"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Envelope" },
  { href: "/method", label: "Method" },
  { href: "/data", label: "Data" },
];

export default function SiteNav() {
  const path = usePathname();
  return (
    <nav className="sitenav" aria-label="Sections">
      <div className="sitenav-inner">
        <Link href="/" className="sitenav-brand">
          <span className="logo" aria-hidden="true">
            Ω
          </span>
          <span className="sitenav-name">PYRION</span>
        </Link>
        <ul>
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={path === l.href ? "page" : undefined}>
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <a href="https://github.com/Lucyyngceo/pyrion" target="_blank" rel="noreferrer">
              Code
            </a>
          </li>
        </ul>
        <span className="sitenav-sub">NASA Space Apps 2026 · Flame in Freefall</span>
      </div>
    </nav>
  );
}
