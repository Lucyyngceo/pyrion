// How TARS talks to the rest of the app: the current condition, "Show on the envelope", opening a receipt, and highlighting a control.
// Browser only. No imports: the pieces are plain events and one sessionStorage key.

export interface Pending {
  /** A target to load into the dashboard (the engine's Target shape). */
  target?: unknown;
  /** An investigation whose receipt card should open. */
  open?: string;
  /** A control to highlight on arrival. */
  highlight?: string;
}

const KEY = "pyrion.tars.pending";
let current: unknown = null;

/** The Envelope page tells TARS which condition the controls hold now. */
export const setCurrentTarget = (t: unknown) => {
  current = t;
};
export const getCurrentTarget = () => current;

export const storePending = (p: Pending) => {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: the navigation still happens, the extra step is lost */
  }
};
export const takePending = (): Pending | null => {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as Pending;
  } catch {
    return null;
  }
};

/** Highlight a control for a moment and bring it into view. Waits for it to exist (the page may still be loading). */
export function highlight(selector: string, tries = 40) {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) {
    if (tries > 0) window.setTimeout(() => highlight(selector, tries - 1), 150);
    return;
  }
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.remove("tars-highlight");
  void el.offsetWidth;
  el.classList.add("tars-highlight");
  window.setTimeout(() => el.classList.remove("tars-highlight"), 3200);
}

/** Deliver what is pending to the page that is showing now (the Envelope page listens for these events). */
export function deliver(p: Pending) {
  const ready = (tries: number) => {
    const needsHome = !!(p.target || p.open);
    if (!needsHome || document.querySelector(".scenario-strip") || tries <= 0) {
      if (p.target) window.dispatchEvent(new CustomEvent("pyrion:target", { detail: p.target }));
      if (p.open) window.dispatchEvent(new CustomEvent("pyrion:open", { detail: p.open }));
      if (p.highlight) highlight(p.highlight);
    } else window.setTimeout(() => ready(tries - 1), 150);
  };
  ready(40);
}
