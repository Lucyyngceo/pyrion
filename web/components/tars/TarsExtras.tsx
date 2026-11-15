"use client";

import { useState } from "react";
import { highlight } from "@/lib/tars/bridge";
import { resolveMode } from "@/lib/tars/answer";
import { labelsFor, type Lang } from "@/lib/tars/lang";
import { CitationQuote } from "./CitationPreview";
import { suggestNext } from "@/lib/tars/suggest";
import { useTars, type ExpertResult, type Msg, type SkepticView } from "./TarsProvider";

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
  const L10n = labelsFor(r.lang as Lang | undefined);
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
              <span aria-hidden="true">{L.icon}</span> {L10n[b.layer]} <span className="tars-sub">{b.layer === "expert" ? L10n.expertSub : b.layer === "nasa" ? L10n.nasaSub : L10n.engineSub}</span>
            </h4>
            <Md text={b.text} />
            {b.citations.map((c, ci) => (
              <CitationQuote key={ci} doc_id={c.doc_id} page={c.page} quote={c.quote} title={c.title} url={c.url} />
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
              {L10n.showOnEnvelope}
            </button>
          ) : (
            <button data-help="tars-show-me" key={i} type="button" className="tars-btn" onClick={() => highlight(a.selector)}>
              Show me {a.label}
            </button>
          ),
        )}
      </div>
      {msg.skeptic && <SecondOpinion s={msg.skeptic} blocks={r.blocks.map((b) => b.layer)} es={r.lang === "es"} />}
      <NextQuestions result={r} />
      {adv && msg.question && <ThreeModels question={msg.question} target={r.target} lang={r.lang} />}
      {r.model && (
        <p className="small muted tars-by">
          {L10n.answeredBy} {r.model.name}
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

/** Up to three follow-ups, from templates and the state of the answer. */
function NextQuestions({ result }: { result: ExpertResult }) {
  const { send, showOnEnvelope, busy } = useTars();
  const items = suggestNext({ tools: result.steps.map((x) => x.tool), hasTarget: !!result.target, hasNasa: result.blocks.some((b) => b.layer === "nasa"), lang: result.lang });
  if (items.length === 0) return null;
  return (
    <div className="tars-next" data-help="tars-next-questions" role="group" aria-label="Suggested next questions">
      {items.map((x) =>
        "action" in x ? (
          <button key={x.id} data-help="tars-next-questions" type="button" className="chip" disabled={busy} onClick={() => showOnEnvelope({ target: result.target })}>
            {x.label}
          </button>
        ) : (
          <button key={x.id} data-help="tars-next-questions" type="button" className="chip" disabled={busy} onClick={() => void send(x.question)}>
            {x.label}
          </button>
        ),
      )}
    </div>
  );
}

interface Run {
  model: string;
  name: string;
  provider?: string | null;
  ok: boolean;
  error?: string;
  blocks?: { layer: "engine" | "nasa" | "expert"; text: string }[];
  fingerprint?: string | null;
  dropped?: number;
}

/** Ask 3 models: the same question to three models, side by side. Only on a click: it uses credit and counts against the limits. */
function ThreeModels({ question, target, lang }: { question: string; target: unknown; lang?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [runs, setRuns] = useState<Run[]>([]);
  const [same, setSame] = useState<boolean | null>(null);
  const [print, setPrint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const es = lang === "es";
  const go = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/tars/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: question, lastTarget: target ?? null }) });
      const d = (await res.json()) as { runs?: Run[]; identicalFingerprint?: boolean | null; fingerprint?: string | null; error?: string };
      if (!res.ok || !d.runs) {
        setError(d.error ?? "The comparison could not run.");
        setState("error");
        return;
      }
      setRuns(d.runs);
      setSame(d.identicalFingerprint ?? null);
      setPrint(d.fingerprint ?? null);
      setState("done");
    } catch {
      setError("The comparison could not run.");
      setState("error");
    }
  };
  return (
    <div className="tars-three" data-help="tars-three-models">
      {state === "idle" && (
        <button data-help="tars-three-models" type="button" className="chip" onClick={() => void go()} title="Sends the same question to three models. It uses credit and counts against your limits.">
          {es ? "Preguntar a 3 modelos" : "Ask 3 models"}
        </button>
      )}
      {state === "busy" && <p className="small muted">{es ? "Preguntando a tres modelos…" : "Asking three models…"}</p>}
      {state === "error" && <p className="small tars-err">{error}</p>}
      {state === "done" && (
        <>
          <p className="small">
            {same === true ? `${es ? "Mismo veredicto, distintas palabras" : "Same verdict, different words"} ✓` : same === false ? (es ? "Las huellas del motor difieren: cada modelo leyó una condición distinta." : "The engine fingerprints differ: the models read different conditions.") : es ? "No se pudo comparar las huellas." : "The fingerprints could not be compared."}
            {print && (
              <>
                {" "}
                <code className="small">{print.slice(0, 16)}…</code>
              </>
            )}
          </p>
          <div className="tars-three-grid">
            {runs.map((r) => (
              <section key={r.model} className="tars-three-col">
                <h5>{r.name}</h5>
                {!r.ok && <p className="small muted">{r.error}</p>}
                {r.ok && (r.blocks ?? []).map((b, i) => <Md key={i} text={`${LAYER[b.layer].icon} ${b.text}`} />)}
                {r.ok && (r.blocks ?? []).length === 0 && <p className="small muted">{es ? "Sin respuesta verificable." : "No verifiable answer."}</p>}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const LAYER_NAME = { engine: "Engine", nasa: "NASA", expert: "Expert" } as const;

/** The second opinion of a model of another family: agree, object (with the reason and a verified quote), or unavailable. It never changes the answer. */
function SecondOpinion({ s, blocks, es }: { s: SkepticView; blocks: ("engine" | "nasa" | "expert")[]; es: boolean }) {
  const who = s.model ? (s.model.name ?? s.model.model) : null;
  return (
    <div className={`tars-second tars-second-${s.verdict}`} data-help="tars-second-opinion" role="note">
      <strong>{es ? "Segunda opinión" : "Second opinion"}</strong>{" "}
      {s.verdict === "agree" && <span>✓ {es ? "de acuerdo" : "agrees"}{who ? ` · ${who}` : ""}</span>}
      {s.verdict === "object" && (
        <>
          <span>⚠ {es ? "objeta" : "objects"}{who ? ` · ${who}` : ""}</span>
          <ul>
            {s.objections.map((o, i) => (
              <li key={i}>
                <em>{LAYER_NAME[blocks[o.blockIndex]] ?? "Answer"} {es ? "bloque" : "block"}:</em> {o.reason}
                {o.citation && <CitationQuote doc_id={o.citation.doc_id} page={o.citation.page} quote={o.citation.quote} title={o.citation.title} url={o.citation.url} />}
              </li>
            ))}
          </ul>
        </>
      )}
      {s.verdict === "unavailable" && <span className="muted">{es ? "no disponible" : "unavailable"}{s.note ? `: ${s.note}` : ""}</span>}
    </div>
  );
}
