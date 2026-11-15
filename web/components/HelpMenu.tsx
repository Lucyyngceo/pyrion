"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** The "?" at the top right: Help (TARS Support) and Guide (the tour, beta). */
export default function HelpMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
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
      <button data-help="help-menu" type="button" className="help-btn" aria-label="Help and guide" aria-expanded={open} aria-haspopup="menu" title="Help and guide" onClick={() => setOpen((o) => !o)}>
        ?
      </button>
      {open && (
        <div className="help-pop" role="menu">
          <button data-help="help-menu-help"
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push("/help");
            }}
          >
            Help <span className="muted small">the manual: every page, button and number</span>
          </button>
          <button
            data-help="help-menu-mode"
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent("pyrion:help-mode", { detail: true }));
            }}
          >
            Help mode <span className="muted small">click anything to learn about it</span>
          </button>
          <button data-help="help-menu-guide"
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
