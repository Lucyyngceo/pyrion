"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import TarsChat from "./TarsChat";
import { useTars } from "./TarsProvider";

/** The floating TARS button (bottom right, on every page) and its chat panel. Esc closes it. */
export default function TarsBubble() {
  const { open, setOpen } = useTars();
  const path = usePathname();
  const btn = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    // Closing returns focus to the bubble, so the keyboard user is not lost.
    if (wasOpen.current && !open) btn.current?.focus();
    wasOpen.current = open;
  }, [open]);
  if (path === "/tars") return null;
  return (
    <>
      <button data-help="tars-bubble" ref={btn} type="button" className="tars-bubble" aria-expanded={open} aria-controls="tars-panel" onClick={() => setOpen(!open)} title="TARS: Traceable Applicability Reasoning System">
        <span aria-hidden="true">T</span>
        <span className="tars-bubble-name">TARS</span>
      </button>
      {open && (
        <section data-help="tars-panel" id="tars-panel" className="tars-panel" role="dialog" aria-label="TARS chat">
          <header className="tars-head">
            <div>
              <strong>TARS</strong> <span className="muted small">Traceable Applicability Reasoning System</span>
            </div>
            <button data-help="tars-close" type="button" className="tars-x" aria-label="Close TARS" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <TarsChat autoFocus />
        </section>
      )}
    </>
  );
}
