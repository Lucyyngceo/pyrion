"use client";

import { useEffect, useRef, useState } from "react";
import { buildNarrationInput, sha256Hex, type ParsedTarget } from "@/lib/ask-core";
import { canonicalJson, evaluate, type ConditionRecord, type EngineOptions } from "@/lib/engine";
import { checkNarration } from "@/lib/narration-check";
import { fmt, kpaToPsi, valueLabel } from "@/lib/units";
import type { Investigation } from "@/lib/types";

const EXAMPLES = [
  "Would solid fuel burn differently in a lunar base at 30% oxygen and 10.2 psi?",
  "What does PSI say about a flame in microgravity at normal air pressure with 21% oxygen?",
  "Which experiments cover a 34% oxygen cabin at 8.2 psia?",
];

interface Run {
  model: string;
  parsed: ParsedTarget;
  hash: string | null;
  narration: string | null;
  failures: string[];
  narrationError: string | null;
}

interface Props {
  records: ConditionRecord[];
  options: EngineOptions;
  investigations: Investigation[];
  /** Send the understood target to the explorer (chart, panel, verdict rows). */
  onTarget: (p: ParsedTarget) => void;
}

async function call(step: "parse" | "narrate", model: string, payload: Record<string, unknown>): Promise<{ reply: string | null; failures: string[]; parsed?: ParsedTarget }> {
  const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step, model, ...payload }) });
  const data = (await res.json().catch(() => ({}))) as { reply?: string | null; error?: string; check?: { failures?: string[] }; parsed?: ParsedTarget };
  if (!res.ok) throw new Error(data.error ?? `the request failed (HTTP ${res.status})`);
  if (data.parsed) return { reply: null, failures: [], parsed: data.parsed };
  if (typeof data.reply !== "string" && !data.check) throw new Error("the request returned no text");
  return { reply: typeof data.reply === "string" ? data.reply : null, failures: data.check?.failures ?? [] };
}

function describe(p: ParsedTarget): string {
  const t = p.target;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(t.regime)) if (v) parts.push(`${k.replaceAll("_", " ")}: ${valueLabel(v)}`);
  if (t.continuous.o2_mole_fraction !== undefined) parts.push(`O₂ ${fmt(t.continuous.o2_mole_fraction * 100, 1)} %`);
  if (t.continuous.pressure !== undefined) parts.push(`${fmt(t.continuous.pressure, 1)} kPa (${fmt(kpaToPsi(t.continuous.pressure), 1)} psia)`);
  if (t.continuous.gravity_level !== undefined) parts.push(`${fmt(t.continuous.gravity_level, 3)} g`);
  return parts.length ? parts.join(" · ") : "nothing stated";
}

