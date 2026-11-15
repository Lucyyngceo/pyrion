"use client";

/** A small "Ask TARS about this" button: opens TARS with a question that carries the context of the thing it sits on. */
export default function AskTars({ q, label = "Ask TARS about this" }: { q: string; label?: string }) {
  return (
    <button
      data-help="ask-tars-here"
      type="button"
      className="ask-tars-btn"
      title="Ask TARS SI about this, with its context"
      onClick={(e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent("pyrion:tars", { detail: q }));
      }}
    >
      <span aria-hidden="true">✦ </span>
      {label}
    </button>
  );
}
