// Allowlist check of the model's context. Pure, no imports.
// The context may only restate the target and name the axes left open. Each sentence is checked on its own and dropped
// if any word is outside a closed lexicon, any number is not a target value with the unit of its quantity, or an axis
// is said to be open when the target states it. A sentence that passes can say nothing the target does not say.

export interface ContextTarget {
  regime: Record<string, string>;
  o2_percent?: number;
  pressure_kpa?: number;
  pressure_psia?: number;
  gravity_level_g?: number;
  open_axes: string[];
}

export interface ContextResult {
  /** The sentences that passed, joined; null when none did. */
  kept: string | null;
  /** How many sentences were dropped. Their text is never shown. */
  dropped: number;
}

/** The fixed meaning of a verdict category: the only sentences about verdicts the context may contain. */
const FIXED = ["a regime barrier means not comparable, not a low score"];

const FUNCTION_WORDS = new Set(
  "the a an and or of in at to is are was were be it its this that these those with for on as by from has have had which while not left".split(" "),
);
const AXIS_WORDS = new Set(
  "oxygen o2 pressure gravity regime fuel phase diluent flame type flow velocity sample thickness temperature target condition conditions axis axes open stated unstated compared total level fraction concentration percent".split(" "),
);
const UNIT_TOKENS: Record<string, "oxygen" | "pressure" | "gravity"> = { "%": "oxygen", percent: "oxygen", psia: "pressure", psi: "pressure", kpa: "pressure", kilopascals: "pressure", g: "gravity" };
const QUANTITY_WORD: Record<string, "oxygen" | "pressure" | "gravity"> = { oxygen: "oxygen", o2: "oxygen", pressure: "pressure", gravity: "gravity" };
const AXIS_OF_WORD: Record<string, string> = { fuel: "fuel_phase", phase: "fuel_phase", diluent: "diluent", flame: "flame_type", type: "flame_type" };

const TOKEN = /(\d+(?:\.\d+)?)|(%)|([A-Za-z][A-Za-z0-9]*)/g;

function valueWords(t: ContextTarget): Set<string> {
  const w = new Set<string>();
  for (const v of Object.values(t.regime)) for (const p of v.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) w.add(p);
  const g = t.gravity_level_g;
  if (g !== undefined && Math.abs(g - 0.165) < 0.01) {
    w.add("lunar");
    w.add("moon");
  }
  if (g !== undefined && Math.abs(g - 0.38) < 0.01) w.add("mars");
  return w;
}

const sameNumber = (written: string, fact: number | undefined) => {
  if (fact === undefined) return false;
  const v = Number(written);
  const decimals = (written.split(".")[1] ?? "").length;
  return v === fact || (decimals > 0 && Number(fact.toFixed(decimals)) === v);
};

/** One sentence: null if it may stay, otherwise the reason (never shown with the model's words). */
export function sentenceProblem(sentence: string, t: ContextTarget): string | null {
  const plain = sentence.toLowerCase().replace(/[.!?;]+$/, "").replace(/\s+/g, " ").trim();
  if (FIXED.includes(plain)) return null;

  const allowedValues = valueWords(t);
  const tokens = [...sentence.matchAll(TOKEN)].map((m) => ({ num: m[1], pct: m[2], word: m[3]?.toLowerCase(), index: m.index ?? 0 }));
  if (tokens.length === 0) return "empty";

  // 1. Every word is in the closed lexicon (a unit word counts only right after a number).
  const used: { i: number; kind: "oxygen" | "pressure" | "gravity" }[] = [];
  const numbers: { i: number; text: string; unit: string }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk.num !== undefined) {
      const next = tokens[i + 1];
      const unit = next && (next.pct || (next.word && next.word in UNIT_TOKENS) ) ? (next.pct ? "%" : next.word!) : "";
      if (unit === "") return "number without a unit";
      numbers.push({ i, text: tk.num, unit });
      i++; // the unit token
      continue;
    }
    const w = tk.word!;
    if (tk.pct) return "stray percent sign";
    if (QUANTITY_WORD[w]) used.push({ i, kind: QUANTITY_WORD[w] });
    // "partial" is allowed only as "partial gravity": never "oxygen partial pressure".
    if (w === "partial" && tokens[i + 1]?.word !== "gravity") return "partial is not followed by gravity";
    if (FUNCTION_WORDS.has(w) || AXIS_WORDS.has(w) || allowedValues.has(w)) continue;
    return "word outside the lexicon";
  }

  // 2. Each number is a target value with the unit of its quantity, and agrees with the quantity word beside it.
  const claimed = new Set<number>();
  for (const n of numbers) {
    const unitKind = UNIT_TOKENS[n.unit === "%" ? "%" : n.unit];
    const fact = unitKind === "oxygen" ? t.o2_percent : unitKind === "gravity" ? t.gravity_level_g : n.unit === "psia" || n.unit === "psi" ? t.pressure_psia : t.pressure_kpa;
    if (!sameNumber(n.text, fact)) return "number is not a target value in that unit";
    // nearest unclaimed quantity word within three tokens, either side
    let best: { d: number; kind: string; at: number } | null = null;
    for (const u of used) {
      if (claimed.has(u.i)) continue;
      const d = Math.abs(u.i - n.i);
      if (d <= 3 && (!best || d < best.d)) best = { d, kind: u.kind, at: u.i };
    }
    if (best) {
      if (best.kind !== unitKind) return "number does not belong to the quantity named beside it";
      claimed.add(best.at);
    }
  }

  // 3. An axis said to be open or left out must be open in the target.
  const saysOpen = tokens.some((tk) => tk.word === "open" || tk.word === "unstated" || tk.word === "left");
  if (saysOpen) {
    const named = new Set(tokens.flatMap((tk) => (tk.word && AXIS_OF_WORD[tk.word] ? [AXIS_OF_WORD[tk.word]] : [])));
    for (const axis of named) if (!t.open_axes.includes(axis)) return "an axis is called open but the target states it";
  }
  return null;
}

/** Keep the sentences that pass; drop the rest. The model's context is shown only through this. */
export function checkContext(text: string, t: ContextTarget, maxWords = 60): ContextResult {
  const sentences = text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const kept: string[] = [];
  let dropped = 0;
  let words = 0;
  for (const s of sentences) {
    const w = s.split(/\s+/).length;
    if (sentenceProblem(s, t) === null && words + w <= maxWords) {
      kept.push(s);
      words += w;
    } else dropped++;
  }
  return { kept: kept.length ? kept.join(" ") : null, dropped };
}