export default function AskBox({ records, options, investigations, onTarget }: Props) {
  const [cfg, setCfg] = useState<{ enabled: boolean; models: string[] } | null>(null);
  const [q, setQ] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const asked = useRef("");

  useEffect(() => {
    let live = true;
    fetch("/api/ask")
      .then((r) => r.json())
      .then((d: { enabled?: boolean; models?: string[] }) => {
        if (!live) return;
        setCfg({ enabled: !!d.enabled, models: d.models ?? [] });
        setModel(d.models?.[0] ?? "");
      })
      .catch(() => live && setCfg({ enabled: false, models: [] }));
    return () => {
      live = false;
    };
  }, []);

  async function run(question: string, m: string, fresh: boolean) {
    setBusy(true);
    setError(null);
    if (fresh) setRuns([]);
    try {
      // Step A: the model translates the question into a target; code validates it.
      const asked = await call("parse", m, { question });
      // The server already converted the quantities with the engine; the model never outputs a converted number.
      const parsed = asked.parsed;
      if (!parsed) throw new Error("the question could not be turned into a target");
      onTarget(parsed);
      // Step B: the deterministic engine decides. No model involved.
      const evaluation = evaluate(records, parsed.target, options);
      const hash = await sha256Hex(canonicalJson(evaluation));
      // Step C: the model narrates the engine's output only; code checks the narration.
      const { input, facts } = buildNarrationInput(evaluation, investigations, parsed.target);
      let narration: string | null = null;
      let failures: string[] = [];
      let narrationError: string | null = null;
      try {
        const out = await call("narrate", m, { input });
        // The server already checked; the page checks again, so a withheld or altered text never shows.
        const check = out.reply === null ? { ok: false, failures: out.failures } : checkNarration(out.reply, facts);
        if (check.ok && out.reply) narration = out.reply.trim();
        else failures = check.failures;
      } catch (e) {
        narrationError = e instanceof Error ? e.message : String(e);
      }
      setRuns((r) => [...r, { model: m, parsed, hash, narration, failures, narrationError }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const submit = (text: string) => {
    const question = text.trim();
    if (!question || busy || !cfg?.enabled) return;
    asked.current = question;
    void run(question, model, true);
  };
  const hashes = new Set(runs.map((r) => r.hash).filter(Boolean));
  const same = runs.length > 1 && hashes.size === 1;

  return (
    <section className="card ask" aria-labelledby="ask-h">
      <div className="card-head">
        <h2 id="ask-h">Ask PYRION</h2>
        <p className="muted small">
          The language model translates your question and narrates the result. <strong>The engine decides</strong>: verdicts come from
          deterministic rules, and every sentence the model writes is checked by code before it is shown.
        </p>
      </div>

      {cfg && !cfg.enabled ? (
        <p className="ask-off" role="status">
          <strong>Structured mode:</strong> add a key to enable questions. Everything else on this page works without one: pick a preset or set the target by hand.
        </p>
      ) : (
        <>
          <form
            className="ask-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit(q);
            }}
          >
            <label className="sr-only" htmlFor="ask-q">
              Ask about a condition
            </label>
            <input id="ask-q" type="text" maxLength={500} value={q} placeholder="Ask about a condition…" onChange={(e) => setQ(e.target.value)} disabled={!cfg?.enabled} />
            <button type="submit" disabled={busy || !q.trim() || !cfg?.enabled}>
              {busy ? "Working…" : "Ask"}
            </button>
          </form>
          <div className="ask-ex">
            {EXAMPLES.map((x) => (
              <button key={x} type="button" className="linklike small" onClick={() => setQ(x)}>
                {x}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p className="banner" role="alert">
          {error}
        </p>
      )}

      {runs.map((r, i) => (
        <div key={i} className="ask-run">
          <p className="ask-understood">
            <strong>PYRION understood:</strong> {describe(r.parsed)}.{" "}
            {r.parsed.unstated.length > 0 && <span className="muted">Not stated, left as it was on the chart or not compared: {r.parsed.unstated.map((u) => u.replaceAll("_", " ")).join(", ")}. </span>}
            <a href="#target-panel">Edit the target</a>
          </p>
          {r.parsed.conversions.length > 0 && (
            <ul className="small muted ask-assume">
              {r.parsed.conversions.map((c) => (
                <li key={c}>Converted by the engine: {c}</li>
              ))}
            </ul>
          )}
          {r.parsed.warnings.length > 0 && (
            <ul className="small ask-assume">
              {r.parsed.warnings.map((w) => (
                <li key={w}>Note: {w}</li>
              ))}
            </ul>
          )}
          {r.parsed.assumptions.length > 0 && (
            <ul className="small muted ask-assume">
              {r.parsed.assumptions.map((a) => (
                <li key={a}>Assumed by the model: {a}</li>
              ))}
            </ul>
          )}
          {r.narration ? (
            <p className="ask-narr">{r.narration}</p>
          ) : r.narrationError ? (
            <p className="small muted">Narration unavailable: {r.narrationError}. The structured result below is unaffected.</p>
          ) : (
            <div className="small ask-withheld">
              <strong>Narration withheld: failed the consistency check.</strong>
              <ul>
                {r.failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="small muted ask-meta">
            Written by <code>{r.model}</code> (open weights), checked by code. Engine output SHA-256:{" "}
            <code title={r.hash ?? ""}>{r.hash ? `${r.hash.slice(0, 16)}…` : "unavailable here (no Web Crypto)"}</code>
          </p>
        </div>
      ))}

      {runs.length > 0 && cfg && cfg.models.length > 1 && (
        <div className="ask-switch small">
          <span className="muted">Same question, another model:</span>
          {cfg.models
            .filter((m) => !runs.some((r) => r.model === m))
            .map((m) => (
              <button key={m} type="button" className="chip" disabled={busy} onClick={() => void run(asked.current, m, false)}>
                {m}
              </button>
            ))}
        </div>
      )}
      {runs.length > 1 && (
        <p className="small ask-hash" role="status">
          {same ? (
            <>
              <strong>Same verdict, different words.</strong> The engine output has the same SHA-256 under {runs.length} models.
            </>
          ) : (
            <>
              <strong>The engine outputs differ.</strong> The models translated the question into different targets (compare the &quot;PYRION
              understood&quot; lines); the engine itself is deterministic.
            </>
          )}
        </p>
      )}
    </section>
  );
}
