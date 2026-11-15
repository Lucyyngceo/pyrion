"use client";

import { useEffect, useState } from "react";

/**
 * The loading screen shown the first time the dashboard opens in a browser session: NASA images flying out of the centre
 * with "Making Life Multiplanetary". It is drawn live with CSS (transform + opacity, GPU-composited), not a video file:
 * ~0.1 MB of small images, no decoding, no autoplay rules, smooth on any phone, sharp at any size and orientation.
 * It starts once the images are decoded (at most READY_TIMEOUT_MS, then it uses whatever loaded). Reduced motion: the phrase
 * only, briefly. Click or Esc skips it. Credits: public/media/warp/CREDITS.json.
 */

const THUMBS = [
  "200623_iss_1", "201002060005hq", "41g-102-047", "624073main_1969-04-04_full", "7012482", "9902615", "art002e009566",
  "art002e009567", "as17-149-22857", "as17-152-23272", "as17-152-23311", "ed06-0045-1", "jsc2007e034221",
  "ksc-20200402-ph-jpl01_0002", "ksc-20200402-ph-jpl01_0003", "ksc-20220915-ph-jnp01_0002", "ksc-20220915-ph-jnp01_0003",
  "ksc-20240819-ph-jbs01_0009", "maf_19671005-hassembly", "maf_19671005_viewtowest", "pia01249", "pia05445", "pia10569",
  "pia10739", "pia12110", "sts050-232-011",
].map((n) => `/media/warp/thumbs/${n}.webp`);

const SEEN = "pyrion.warp.seen";
const READY_TIMEOUT_MS = 1500;
const DURATION_MS = 3000;
const WAVES = 2;

/** Deterministic pseudo-random in [0, 1) so the layout is the same on every visit. */
const rand = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const SPRITES = Array.from({ length: THUMBS.length * WAVES }, (_, i) => {
  const ang = rand(i) * Math.PI * 2;
  const dist = 62 + rand(i + 100) * 22; // vmax
  return {
    src: THUMBS[i % THUMBS.length],
    dx: `${(Math.cos(ang) * dist).toFixed(1)}vmax`,
    dy: `${(Math.sin(ang) * dist * 0.7).toFixed(1)}vmax`,
    delay: `${(Math.floor(i / THUMBS.length) * 0.75 + rand(i + 200) * 0.9).toFixed(2)}s`,
    rot: `${((rand(i + 300) - 0.5) * 16).toFixed(1)}deg`,
  };
});

type Phase = "off" | "loading" | "playing" | "text";

export default function WarpIntro() {
  const [phase, setPhase] = useState<Phase>("off");

  useEffect(() => {
    // ?intro in the URL replays it (handy for demos and recordings).
    const force = new URLSearchParams(window.location.search).has("intro");
    try {
      if (!force && window.sessionStorage.getItem(SEEN) === "1") return;
      window.sessionStorage.setItem(SEEN, "1");
    } catch {
      /* storage blocked: show it, harmless */
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("text");
      const t = window.setTimeout(() => setPhase("off"), 700);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    setPhase("loading");
    const decoded = Promise.all(
      THUMBS.map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => undefined);
      }),
    );
    const timeout = new Promise((r) => window.setTimeout(r, READY_TIMEOUT_MS));
    Promise.race([decoded, timeout]).then(() => {
      if (!cancelled) setPhase("playing");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const done = window.setTimeout(() => setPhase("off"), DURATION_MS);
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase("off");
    };
    window.addEventListener("keydown", esc);
    return () => {
      clearTimeout(done);
      window.removeEventListener("keydown", esc);
    };
  }, [phase]);

  if (phase === "off" || phase === "loading") return null;
  return (
    <div data-help="landing-warp" className="warp warp-live" role="status" aria-live="polite" onClick={() => setPhase("off")}>
      {phase === "playing" && (
        <div className="warp-field" aria-hidden="true">
          {SPRITES.map((s, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={s.src}
              alt=""
              className="warp-sprite"
              style={{ ["--dx" as string]: s.dx, ["--dy" as string]: s.dy, ["--delay" as string]: s.delay, ["--rot" as string]: s.rot }}
            />
          ))}
        </div>
      )}
      <p className="warp-text warp-phrase">
        Making Life Multiplanetary
        <span className="warp-sub">PYRION Ω · images: NASA</span>
      </p>
    </div>
  );
}
