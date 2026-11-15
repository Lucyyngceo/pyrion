"use client";

import { useState } from "react";
import { highlight } from "@/lib/tars/bridge";
import { resolveMode } from "@/lib/tars/answer";
import { useTars, type ExpertResult, type Msg } from "./TarsProvider";

/** A small, safe Markdown renderer: paragraphs, bullet and numbered lists, **bold**, *italic*, `code`. The model's text is never inserted as HTML. */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={`${key}${i++}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={`${key}${i++}`}>{t.slice(1, -1)}</code>);
    else out.push(<em key={`${key}${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index! + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Md({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, bi) => {
        const lines = b.split("\n").filter((l) => l.trim() !== "");
        if (lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={bi} className="tars-md">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        if (lines.length > 0 && lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return (
            <ol key={bi} className="tars-md">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={bi} className="tars-md">
            {lines.map((l, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {inline(l, `${bi}-${li}`)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

const LAYER = {
  engine: { icon: "🔒", name: "Engine", cls: "tars-l-engine", help: "tars-layer-engine" },
  nasa: { icon: "📄", name: "NASA said it", cls: "tars-l-nasa", help: "tars-layer-nasa" },
  expert: { icon: "🧠", name: "TARS expert knowledge", cls: "tars-l-expert", help: "tars-layer-expert" },
} as const;

export function ExpertAnswer({ msg }: { msg: Extract<Msg, { kind: "expert" }> }) {
  const { mode, showOnEnvelope } = useTars();
  const adv = resolveMode(mode, msg.route) === "advanced";
  const r: ExpertResult = msg.result;
  return (
    <div className="tars-answer tars-expert">
      {r.steps.some((x) => x.tool === "what_if_experiment") && (
        <p className="tars-label" role="note">
          Hypothetical: not a measurement. The simulated test exists only in this answer and is never saved to the data.
        </p>
      )}
      {r.blocks.length === 0 && <p className="muted">TARS had nothing it could stand behind for that question. Try asking it another way.</p>}
      {r.blocks.map((b, i) => {
        const L = LAYER[b.layer];
        return (
          <section key={i} data-help={L.help} className={`tars-layer ${L.cls}`}>
            <h4>
              <span aria-hidden="true">{L.icon}</span> {L.name} <span className="tars-sub">{b.label}</span>
            </h4>
            <Md text={b.text} />
            {b.citations.map((c, ci) => (
              <blockquote key={ci} className="tars-quote" title={`${c.doc_id}, p. ${c.page}`}>
                “{c.quote}”
                <footer className="small muted">
                  {c.title ?? c.doc_id}, p. {c.page}
                  {c.url && (
                    <>
                      {" · "}
                      <a data-help="tars-document-link" href={c.url} target="_blank" rel="noreferrer">
                        open the document
                      </a>
                    </>
                  )}
                </footer>
              </blockquote>
            ))}
            {adv && b.provenance.length > 0 && (
              <ul className="small muted">
                {b.provenance.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {b.flagged && <p className="small muted">A figure the code could not trace to a source was removed.</p>}
          </section>
        );
      })}
      {(r.dropped > 0 || r.flagged > 0) && (
        <p className="small muted">
          Checked by code: {r.dropped > 0 ? `${r.dropped} statement${r.dropped === 1 ? "" : "s"} withheld (could not be verified)` : ""}
          {r.dropped > 0 && r.flagged > 0 ? "; " : ""}
          {r.flagged > 0 ? `${r.flagged} figure${r.flagged === 1 ? "" : "s"} removed` : ""}.
        </p>
      )}
      <div className="tars-actions">
        {r.actions.map((a, i) =>
          a.type === "show" ? (
            <button data-help="tars-show-on-envelope" key={i} type="button" className="tars-btn" onClick={() => showOnEnvelope({ target: a.target })}>
              Show on the envelope
            </button>
          ) : (
            <button data-help="tars-show-me" key={i} type="button" className="tars-btn" onClick={() => highlight(a.selector)}>
              Show me {a.label}
            </button>
          ),
        )}
      </div>
      {r.model && (
        <p className="small muted tars-by">
          Answered by {r.model.name}
          {r.model.fellBackFrom ? ` (${r.model.fellBackFrom} was not available)` : ""} · {r.model.provider === "nim" ? "NVIDIA NIM" : "OpenRouter"}
        </p>
      )}
      {r.steps.length > 0 && (
        <details className="tars-steps" open={adv} key={String(adv)}>
          <summary data-help="tars-steps">How TARS got this ({r.steps.length} steps{adv && r.model ? ` · ${r.model.name}` : ""})</summary>
          <ol>
            {r.steps.map((s, i) => (
              <li key={i}>{s.label.replace(/…$/, "")}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

/** Conversations, kept in this browser only: new chat, open, rename, delete one, delete all. */
export function History() {
  const { conversations, activeId, newChat, selectChat, renameChat, removeChat, removeAll } = useTars();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");
  return (
    <nav data-help="tars-history" className="tars-history" aria-label="Conversations">
      <button data-help="tars-new-chat" type="button" className="tars-btn" onClick={newChat}>
        + New chat
      </button>
      {conversations.length === 0 && <p className="small muted">No conversations yet.</p>}
      <ul>
        {conversations.map((c) => (
          <li key={c.id} className={c.id === activeId ? "on" : undefined}>
            {renaming === c.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  renameChat(c.id, name);
                  setRenaming(null);
                }}
              >
                <input data-help="tars-rename-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setRenaming(null)} aria-label="Conversation name" maxLength={60} />
              </form>
            ) : (
              <button data-help="tars-conversation" type="button" className="tars-conv" onClick={() => selectChat(c.id)} title={c.title}>
                {c.title}
              </button>
            )}
            <span className="tars-conv-actions">
              <button data-help="tars-rename"
                type="button"
                aria-label={`Rename ${c.title}`}
                title="Rename"
                onClick={() => {
                  setName(c.title);
                  setRenaming(c.id);
                }}
              >
                ✎
              </button>
              <button data-help="tars-delete" type="button" aria-label={`Delete ${c.title}`} title="Delete" onClick={() => removeChat(c.id)}>
                ×
              </button>
            </span>
          </li>
        ))}
      </ul>
      {conversations.length > 0 && (
        <button data-help="tars-delete-all"
          type="button"
          className="linklike small"
          onClick={() => {
            if (window.confirm("Delete all conversations from this browser?")) removeAll();
          }}
        >
          Delete all
        </button>
      )}
      <p className="small muted">Conversations stay in this browser. Nothing is sent to a server for storage.</p>
    </nav>
  );
}
