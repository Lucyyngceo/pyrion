"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { readByCode, type ParsedTarget } from "@/lib/ask-core";
import { deliver, getCurrentTarget, storePending, takePending, type Pending } from "@/lib/tars/bridge";
import type { AnswerPair, Mode } from "@/lib/tars/answer";
import { routeMessage, type Route } from "@/lib/tars/route";

export interface HelpAnswer {
  topic?: { id: string; title: string; body: string; link: string; highlight: string | null };
  others?: { id: string; title: string }[];
  none?: boolean;
  topics?: { id: string; title: string }[];
}

export type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "tars"; kind: "error" | "note"; text: string }
  | { id: number; role: "tars"; kind: "help"; route: Route; help: HelpAnswer }
  | { id: number; role: "tars"; kind: "answer"; route: Route; answer: AnswerPair; question: string }
  | { id: number; role: "tars"; kind: "experiments"; route: Route; experiments: unknown; fingerprint: string };

type NewMsg = { role: "user"; text: string } | { role: "tars"; kind: "error" | "note"; text: string } | { role: "tars"; kind: "help"; route: Route; help: HelpAnswer } | { role: "tars"; kind: "answer"; route: Route; answer: AnswerPair; question: string } | { role: "tars"; kind: "experiments"; route: Route; experiments: unknown; fingerprint: string };

interface Ctx {
  open: boolean;
  setOpen: (o: boolean) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  messages: Msg[];
  busy: boolean;
  send: (text: string) => Promise<void>;
  skill: (name: "map" | "close-gap") => Promise<void>;
  /** Navigate to a page and highlight a control (Take me there). */
  go: (link: string, highlight?: string | null) => void;
  /** Load a target into the dashboard ("Show on the envelope"), or open a receipt. */
  showOnEnvelope: (p: Pending) => void;
}

const TarsContext = createContext<Ctx | null>(null);
export const useTars = () => {
  const c = useContext(TarsContext);
  if (!c) throw new Error("useTars outside TarsProvider");
  return c;
};

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as T & { error?: string } };
}

export default function TarsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setModeState] = useState<Mode>("advanced");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const id = useRef(0);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    try {
      const m = window.localStorage.getItem("pyrion.tars.mode");
      if (m === "easy" || m === "advanced" || m === "auto") setModeState(m);
    } catch {
      /* the default stays */
    }
  }, []);
  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    try {
      window.localStorage.setItem("pyrion.tars.mode", m);
    } catch {
      /* not remembered */
    }
  }, []);

  // Arrived somewhere because TARS sent us: do what was pending (load a target, open a receipt, highlight a control).
  useEffect(() => {
    const p = takePending();
    if (p) deliver(p);
  }, [path]);

  const add = useCallback((m: NewMsg) => setMessages((all) => [...all, { ...m, id: ++id.current } as Msg]), []);

  const go = useCallback(
    (link: string, highlight?: string | null) => {
      const p: Pending = highlight ? { highlight } : {};
      if (link === path) deliver(p);
      else {
        storePending(p);
        router.push(link);
      }
    },
    [path, router],
  );
  const showOnEnvelope = useCallback(
    (p: Pending) => {
      if (path === "/") deliver(p);
      else {
        storePending(p);
        router.push("/");
      }
    },
    [path, router],
  );

  /** The condition in a message: the Ask step (content check, code first, model only if code cannot), or code alone when the server has no model. */
  const readCondition = useCallback(async (text: string): Promise<{ parsed: ParsedTarget; readBy: string } | { error: string }> => {
    const r = await postJson<{ parsed: ParsedTarget; meta?: { read_by?: string; model?: string | null } }>("/api/ask", { step: "parse", question: text });
    if (r.ok) return { parsed: r.data.parsed, readBy: r.data.meta?.read_by === "code" || !r.data.meta?.model ? "Read by code" : `Read by ${r.data.meta.model}` };
    // No model configured on this server: code alone can still read a question whose numbers are all clear.
    if (r.status === 503) {
      const c = readByCode(text);
      if (c.kind === "code") return { parsed: c.parsed, readBy: "Read by code" };
      if (c.kind === "issue") return { error: c.message };
      return { error: "Plain-language questions need the language model, which is off on this server. Give the oxygen as a percentage, the pressure with its unit (psia or kPa) and the gravity, and TARS reads them by code." };
    }
    return { error: r.data.error ?? `The request failed (HTTP ${r.status}).` };
  }, []);

  const answerFor = useCallback(
    async (target: unknown, readBy: string, question: string, route: Route) => {
      const r = await postJson<{ answer: AnswerPair }>("/api/tars", { kind: "answer", target, readBy });
      if (!r.ok) return add({ role: "tars", kind: "error", text: r.data.error ?? "TARS could not build the answer." });
      add({ role: "tars", kind: "answer", route, answer: r.data.answer, question });
    },
    [add],
  );

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || busy) return;
      add({ role: "user", text: t });
      setBusy(true);
      try {
        const route = routeMessage(t);
        if (route === "condition") {
          const c = await readCondition(t);
          if ("error" in c) add({ role: "tars", kind: "error", text: c.error });
          else await answerFor(c.parsed.target, c.readBy, t, route);
        } else {
          const r = await postJson<HelpAnswer>("/api/tars", { kind: "help", message: t });
          if (!r.ok) add({ role: "tars", kind: "error", text: r.data.error ?? "TARS Support could not answer." });
          else add({ role: "tars", kind: "help", route, help: r.data });
        }
      } catch {
        add({ role: "tars", kind: "error", text: "TARS could not reach the server. Try again in a moment." });
      } finally {
        setBusy(false);
      }
    },
    [add, answerFor, busy, readCondition],
  );

  const skill = useCallback(
    async (name: "map" | "close-gap") => {
      if (busy) return;
      const target = getCurrentTarget();
      if (!target) {
        add({ role: "tars", kind: "note", text: "Tell me a condition first (for example “34 % oxygen at 8.2 psia in lunar gravity”), or open the Envelope page and pick a scenario: I use the condition shown there." });
        return;
      }
      setBusy(true);
      try {
        if (name === "map") {
          add({ role: "user", text: "Map the unknown (current condition)" });
          await answerFor(target, "Current condition from the Envelope page", "Map the unknown", "condition");
        } else {
          add({ role: "user", text: "What would close this gap (current condition)" });
          const r = await postJson<{ experiments: unknown; fingerprint: string }>("/api/tars", { kind: "experiments", target });
          if (!r.ok) add({ role: "tars", kind: "error", text: r.data.error ?? "TARS could not build the plan." });
          else add({ role: "tars", kind: "experiments", route: "condition", experiments: r.data.experiments, fingerprint: r.data.fingerprint });
        }
      } finally {
        setBusy(false);
      }
    },
    [add, answerFor, busy],
  );

  // Esc closes the bubble panel.
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open]);

  // Other parts of the app can ask TARS to open on a question (the "?" menu: Help).
  useEffect(() => {
    const on = (e: Event) => {
      setOpen(true);
      const q = (e as CustomEvent<string | undefined>).detail;
      if (q) void send(q);
    };
    window.addEventListener("pyrion:tars", on);
    return () => window.removeEventListener("pyrion:tars", on);
  }, [send]);

  const value = useMemo<Ctx>(() => ({ open, setOpen, mode, setMode, messages, busy, send, skill, go, showOnEnvelope }), [open, mode, setMode, messages, busy, send, skill, go, showOnEnvelope]);
  return <TarsContext.Provider value={value}>{children}</TarsContext.Provider>;
}
