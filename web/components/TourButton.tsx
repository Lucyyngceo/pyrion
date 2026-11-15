"use client";

/** A small "?" at the top right of the page. It starts the tour; TARS Support will live here later. */
export default function TourButton() {
  return (
    <button type="button" className="help-btn" aria-label="Take the 3-step tour" title="Take the 3-step tour" onClick={() => window.dispatchEvent(new Event("pyrion:tour"))}>
      ?
    </button>
  );
}
