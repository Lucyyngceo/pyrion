// Pure helpers of "Ask PYRION": reading the model's target, and building what the narrator may see.
// Relative .ts imports on purpose, so the unit tests can run them under `node --test`.

import { REGIME_VALUES, validateTarget, type Evaluation, type Target } from "../../engine/src/index.ts";
import type { Facts } from "./narration-check.ts";

const KPA_PER_PSI = 6.894757293168361;

export interface ParsedTarget {
  target: Target;
  assumptions: string[];
  /** Axes the question did not state. */
  unstated: string[];
}

const REGIME_KEYS = ["gravity_regime", "fuel_phase", "diluent", "flame_type"] as const;

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("the model did not return JSON");
  return JSON.parse(t.slice(start, end + 1));
}

/** Read and validate the model's reply. Throws a readable Error when it is not a valid target. */
export function parseTargetReply(reply: string): ParsedTarget {
  let raw: unknown;
  try {
    raw = extractJson(reply);
  } catch (e) {
    throw new Error(e instanceof Error && e.message.startsWith("the model") ? e.message : "the model's reply is not valid JSON");
  }
  const o = raw as { regime?: Record<string, unknown>; continuous?: Record<string, unknown>; assumptions?: unknown };
  if (o === null || typeof o !== "object" || typeof o.regime !== "object" || typeof o.continuous !== "object" || o.regime === null || o.continuous === null) {
    throw new Error("the reply lacks the regime and continuous objects");
  }
  const cont = o.continuous;
  const regime: Target["regime"] = {};
  const unstated: string[] = [];
  for (const k of REGIME_KEYS) {
    const v = o.regime[k];
    if (v === null || v === undefined) {
      unstated.push(k);
      continue;
    }
    if (typeof v !== "string" || !(REGIME_VALUES[k] ?? []).includes(v)) throw new Error(`${k}: "${String(v)}" is not an allowed value`);
    regime[k] = v;
  }
  const num = (k: string): number | null => {
    const v = cont[k];
    if (v === null || v === undefined) return null;
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${k} must be a number or null`);
    return v;
  };
  const continuous: Target["continuous"] = {};
  const o2 = num("o2_mole_fraction");
  const p = num("pressure_kpa");
  const g = num("gravity_level_g");
  if (o2 !== null) continuous.o2_mole_fraction = o2;
  else unstated.push("o2_mole_fraction");
  if (p !== null) continuous.pressure = p;
  else unstated.push("pressure");
  if (g !== null) continuous.gravity_level = g;
  const assumptions = Array.isArray(o.assumptions) ? o.assumptions.filter((a): a is string => typeof a === "string").slice(0, 8) : [];
  const target: Target = { regime, continuous };
  validateTarget(target); // throws TypeError on a malformed target
  return { target, assumptions, unstated };
}

const sig = (n: number, d = 3) => Number(n.toPrecision(d));
const ORDER = { APPLICABLE: 0, EXTRAPOLATION: 1, INSUFFICIENT_EVIDENCE: 2, REGIME_BARRIER: 3 } as const;

export interface NarrationInput {
  target: Record<string, unknown>;
  open_axes: string[];
  counts: Record<string, number>;
  top: { accession: string; acronym: string; doi: string; verdict: string; distance: number | null; reasons: string[] }[];
  note: string;
}

/** What the narrator may see: counts, the top investigations with DOI, and their decisive reasons. Nothing else. */
export function buildNarrationInput(
  evaluation: Evaluation,
  investigations: { accession: string; acronym: string; doi: string }[],
  target: Target,
  maxTop = 5,
): { input: NarrationInput; facts: Facts } {
  const inv = new Map(investigations.map((i) => [i.accession, i]));
  const clusters = new Map([...evaluation.ranked, ...evaluation.unranked].map((c) => [`${c.accession}|${c.clusterKey}`, c]));
  const rows = evaluation.investigations.toSorted(
    (a, b) =>
      ORDER[a.verdict] - ORDER[b.verdict] ||
      (clusters.get(`${a.accession}|${a.decidingCluster}`)?.rank ?? 1e9) - (clusters.get(`${b.accession}|${b.decidingCluster}`)?.rank ?? 1e9) ||
      (a.accession < b.accession ? -1 : 1),
  );
  const t = target.continuous;
  const tgt: Record<string, unknown> = { ...target.regime };
  if (t.o2_mole_fraction !== undefined) {
    tgt.o2_mole_fraction = sig(t.o2_mole_fraction, 4);
    tgt.o2_percent = sig(t.o2_mole_fraction * 100, 4);
  }
  if (t.pressure !== undefined) {
    tgt.pressure_kpa = sig(t.pressure, 4);
    tgt.pressure_psia = sig(t.pressure / KPA_PER_PSI, 3);
  }
  if (t.gravity_level !== undefined) tgt.gravity_level_g = t.gravity_level;
  const top = rows.slice(0, maxTop).map((r) => {
    const c = clusters.get(`${r.accession}|${r.decidingCluster}`);
    return {
      accession: r.accession,
      acronym: inv.get(r.accession)?.acronym ?? "",
      doi: inv.get(r.accession)?.doi ?? "",
      verdict: r.verdict,
      distance: c?.distance != null ? sig(c.distance) : null,
      reasons: (c?.reasons ?? []).filter((x) => !x.informational).slice(0, 3).map((x) => x.message),
    };
  });
  const input: NarrationInput = {
    target: tgt,
    open_axes: evaluation.openRegimeAxes,
    counts: { ...evaluation.counts.investigations },
    top,
    note: "Verdicts are computed by a deterministic engine. A transfer hypothesis for partial gravity is a separate, labelled page and is not part of this output.",
  };
  const source = JSON.stringify(input);
  return { input, facts: { ids: top.map((x) => x.accession), dois: top.map((x) => x.doi).filter(Boolean), source } };
}

/** SHA-256 (hex) of a text, where Web Crypto exists; null otherwise. */
export async function sha256Hex(text: string): Promise<string | null> {
  const s = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (!s) return null;
  const buf = await s.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
