"use client";

import { useId } from "react";
import { GLOSSARY } from "@/lib/plain";

/** A word with a one-sentence meaning on hover or keyboard focus. The text stays in the page, so it is readable without the tooltip. */
export default function Term({ k, children }: { k: keyof typeof GLOSSARY; children?: React.ReactNode }) {
  const id = useId();
  return (
    <span className="term" tabIndex={0} aria-describedby={id}>
      {children ?? k}
      <span role="tooltip" id={id} className="term-tip">
        {GLOSSARY[k]}
      </span>
    </span>
  );
}
