"use client";

import { useEffect, useState } from "react";

const WEBM = "/media/warp/warp.webm";
const MP4 = "/media/warp/warp.mp4";
const DURATION_MS = 3000;
const SEEN = "pyrion.warp.seen";

/**
 * The loading screen shown the first time the dashboard opens in a browser session: a short video of NASA images flying past with
 * "Making Life Multiplanetary". Continuous motion, no full-screen flashes. With reduced motion, the phrase only, briefly.
 * Click or Esc skips it. The dashboard keeps loading underneath.
 */
export default function WarpIntro() {
  const [on, setOn] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    // Once per browser session: not again when moving around inside the site.
    try {
      if (window.sessionStorage.getItem(SEEN) === "1") return;
      window.sessionStorage.setItem(SEEN, "1");
    } catch {
      /* storage blocked: show it, harmless */
    }
    setOn(true);
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduce(r);
    const t = window.setTimeout(() => setOn(false), r ? 700 : DURATION_MS);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOn(false);
    };
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  if (!on) return null;
  return (
    <div data-help="landing-warp" className="warp" role="status" aria-live="polite" onClick={() => setOn(false)}>
      {!reduce && (
        <video className="warp-video" autoPlay muted playsInline preload="auto" aria-hidden="true" onEnded={() => setOn(false)}>
          <source src={WEBM} type="video/webm" />
          <source src={MP4} type="video/mp4" />
        </video>
      )}
      <p className={reduce ? "warp-text" : "sr-only"}>Making Life Multiplanetary</p>
    </div>
  );
}
