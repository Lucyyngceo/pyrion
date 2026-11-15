"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const KEY = "pyrion.tour.v1";
const STEPS = [
  { sel: ".nav-presets", title: "1 · Pick a NASA condition", text: "Start from a condition NASA has written down: the ISS cabin, a lunar base, or an exploration atmosphere. Each one cites its source." },
  { sel: ".nav-center", title: "2 · See where the evidence is", text: "The bright area is where NASA investigations apply. The right column says which ones, and what would bring your condition closer to them." },
  { sel: ".take-btn", fallback: ".nav-evidence", title: "3 · Take me there", text: "One click moves your condition to the nearest place the evidence covers. A different regime is never a small step: that button says so." },
] as const;

const seen = () => {
  try {
    return window.localStorage.getItem(KEY) === "done";
  } catch {
    return false;
  }
};
const remember = () => {
  try {
    window.localStorage.setItem(KEY, "done");
  } catch {
    /* private mode: the tour may show again, which is harmless */
  }
};

/** First-visit tour with three coach marks. Skippable (Esc or Skip), remembered, and restartable from "Take the tour". */
export default function Tour() {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    remember();
    setStep(null);
  }, []);

  // First visit: wait for the page to settle so the routes exist.
  useEffect(() => {
    if (seen()) return;
    const t = window.setTimeout(() => setStep(0), 1800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const on = () => setStep(0);
    window.addEventListener("pyrion:tour", on);
    return () => window.removeEventListener("pyrion:tour", on);
  }, []);

  // Follow the target element (scroll, resize, and the page changing under it).
  useEffect(() => {
    if (step === null) return;
    const s = STEPS[step];
    const el = (document.querySelector(s.sel) ?? ("fallback" in s ? document.querySelector(s.fallback) : null)) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    let raf = 0;
    const update = () => {
      setRect(el.getBoundingClientRect());
      raf = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    if (step === null) return;
    card.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [step, close]);

  if (step === null) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const vw = typeof window === "undefined" ? 1200 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const narrow = vw < 700;
  const W = Math.min(340, vw - 24);
  const style: React.CSSProperties = narrow || !rect
    ? { left: 12, right: 12, bottom: 12, width: "auto" }
    : {
        width: W,
        left: Math.min(Math.max(12, rect.left + rect.width / 2 - W / 2), vw - W - 12),
        top: rect.bottom + 14 + 190 < vh ? rect.bottom + 14 : Math.max(12, rect.top - 14 - 190),
      };

  return (
    <>
      {rect && <div className="tour-ring" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} aria-hidden="true" />}
      <div ref={card} className="tour-card" role="dialog" aria-label="Guided tour" tabIndex={-1} style={style}>
        <p className="tour-step">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2>{s.title}</h2>
        <p>{s.text}</p>
        <div className="tour-actions">
          <button type="button" className="linklike" onClick={close}>
            Skip
          </button>
          {step > 0 && (
            <button type="button" className="tour-btn tour-back" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button type="button" className="tour-btn" onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? "Done" : "Next"}
          </button>
        </div>
        <p className="tour-hint">Esc skips. The tour does not show again.</p>
      </div>
    </>
  );
}
