// Pure helpers of "Ask PYRION": reading the model's target, and building what the narrator may see.
// Relative .ts imports on purpose, so the unit tests can run them under `node --test`.

import { targetFromQuantities, type Evaluation, type Target, type TargetQuantities } from "../../engine/src/index.ts";
import type { Facts } from "./narration-check.ts";

const KPA_PER_PSI = 6.894757293168361;

export interface ParsedTarget {
  target: Target;
  assumptions: string[];
  /** Axes the question did not state. */
  unstated: string[];
  /** Unit conversions done by the engine, for display: "8.2 psia → 56.54 kPa (×6.894757)". */
  conversions: string[];
  /** Engine notes and plausibility warnings about the values. */
  warnings: string[];
}

const QUANTITY_KEYS = ["gravity", "o2", "pressure", "flow_velocity", "sample_thickness", "ambient_temperature"] as const;
const REGIME_KEYS = ["gravity_regime", "fuel_phase", "diluent", "flame_type"] as const;

function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("the model did not return JSON");
  return JSON.parse(t.slice(start, end + 1));
}

/**
 * Read the model's reply (quantities as written) and let the engine convert and validate them.
 * The model never outputs a converted number. Throws a readable Error when the reply cannot become a target.
 */
export function parseTargetReply(reply: string): ParsedTarget {
  let raw: unknown;
  try {
    raw = extractJson(reply);
  } catch (e) {
    throw new Error(e instanceof Error && e.message.startsWith("the model") ? e.message : "the model's reply is not valid JSON");
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new Error("the reply is not a JSON object");
  const o = raw as Record<string, unknown>;
  const input: Record<string, string> = {};
  const unstated: string[] = [];
  for (const k of [...QUANTITY_KEYS, ...REGIME_KEYS]) {
    const v = o[k];
    if (v === null || v === undefined || v === "") {
      unstated.push(k === "o2" ? "o2_mole_fraction" : k);
      continue;
    }
    if (typeof v !== "string") throw new Error(`${k} must be text as written in the question, or null`);
    input[k] = v;
  }
  const r = targetFromQuantities(input as TargetQuantities);
  if (!r.ok) throw new Error(r.errors.map((e) => `${e.field}: ${e.message}`).join("; "));
  const assumptions = Array.isArray(o.assumptions) ? o.assumptions.filter((a): a is string => typeof a === "string").slice(0, 8) : [];
  return {
    target: r.target,
    assumptions,
    unstated,
    conversions: r.conversions.map((c) => c.display),
    warnings: r.conversions.flatMap((c) => [...c.notes, ...c.warnings]),
  };
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
