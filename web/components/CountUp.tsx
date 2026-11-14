"use client";

import { useEffect, useRef, useState } from "react";

/** Counts up to `value` once it scrolls into view (<= 600 ms, expo ease-out). Shows the final value
 *  immediately under prefers-reduced-motion and on the server, so the number is never wrong in a capture. */
export default function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const D = 600;
        const tick = (t: number) => {
          const k = Math.min(1, (t - t0) / D);
          const eased = k === 1 ? 1 : 1 - 2 ** (-10 * k);
          setShown(Math.round(value * eased));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        setShown(0);
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <span ref={ref} className="countup">
      {shown.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}
