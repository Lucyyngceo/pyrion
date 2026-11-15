"use client";

import { useEffect, useRef, useState } from "react";
import type { ParsedTarget } from "@/lib/ask-core";
import { fmt, kpaToPsi, valueLabel } from "@/lib/units";

const EXAMPLES = [
  "Would solid fuel burn differently in a lunar base at 30% oxygen and 10.2 psi?",
  "What does PSI say about a flame in microgravity at normal air pressure with 21% oxygen?",
  "Which experiments cover a 34% oxygen cabin at 8.2 psia?",
];

interface Meta {
  provider: string;
  model: string;
  latency_ms: number;
  fell_back_from: string | null;
  open_weights: { license: string; source: string } | null;
}

interface Run {
  parsed: ParsedTarget;
  parseMeta: Meta;
  safety: string;
  /** From the server: the engine run on the server's own data. */
  hash: string | null;
  verdicts: string[];
  context: string | null;
  failures: string[];
  narrateMeta: Meta | null;
  narrationUnavailable: boolean;
  narrateError: string | null;
}

interface Props {
  /** Send the understood target to the explorer (chart, panel, verdict rows). */
  onTarget: (p: ParsedTarget) => void;
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `the request failed (HTTP ${res.status})`);
  return data;
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

/** "qwen/qwen3.8-27b · open weights · Apache-2.0 (source) via openrouter, 392 ms". Only what the server reports. */
function Who({ m }: { m: Meta | null }) {
  if (!m) return <code>no model</code>;
  return (
    <>
      <code>{m.model}</code>
      {m.open_weights && (
        <>
          {" · open weights · "}
          <a href={m.open_weights.source} target="_blank" rel="noreferrer">
            {m.open_weights.license}
          </a>
        </>
      )}
      {` via ${m.provider}, ${m.latency_ms} ms${m.fell_back_from ? `; fell back from ${m.fell_back_from}` : ""}`}
    </>
  );
}

export default function AskBox({ onTarget }: Props) {
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
      // Step A: the model copies the quantities as written; code checks them against the question; the engine converts.
      const a = await post<{ parsed: ParsedTarget; meta: Meta; safety: string }>({ step: "parse", model: m, question });
      onTarget(a.parsed);
      // Steps B and C run on the server: it evaluates the target itself, writes the verdicts, and checks the model's context.
      let n: { meta: Meta | null; engine_sha256?: string; verdicts: string[]; context: string | null; check: { failures: string[] }; narration_unavailable?: boolean } | null = null;
      let narrateError: string | null = null;
      try {
        n = await post({ step: "narrate", model: m, target: a.parsed.target });
      } catch (e) {
        narrateError = e instanceof Error ? e.message : String(e);
      }
      setRuns((r) => [
        ...r,
        {
          parsed: a.parsed,
          parseMeta: a.meta,
          safety: a.safety,
          hash: n?.engine_sha256 ?? null,
          verdicts: n?.verdicts ?? [],
          context: n?.context ?? null,
          failures: n?.check.failures ?? [],
          narrateMeta: n?.meta ?? null,
          narrationUnavailable: !!n?.narration_unavailable,
          narrateError,
        },
      ]);
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
  // "Same" only if every run produced a hash and they are all equal: a failed run is not agreement.
  const same = runs.length > 1 && runs.every((r) => r.hash) && hashes.size === 1;

  return (
    <section className="card ask" aria-labelledby="ask-h">
      <div className="card-head">
        <h2 id="ask-h">Ask PYRION</h2>
        <p className="muted small">
          The language model translates your question and adds context. <strong>The engine decides</strong>: the verdicts are written by
          code. The model&apos;s context is shown only if a code check binds every number, unit, id and verdict to the engine output.
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
          {r.verdicts.length > 0 && (
            <ul className="ask-verdicts">
              {r.verdicts.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          )}
          {r.context ? (
            <p className="ask-narr">{r.context}</p>
          ) : r.narrateError ? (
            <p className="small muted">Context unavailable: {r.narrateError}.</p>
          ) : r.narrationUnavailable ? (
            <p className="small muted">The model's context is unavailable right now. The verdicts above are unaffected.</p>
          ) : r.failures.length > 0 ? (
            <div className="small ask-withheld">
              <strong>Context withheld: failed the consistency check.</strong> <span className="muted">Quoted model text below is not used.</span>
              <ul>
                {r.failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="small muted ask-meta">
            Question read by <Who m={r.parseMeta} />. Context written by <Who m={r.narrateMeta} />, checked by code. Content check: {r.safety}.
            <br />
            Engine output SHA-256 (computed by the server): <code title={r.hash ?? ""}>{r.hash ? `${r.hash.slice(0, 16)}…` : "unavailable"}</code>
          </p>
        </div>
      ))}

      {runs.length > 0 && cfg && cfg.models.length > 1 && (
        <div className="ask-switch small">
          <span className="muted">Same question, another model:</span>
          {cfg.models
            .filter((m) => !runs.some((r) => r.parseMeta.model === m))
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
