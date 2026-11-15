"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { readByCode, type ParsedTarget } from "@/lib/ask-core";
import { deliver, getCurrentTarget, storePending, takePending, type Pending } from "@/lib/tars/bridge";
import { resolveMode, type AnswerPair, type Mode } from "@/lib/tars/answer";
import { routeMessage, type Route } from "@/lib/tars/route";
import { clearConversations, deleteConversation, loadConversations, saveConversation, titleFrom, type StoredConversation } from "@/lib/tars/store";
import type { KeptBlock } from "@/lib/expert/claims";

export interface HelpAnswer {
  topic?: { id: string; title: string; body: string; link: string; highlight: string | null };
  others?: { id: string; title: string }[];
  none?: boolean;
  topics?: { id: string; title: string }[];
}

/** The second opinion of another model family, as the server sends it. */
export interface SkepticView {
  verdict: "agree" | "object" | "unavailable";
  objections: { blockIndex: number; reason: string; citation?: { doc_id: string; page: number; quote: string; title?: string; url?: string } }[];
  model: { model: string; name?: string; family: string } | null;
  note?: string;
}

export interface ExpertResult {
  blocks: KeptBlock[];
  dropped: number;
  flagged: number;
  actions: ({ type: "show"; target: unknown } | { type: "highlight"; selector: string; label: string })[];
  target: unknown;
  lang?: string;
  steps: { tool: string; label: string }[];
  model: { model: string; name: string; provider: string; fellBackFrom: string | null } | null;
}

export type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "tars"; kind: "error" | "note"; text: string }
  | { id: number; role: "tars"; kind: "help"; route: Route; help: HelpAnswer }
  | { id: number; role: "tars"; kind: "expert"; route: Route; result: ExpertResult; question?: string; skeptic?: SkepticView }
  | { id: number; role: "tars"; kind: "answer"; route: Route; answer: AnswerPair; question: string }
  | { id: number; role: "tars"; kind: "experiments"; route: Route; experiments: unknown; fingerprint: string };

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
type NewMsg = DistributiveOmit<Msg, "id">;

