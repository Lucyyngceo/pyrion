"use client";

import { useEffect, useState } from "react";

const EXAMPLES = [
  "Would solid fuel burn differently in a lunar base at 30% oxygen and 10.2 psi?",
  "What does PSI say about a flame in microgravity at normal air pressure with 21% oxygen?",
  "Which experiments cover a 34% oxygen cabin at 8.2 psia?",
];

/** The one question bar of the home page: it opens TARS SI with the question already sent. TARS reads the condition by code and the engine decides. */
export default function AskTarsBar() {
  const [q, setQ] = useState("");
  const [ex, setEx] = useState(0);
  // Rotating example placeholders: they stop while the visitor types.
  useEffect(() => {
    if (q) return;
    const t = window.setInterval(() => setEx((i) => (i + 1) % EXAMPLES.length), 4500);
    return () => window.clearInterval(t);
  }, [q]);
  const submit = () => {
    const question = q.trim();
    if (!question) return;
    window.dispatchEvent(new CustomEvent("pyrion:tars", { detail: question }));
    setQ("");
  };
  return (
    <section data-help="ask-box" className="card ask" aria-labelledby="ask-h">
      <h2 id="ask-h" className="sr-only">
        Ask TARS SI
      </h2>
      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="ask-q">
          Ask TARS SI anything
        </label>
        <input data-help="ask-input" id="ask-q" type="text" maxLength={300} value={q} placeholder={`Ask TARS SI anything… ${EXAMPLES[ex]}`} onChange={(e) => setQ(e.target.value)} title="TARS SI answers in three labelled layers. The engine decides every verdict; the language model never does." />
        <button data-help="ask-submit" type="submit" disabled={!q.trim()}>
          Ask
        </button>
      </form>
    </section>
  );
}
