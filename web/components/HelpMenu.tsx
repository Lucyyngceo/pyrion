"use client";

import { useEffect, useRef, useState } from "react";

/** The "?" at the top right: Help (TARS Support) and Guide (the tour, beta). */
export default function HelpMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="help-menu" ref={box}>
      <button type="button" className="help-btn" aria-label="Help and guide" aria-expanded={open} aria-haspopup="menu" title="Help and guide" onClick={() => setOpen((o) => !o)}>
        ?
      </button>
      {open && (
        <div className="help-pop" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent("pyrion:tars", { detail: "what is this" }));
            }}
          >
            Help <span className="muted small">TARS Support: how this site works</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new Event("pyrion:tour"));
            }}
          >
            Guide <span className="muted small">a 3-step tour (beta)</span>
          </button>
        </div>
      )}
    </div>
  );
}