interface Ctx {
  open: boolean;
  setOpen: (o: boolean) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  messages: Msg[];
  busy: boolean;
  /** What TARS is doing right now ("Checking the engine…"). */
  status: string | null;
  send: (text: string) => Promise<void>;
  skill: (name: "map" | "close-gap") => Promise<void>;
  go: (link: string, highlight?: string | null) => void;
  showOnEnvelope: (p: Pending) => void;
  conversations: { id: string; title: string; updated: number }[];
  activeId: string;
  newChat: () => void;
  selectChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  removeChat: (id: string) => void;
  removeAll: () => void;
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

const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** What the page shows right now: sent with each message so TARS can answer "what is that thing on the right?". */
function pageContext(path: string) {
  const has = (sel: string) => !!document.querySelector(sel);
  const panels = [
    has(".scenario-strip") && "scenario_tiles",
    has(".nav-evidence") && "evidence_list",
    has(".chart-card") && "chart",
    has(".fs-on") && "chart_full_screen",
    has(".vring") && "verdict_ring",
    has(".add-source-btn") && "add_source",
    has("#ask-q") && "ask_box",
    has(".nav-left") && "controls",
  ].filter(Boolean) as string[];
  const text = (sel: string) => document.querySelector(sel)?.textContent?.trim().slice(0, 160) ?? null;
  return { route: path, panels, target: getCurrentTarget() ?? null, selectedTile: text(".tile-on .tile-title"), lastResult: text(".outcome-head") };
}

const textOfMsg = (m: Msg): string => {
  if (m.role === "user" || m.kind === "error" || m.kind === "note") return m.text;
  if (m.kind === "expert") return m.result.blocks.map((b) => b.text).join("\n");
  if (m.kind === "help") return m.help.topic ? `${m.help.topic.title}: ${m.help.topic.body}` : "";
  return "";
};

export default function TarsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setModeState] = useState<Mode>("advanced");
  const modeRef = useRef<Mode>("advanced");
  modeRef.current = mode;
  const [convs, setConvs] = useState<StoredConversation[]>([]);
  const [activeId, setActiveId] = useState<string>(() => newId());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const id = useRef(0);
  const router = useRouter();
  const path = usePathname();

  const active = convs.find((c) => c.id === activeId);
  const messages = useMemo<Msg[]>(() => (active?.messages ?? []) as Msg[], [active]);

  useEffect(() => {
    try {
      const m = window.localStorage.getItem("pyrion.tars.mode");
      if (m === "easy" || m === "advanced" || m === "auto") setModeState(m);
    } catch {
      /* the default stays */
    }
    void loadConversations().then((list) => {
      setConvs((cur) => {
        const ids = new Set(cur.map((c) => c.id));
        return [...cur, ...list.filter((c) => !ids.has(c.id))].sort((a, b) => b.updated - a.updated);
      });
      id.current = Math.max(id.current, ...list.flatMap((c) => (c.messages as { id: number }[]).map((m) => m.id)));
    });
  }, []);
  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    try {
      window.localStorage.setItem("pyrion.tars.mode", m);
    } catch {
      /* not remembered */
    }
  }, []);

  useEffect(() => {
    const p = takePending();
    if (p) deliver(p);
  }, [path]);

  /** Add a message to the active conversation and keep it in the browser's storage. */
  const add = useCallback(
    (m: NewMsg): number => {
      const msg = { ...m, id: ++id.current } as Msg;
      setConvs((all) => {
        const cur = all.find((c) => c.id === activeId);
        const next: StoredConversation = cur
          ? { ...cur, messages: [...cur.messages, msg], updated: Date.now(), title: cur.messages.length === 0 && msg.role === "user" ? titleFrom(msg.text) : cur.title }
          : { id: activeId, title: msg.role === "user" ? titleFrom(msg.text) : "New chat", updated: Date.now(), messages: [msg] };
        void saveConversation(next);
        return [next, ...all.filter((c) => c.id !== activeId)];
      });
      return msg.id;
    },
    [activeId],
  );

  /** Update a message already in the conversation (the second opinion arrives after the answer). */
  const patchMsg = useCallback(
    (mid: number, patch: Record<string, unknown>) => {
      setConvs((all) =>
        all.map((c) => {
          if (c.id !== activeId) return c;
          const n = { ...c, messages: c.messages.map((m: { id: number }) => (m.id === mid ? { ...m, ...patch } : m)) };
          void saveConversation(n);
          return n;
        }),
      );
    },
    [activeId],
  );

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

  /** The condition in a message by the older, model-free path: the Ask step, or code alone. */
  const readCondition = useCallback(async (text: string): Promise<{ parsed: ParsedTarget; readBy: string } | { error: string }> => {
    const r = await postJson<{ parsed: ParsedTarget; meta?: { read_by?: string; model?: string | null; name?: string } }>("/api/ask", { step: "parse", question: text });
    if (r.ok) return { parsed: r.data.parsed, readBy: r.data.meta?.read_by === "code" || !r.data.meta?.model ? "Read by code" : `Read by ${r.data.meta.name ?? r.data.meta.model}` };
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

  /** The model-free fallback: a condition gets the three-part answer, anything else TARS Support. */
  const fallback = useCallback(
    async (t: string, route: Route) => {
      if (route === "condition") {
        const c = await readCondition(t);
        if ("error" in c) add({ role: "tars", kind: "error", text: c.error });
        else await answerFor(c.parsed.target, c.readBy, t, route);
      } else {
        const r = await postJson<HelpAnswer>("/api/tars", { kind: "help", message: t });
        if (!r.ok) add({ role: "tars", kind: "error", text: r.data.error ?? "TARS Support could not answer." });
        else add({ role: "tars", kind: "help", route, help: r.data });
      }
    },
    [add, answerFor, readCondition],
  );

  /** The expert agent: streamed status lines, then one checked result. Returns false when no model is available (the fallback answers). */
  const expert = useCallback(
    async (t: string, route: Route): Promise<boolean> => {
      const history = messages.slice(-10).flatMap((m) => {
        const text = textOfMsg(m);
        return text ? [{ role: m.role === "user" ? "user" : "assistant", text }] : [];
      });
      const lastExpert = [...messages].reverse().find((m) => m.role === "tars" && m.kind === "expert") as Extract<Msg, { kind: "expert" }> | undefined;
      const lastTarget = (lastExpert?.result.target as unknown) ?? getCurrentTarget() ?? null;
      const res = await fetch("/api/tars/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t, history, lastTarget, ui: pageContext(path), skeptic: resolveMode(modeRef.current, route) === "advanced" }) });
      if (res.status === 503 || !res.body) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        // A content-check message is shown as it is; a missing model uses the model-free path.
        if (d.error && /content check/i.test(d.error)) {
          add({ role: "tars", kind: "error", text: d.error });
          return true;
        }
        return false;
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        add({ role: "tars", kind: "error", text: d.error ?? `The request failed (HTTP ${res.status}).` });
        return true;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let lastId: number | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { type: string; text?: string; error?: string } & Partial<ExpertResult>;
          if (ev.type === "status") setStatus(ev.text ?? null);
          else if (ev.type === "error") add({ role: "tars", kind: "error", text: ev.error ?? "TARS could not answer." });
          else if (ev.type === "result") lastId = add({ role: "tars", kind: "expert", route, result: ev as ExpertResult, question: t });
          else if (ev.type === "skeptic" && lastId !== null) patchMsg(lastId, { skeptic: (ev as unknown as { skeptic: SkepticView }).skeptic });
        }
      }
      return true;
    },
    [add, messages, patchMsg, path],
  );

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || busy) return;
      add({ role: "user", text: t });
      setBusy(true);
      setStatus("Thinking…");
      try {
        const route = routeMessage(t);
        let handled = false;
        try {
          handled = await expert(t, route);
        } catch {
          handled = false;
        }
        if (!handled) await fallback(t, route);
      } catch {
        add({ role: "tars", kind: "error", text: "TARS could not reach the server. Try again in a moment." });
      } finally {
        setBusy(false);
        setStatus(null);
      }
    },
    [add, busy, expert, fallback],
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

  // Conversations: new, open, rename, delete one, delete all. All in this browser.
  const newChat = useCallback(() => setActiveId(newId()), []);
  const selectChat = useCallback((cid: string) => setActiveId(cid), []);
  const renameChat = useCallback((cid: string, title: string) => {
    setConvs((all) =>
      all.map((c) => {
        if (c.id !== cid) return c;
        const n = { ...c, title: title.trim() || c.title };
        void saveConversation(n);
        return n;
      }),
    );
  }, []);
  const removeChat = useCallback(
    (cid: string) => {
      setConvs((all) => all.filter((c) => c.id !== cid));
      void deleteConversation(cid);
      if (cid === activeId) setActiveId(newId());
    },
    [activeId],
  );
  const removeAll = useCallback(() => {
    setConvs([]);
    void clearConversations();
    setActiveId(newId());
  }, []);

  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [open]);

  useEffect(() => {
    const on = (e: Event) => {
      setOpen(true);
      const q = (e as CustomEvent<string | undefined>).detail;
      if (q) void send(q);
    };
    window.addEventListener("pyrion:tars", on);
    return () => window.removeEventListener("pyrion:tars", on);
  }, [send]);

  const conversations = useMemo(() => convs.map((c) => ({ id: c.id, title: c.title, updated: c.updated })), [convs]);
  const value = useMemo<Ctx>(
    () => ({ open, setOpen, mode, setMode, messages, busy, status, send, skill, go, showOnEnvelope, conversations, activeId, newChat, selectChat, renameChat, removeChat, removeAll }),
    [open, mode, setMode, messages, busy, status, send, skill, go, showOnEnvelope, conversations, activeId, newChat, selectChat, renameChat, removeChat, removeAll],
  );
  return <TarsContext.Provider value={value}>{children}</TarsContext.Provider>;
}
