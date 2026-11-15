"use client";

import { useRef, useState } from "react";
import type { ClaimCheck, ClaimClass } from "@/lib/expert/claim";
import type { Brief } from "@/lib/expert/brief";
import { CitationQuote } from "./CitationPreview";
import { useTars } from "./TarsProvider";

const CLASS_HELP: Record<ClaimClass, string> = {
  "supported in PSI": "The engine or a verified NASA quote supports it.",
  "not supported in PSI": "Nothing in PSI, in what was checked, supports it. This is not the same as false.",
  contradicted: "The engine or a verified NASA quote says otherwise.",
  overclaim: "The wording claims more than evidence can: safe, validated, first, proves…",
};
const CLASS_SLUG: Record<ClaimClass, string> = { "supported in PSI": "ok", "not supported in PSI": "none", contradicted: "bad", overclaim: "over" };

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? "the request failed");
  return j;
}

/** "Check a claim": paste a text; each claim is classified by code, with its engine reference or verified NASA quote. */
export function ClaimChecker({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<ClaimCheck | null>(null);
  const run = async () => {
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      setRes(await post<ClaimCheck>("/api/tars/claim", { text }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the request failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section data-help="tars-claim-check" className="tars-skillpanel" aria-label="Check a claim">
      <div className="tars-skillhead">
        <strong>Check a claim</strong>
        <button data-help="tars-skillpanel-close" type="button" className="linklike small" onClick={onClose}>
          Close
        </button>
      </div>
      <label className="small muted" htmlFor="tars-claim-text">
        Paste a text (a paragraph, an abstract, an answer from another tool). Each claim in it is classified by code.
      </label>
      <textarea id="tars-claim-text" data-help="tars-claim-input" rows={4} maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. PSI-69 shows the flame is safe at 30% oxygen in microgravity." />
      <button data-help="tars-claim-run" type="button" className="tars-btn" disabled={busy || text.trim().length < 12} onClick={() => void run()}>
        {busy ? "Checking…" : "Check the claims"}
      </button>
      {err && <p className="tars-err" role="alert">{err}</p>}
      {res && (
        <div data-help="tars-claim-table" className="tars-claims">
          <p className="small muted">
            {(Object.keys(res.counts) as ClaimClass[]).map((k) => `${res.counts[k]} ${k}`).join(" · ")}
            {res.models.length > 0 ? ` · proposed by ${res.models.join(", ")}; classified by code` : " · split by code (no model was available)"}
          </p>
          <table>
            <thead>
              <tr>
                <th>Claim</th>
                <th>Class</th>
                <th>Why, and the evidence</th>
              </tr>
            </thead>
            <tbody>
              {res.claims.map((c, i) => (
                <tr key={i}>
                  <td>{c.text}</td>
                  <td>
                    <span className={`tars-badge tars-badge-${CLASS_SLUG[c.class]}`} title={CLASS_HELP[c.class]}>
                      {c.class}
                    </span>
                    {c.overclaimPatterns.length > 0 && <div className="small muted">wording: {c.overclaimPatterns.join(", ")}</div>}
                  </td>
                  <td>
                    <div className="small">{c.reason}</div>
                    {c.engineRefs.map((e) => (
                      <div key={e.accession + e.fingerprint} className="small muted">
                        Engine: {e.accession} is {e.engineVerdict} at {e.target} · fingerprint <code>{e.fingerprint.slice(0, 12)}…</code>
                        {e.doi && (
                          <>
                            {" · "}
                            <a data-help="tars-doi" href={`https://doi.org/${e.doi}`} target="_blank" rel="noreferrer">
                              DOI
                            </a>
                          </>
                        )}
                      </div>
                    ))}
                    {c.citations.map((q, j) => (
                      <CitationQuote key={j} doc_id={q.doc_id} page={q.page} quote={q.quote} title={q.title} url={q.url} />
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {res.dropped.length > 0 && <p className="small muted">{res.dropped.length} proposal(s) were discarded because code could not verify them.</p>}
        </div>
      )}
    </section>
  );
}

/** "Brief me": the conversation as a document built by code (engine recomputed, quotes re-verified). */
export function BriefMe({ onClose }: { onClose: () => void }) {
  const { messages } = useTars();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const turns = messages.flatMap((m) =>
    m.role === "tars" && m.kind === "expert" && m.question
      ? [{ question: m.question, kept: m.result.blocks, target: m.result.target, model: m.result.model ? { model: m.result.model.model, name: m.result.model.name } : null, skeptic: m.skeptic ? { verdict: m.skeptic.verdict, model: m.skeptic.model, objections: m.skeptic.objections } : null }]
      : [],
  );
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setBrief(await post<Brief>("/api/tars/brief", { turns }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the request failed");
    } finally {
      setBusy(false);
    }
  };
  const download = () => {
    if (!brief) return;
    const url = URL.createObjectURL(new Blob([brief.markdown], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "pyrion-evidence-brief.md";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section data-help="tars-brief" className="tars-skillpanel" aria-label="Brief me">
      <div className="tars-skillhead">
        <strong>Brief me</strong>
        <button data-help="tars-skillpanel-close" type="button" className="linklike small" onClick={onClose}>
          Close
        </button>
      </div>
      {turns.length === 0 ? (
        <p className="small muted">Ask TARS a question first; the brief is built from the answered questions of this conversation.</p>
      ) : (
        <p className="small muted">
          {turns.length} answered question{turns.length === 1 ? "" : "s"} in this conversation. Only checked statements go in; the engine part is recomputed and every NASA quote is verified again.
        </p>
      )}
      <button data-help="tars-brief-build" type="button" className="tars-btn" disabled={busy || turns.length === 0} onClick={() => void run()}>
        {busy ? "Building…" : "Build the brief"}
      </button>
      {err && <p className="tars-err" role="alert">{err}</p>}
      {brief && (
        <>
          <div className="tars-brief-actions">
            <button data-help="tars-brief-download" type="button" className="tars-btn" onClick={download}>
              Download .md
            </button>
            <button data-help="tars-brief-print" type="button" className="tars-btn" onClick={() => frame.current?.contentWindow?.print()}>
              Print / PDF
            </button>
          </div>
          {brief.left_out.length > 0 && <p className="small muted">{brief.left_out.length} block(s) were left out because they could not be checked.</p>}
          <iframe data-help="tars-brief-preview" ref={frame} title="Evidence brief preview" className="tars-brief-frame" sandbox="allow-same-origin allow-modals" srcDoc={brief.html} />
        </>
      )}
    </section>
  );
}
