"use client";

import { BriefMe, ClaimChecker, CompareAtmospheres } from "./TarsSkills";
import { useEffect, useRef, useState } from "react";
import type { ExperimentsNeeded } from "@/lib/engine";
import ExperimentsView from "../ExperimentsView";
import { resolveMode, viewFor, type Mode } from "@/lib/tars/answer";
import { ExpertAnswer, History } from "./TarsExtras";
import { useTars, type HelpAnswer, type Msg } from "./TarsProvider";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "easy", label: "Easy", hint: "Plain wording; details and steps folded." },
  { id: "advanced", label: "Advanced", hint: "Figures, receipts and the steps open." },
  { id: "auto", label: "Auto", hint: "Advanced for a condition, Easy for a how-to question." },
];

const HONESTY = "Honesty is enforced by code: the verdicts and every number come from the engine.";

type Cite = { accession: string; acronym?: string; doi?: string; recordIds: string[] };

const BLOCK_HELP: Record<string, { help: string }> = { KNOWN: { help: "tars-known" }, UNKNOWN: { help: "tars-unknown" }, NEXT: { help: "tars-next" } };

function Block({ title, sub, items, showDetail }: { title: string; sub: string; items: { sentence: string; citations?: Cite[] }[]; showDetail: boolean }) {
  const { showOnEnvelope } = useTars();
  return (
    <section data-help={BLOCK_HELP[title]?.help} className={`tars-block tars-${title.toLowerCase()}`} aria-label={title}>
      <h4>
        {title} <span className="tars-sub">{sub}</span>
      </h4>
      <ul>
        {items.map((f, i) => (
          <li key={i}>
            <span>{f.sentence}</span>
            {f.citations?.map((r) => (
              <span key={r.accession} className="tars-ref">
                <button data-help="tars-receipt" type="button" className="linklike small" onClick={() => showOnEnvelope({ open: r.accession })}>
                  {r.accession} receipt
                </button>
                {showDetail && r.doi && (
                  <a data-help="tars-doi" className="small" href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">
                    doi
                  </a>
                )}
                {showDetail && r.recordIds.length > 0 && <span className="small muted">{r.recordIds.length} records</span>}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Answer({ msg }: { msg: Extract<Msg, { kind: "answer" }> }) {
  const { mode, showOnEnvelope } = useTars();
  const v = viewFor(msg.answer, resolveMode(mode, msg.route));
  const a = v.answer;
  return (
    <div className="tars-answer">
      <Block title="KNOWN" sub="what the extracted PSI records support" items={a.known} showDetail={v.showDetail} />
      <Block title="UNKNOWN" sub="where the evidence ends, and why" items={a.unknown} showDetail={v.showDetail} />
      <Block title="NEXT" sub="what would close it (a PYRION proposal, not a NASA plan)" items={a.next} showDetail={v.showDetail} />
      <p data-help="tars-fingerprint" className="tars-fp small muted">
        Engine fingerprint (SHA-256): <code>{v.showDetail ? a.fingerprint : `${a.fingerprint.slice(0, 16)}…`}</code>
      </p>
      <button data-help="tars-show-on-envelope" type="button" className="tars-btn" onClick={() => showOnEnvelope({ target: a.target })}>
        Show on the envelope
      </button>
      <details className="tars-steps" open={v.stepsOpen} key={String(v.stepsOpen)}>
        <summary data-help="tars-steps">How TARS got this ({v.steps.length} steps)</summary>
        <ol>
          {v.steps.map((s) => (
            <li key={s.id}>{s.label}</li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function Experiments({ msg }: { msg: Extract<Msg, { kind: "experiments" }> }) {
  const ex = msg.experiments as ExperimentsNeeded;
  const { mode, showOnEnvelope } = useTars();
  const adv = resolveMode(mode, msg.route) === "advanced";
  return (
    <>
      <ExperimentsView ex={ex} fingerprint={adv ? msg.fingerprint : `${msg.fingerprint.slice(0, 16)}…`} detailed={adv} />
      <button data-help="tars-show-on-envelope" type="button" className="tars-btn" onClick={() => showOnEnvelope({ target: ex.target })}>
        Show on the envelope
      </button>
    </>
  );
}

function Help({ help }: { help: HelpAnswer }) {
  const { go, send } = useTars();
  if (help.none || !help.topic)
    return (
      <div className="tars-help">
        <p>TARS Support has no topic for that. These are the topics it has:</p>
        <ul>
          {(help.topics ?? []).map((t) => (
            <li key={t.id}>
              <button data-help="tars-support-topic" type="button" className="linklike" onClick={() => void send(t.title)}>
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  const t = help.topic;
  return (
    <div className="tars-help">
      <h4>{t.title}</h4>
      {t.body.split(/\n\n+/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <button data-help="tars-take-me-there" type="button" className="tars-btn" onClick={() => go(t.link, t.highlight)}>
        Take me there
      </button>
      {help.others && help.others.length > 0 && (
        <p className="small muted">
          Related:{" "}
          {help.others.map((o, i) => (
            <span key={o.id}>
              {i > 0 && " · "}
              <button data-help="tars-related" type="button" className="linklike small" onClick={() => void send(o.title)}>
                {o.title}
              </button>
            </span>
          ))}
        </p>
      )}
      <p className="small muted">Answered from the site's help topics, with no AI involved.</p>
    </div>
  );
}

/** The chat itself: used by the floating panel and by the /tars page. */
export default function TarsChat({ autoFocus = false, sidebar = false }: { autoFocus?: boolean; sidebar?: boolean }) {
  const { mode, setMode, messages, busy, status, send, skill } = useTars();
  const [text, setText] = useState("");
  const [historyOpen, setShowHistory] = useState(false);
  const [panel, setPanel] = useState<null | "claim" | "brief" | "compare">(null);
  // On the TARS tab the conversation list is always a left sidebar; in the panel it opens with the History button.
  const showHistory = sidebar || historyOpen;
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  return (
    <div className={`tars-chat${showHistory ? " with-history" : ""}`}>
      {showHistory && <History />}
      <div className="tars-main">
      <div className="tars-top">
        {!sidebar && (
          <button data-help="tars-history-toggle" type="button" className="chip tars-plain-chip" aria-expanded={showHistory} onClick={() => setShowHistory((h) => !h)} title="Your conversations, kept in this browser">
            History
          </button>
        )}
        <div className="seg" role="group" aria-label="TARS mode">
          {MODES.map((m) => (
            <button data-help="tars-mode" key={m.id} type="button" aria-pressed={mode === m.id} title={m.hint} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <div className="tars-skills">
          <button data-help="tars-skill-map" type="button" className="chip" disabled={busy} onClick={() => void skill("map")}>
            Map the unknown
          </button>
          <button data-help="tars-skill-gap" type="button" className="chip" disabled={busy} onClick={() => void skill("close-gap")}>
            What would close this gap
          </button>
          <button data-help="tars-skill-claim" type="button" className="chip" aria-pressed={panel === "claim"} onClick={() => setPanel(panel === "claim" ? null : "claim")}>
            Check a claim
          </button>
          <button data-help="tars-skill-brief" type="button" className="chip" aria-pressed={panel === "brief"} onClick={() => setPanel(panel === "brief" ? null : "brief")}>
            Brief me
          </button>
          <button data-help="tars-skill-compare" type="button" className="chip" aria-pressed={panel === "compare"} onClick={() => setPanel(panel === "compare" ? null : "compare")}>
            Compare atmospheres
          </button>
        </div>
      </div>
      {panel === "claim" && <ClaimChecker onClose={() => setPanel(null)} />}
      {panel === "brief" && <BriefMe onClose={() => setPanel(null)} />}
      {panel === "compare" && <CompareAtmospheres onClose={() => setPanel(null)} />}
      <p data-help="tars-honesty" className="tars-honesty small muted">{HONESTY}</p>

      <div data-help="tars-log" className="tars-log" role="log" aria-live="polite">
        {messages.length === 0 && (
          <p className="tars-hello">
            Ask me about PYRION, fire safety in space, cabin atmospheres, NASA's combustion data or this site. Answers carry three labelled layers: what the engine computed, what NASA said (quoted and checked), and my own reasoning, labelled as not verified against a source.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`tars-msg tars-${m.role}`}>
            {m.role === "user" && <p>{m.text}</p>}
            {m.role === "tars" && (m.kind === "error" || m.kind === "note") && (
              <p className={m.kind === "error" ? "tars-err" : undefined} role={m.kind === "error" ? "alert" : undefined}>
                {m.text}
              </p>
            )}
            {m.role === "tars" && m.kind === "help" && <Help help={m.help} />}
            {m.role === "tars" && m.kind === "expert" && <ExpertAnswer msg={m} />}
            {m.role === "tars" && m.kind === "answer" && <Answer msg={m} />}
            {m.role === "tars" && m.kind === "experiments" && <Experiments msg={m} />}
          </div>
        ))}
        {busy && (
          <p data-help="tars-status" className="tars-status small" role="status" aria-live="polite">
            <span className="tars-dots" aria-hidden="true" /> {status ?? "TARS is working…"}
          </p>
        )}
        <div ref={end} />
      </div>

      <form
        className="tars-form"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text;
          setText("");
          void send(t);
        }}
      >
        <label className="sr-only" htmlFor="tars-q">
          Message to TARS
        </label>
        <input data-help="tars-input" id="tars-q" ref={input} type="text" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask TARS…" autoComplete="off" />
        <button data-help="tars-send" type="submit" disabled={busy || !text.trim()}>
          Send
        </button>
      </form>
      <p data-help="tars-privacy" className="tars-privacy small muted">
        No account. Your conversations stay in this browser. An anonymous device id (a random number) is used only for fair rate limits.
      </p>
      </div>
    </div>
  );
}
