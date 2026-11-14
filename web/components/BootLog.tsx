"use client";

import { useEffect, useState } from "react";

/** One-line HUD boot log: the real load steps, typed once (~900 ms total), never blocking the page.
 *  Under prefers-reduced-motion every step shows at once. */
export default function BootLog({ steps }: { steps: string[] }) {
  const [n, setN] = useState(steps.length);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setN(0);
    const timers = steps.map((_, i) => window.setTimeout(() => setN(i + 1), 120 + i * 180));
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  return (
    <div className="bootlog" aria-label={steps.join(", ")}>
      <span className="boot-prompt" aria-hidden="true">
        &gt;
      </span>
      {steps.map((s, i) => (
        <span key={s} className={`boot-step${i < n ? " on" : ""}`} aria-hidden="true">
          {s}
          <span className="boot-ok">OK</span>
        </span>
      ))}
      <span className={`boot-cursor${n >= steps.length ? " done" : ""}`} aria-hidden="true" />
    </div>
  );
}
