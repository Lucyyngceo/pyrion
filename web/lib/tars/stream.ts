// Client-side handling of the /api/tars/chat stream (newline-delimited JSON).
// The primary answer and the second opinion are separate phases: the conversation is released as soon as the
// primary answer ("result") is in, and the review status is tracked on its own, so a visitor can keep asking
// while the second opinion is pending. Pure functions, no React, so they can be tested.

export type ReviewStatus = "none" | "pending" | "done" | "unavailable";

export interface StreamHandlers<R, S> {
  /** A progress line before the answer ("Checking the engine…"). Not called after the primary answer. */
  onStatus?: (text: string | null) => void;
  onError?: (error: string) => void;
  /** The checked primary answer. The conversation may continue from here on. */
  onResult: (result: R) => void;
  /** Review status of the answer: pending when the server starts the second opinion, done/unavailable at the end. */
  onReview?: (status: ReviewStatus, skeptic?: S) => void;
}

/** Feed it lines of the stream; it calls the handlers in order. `end()` closes a review that never arrived. */
export function createTarsStream<R, S>(h: StreamHandlers<R, S>) {
  let primaryDone = false;
  let review: ReviewStatus = "none";
  const setReview = (s: ReviewStatus, sk?: S) => {
    review = s;
    h.onReview?.(s, sk);
  };
  return {
    get primaryDone() {
      return primaryDone;
    },
    get review() {
      return review;
    },
    push(line: string) {
      const t = line.trim();
      if (!t) return;
      let ev: { type?: string; text?: string; error?: string; skeptic?: S } & Record<string, unknown>;
      try {
        ev = JSON.parse(t);
      } catch {
        return; // a malformed line is ignored, never shown
      }
      if (ev.type === "status") {
        if (!primaryDone) h.onStatus?.(ev.text ?? null);
        // The server announces the second opinion with a status line after the answer.
        else if (review === "none") setReview("pending");
      } else if (ev.type === "error") {
        h.onError?.(ev.error ?? "TARS could not answer.");
      } else if (ev.type === "result") {
        primaryDone = true;
        h.onResult(ev as unknown as R);
      } else if (ev.type === "skeptic" && primaryDone) {
        const sk = ev.skeptic as S & { verdict?: string };
        setReview(sk && sk.verdict === "unavailable" ? "unavailable" : "done", sk);
      }
    },
    /** The stream closed. A review announced but never delivered is reported as unavailable, not as agreeing. */
    end() {
      if (review === "pending") setReview("unavailable");
    },
  };
}

/** Splits a growing text buffer into complete lines; returns the lines and the unfinished rest. */
export function splitLines(buf: string): { lines: string[]; rest: string } {
  const parts = buf.split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts, rest };
}

/** Busy flag shared by overlapping requests: only the latest request may clear it. */
export function createBusyGate(setBusy: (b: boolean) => void) {
  let seq = 0;
  let released = 0;
  return {
    begin(): number {
      seq += 1;
      setBusy(true);
      return seq;
    },
    /** Release for this request; ignored if a newer request has started since. */
    release(token: number): boolean {
      // Only the latest request, and only once (the answer and the end of the stream both release).
      if (token !== seq || released === token) return false;
      released = token;
      setBusy(false);
      return true;
    },
    get current() {
      return seq;
    },
  };
}
