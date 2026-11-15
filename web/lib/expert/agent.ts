// The expert chat agent: a model that calls tools, and code that decides what of its answer may be shown.
// Pure (no fs, no network): the model call and the data come in through `AgentEnv`, so the tests run it with stubs.
//
// The model never decides a verdict and never does arithmetic: verdicts come from engine tools, numbers from calculators or
// verified quotes. Its final answer is a list of layered blocks; checkAnswer keeps only what survives.

import { ENGINE_NAME, ENGINE_VERSION, evaluate, evidenceMap, experimentsNeeded, parseQuantity, routesToEvidence, targetFromQuantities, threePartAnswer, type ConditionRecord, type Target, type TargetQuantities } from "../../../engine/src/index.ts";
import { axisLabel, valueLabel, verdictLabel, levelSentence } from "../../../engine/src/labels.ts";
import { readByCode } from "../ask-core.ts";
import { detectLang, languageInstruction } from "../tars/lang.ts";
import { searchTopics, MIN_SCORE, type Topic } from "../tars/help.ts";
import { CALCULATOR_SPECS, runCalculator, type ToolResult } from "./calculators.ts";
import { checkAnswer, quoteFound, ENGINE_LABEL, type Corpus, type CheckResult, type KeptBlock } from "./claims.ts";
import { ensureTarget } from "./condition.ts";

export interface Inv {
  accession: string;
  acronym: string;
  title: string;
  doi: string;
}

export interface Passage {
  doc_id: string;
  page_start: number;
  page_end: number;
  title: string;
  url: string;
  text: string;
}

export interface LibraryLike {
  search(query: string, top?: number): Promise<Passage[]>;
  page(doc_id: string, page: number): { text: string; title?: string; url?: string; file_url?: string } | undefined;
  corpus: Corpus;
}

/** What the client says about the page the visitor is on. Sent with each message. */
export interface UiContext {
  route?: string;
  panels?: string[];
  target?: unknown;
  selectedTile?: string | null;
  lastResult?: string | null;
}

export interface AgentEnv {
  records: readonly ConditionRecord[];
  investigations: readonly Inv[];
  library: LibraryLike | null;
  topics: readonly Topic[];
  /** One model turn: messages and tools in, the assistant message out. Throws if no model can answer. */
  chat: (messages: ChatMsg[], tools: ToolDef[] | undefined) => Promise<AssistantMsg>;
  /** Called as the agent works, for the status line ("Checking the engine…"). */
  onStatus?: (text: string) => void;
}

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}
export interface ToolCall {
  id: string;
  type?: "function";
  function: { name: string; arguments: string };
}
export interface AssistantMsg {
  content: string | null;
  tool_calls?: ToolCall[];
}
export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export type Action = { type: "show"; target: Target } | { type: "highlight"; selector: string; label: string };

export interface AgentState {
  target: Target | null;
  /** Engine outputs by id, for the claim checker. */
  engine: Record<string, unknown>;
  tools: Record<string, ToolResult>;
  actions: Action[];
  steps: { tool: string; label: string }[];
  counter: number;
}

export const MAX_ROUNDS = 6;

/** Elements the chat may point at. */
export const HIGHLIGHTS: Record<string, { selector: string; label: string }> = {
  scenario_tiles: { selector: ".scenario-strip", label: "the four scenario tiles" },
  evidence_list: { selector: ".nav-evidence", label: "Where the evidence is" },
  chart: { selector: ".chart-card", label: "the evidence envelope chart" },
  verdict_ring: { selector: ".vring", label: "the verdict ring" },
  add_source: { selector: ".add-source-btn", label: "the Add a source button" },
  ask_box: { selector: "#ask-q", label: "the Ask box" },
  full_screen: { selector: ".fs-btn", label: "the Full screen button" },
  controls: { selector: ".nav-left", label: "the controls on the left" },
};

const STATUS: Record<string, string> = {
  set_condition: "Reading the condition…",
  evaluate_condition: "Checking the engine…",
  three_part_answer: "Checking the engine…",
  routes_to_evidence: "Looking for routes to evidence…",
  what_would_close_the_gap: "Working out what would close the gap…",
  search_nasa_library: "Searching NASA documents…",
  get_page: "Reading a NASA page…",
  run_calculator: "Calculating…",
  describe_ui: "Looking at the page…",
  show_on_envelope: "Preparing the envelope…",
  highlight: "Preparing the highlight…",
  what_if_experiment: "Simulating the experiment (hypothetical)…",
};

const calcNames = Object.keys(CALCULATOR_SPECS);

export const TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "set_condition",
      description:
        'Read a condition from words (oxygen %, pressure with unit, gravity) by code and make it the current target. Pass based_on_previous: true for a follow-up ("and at 25 %?") so only the stated quantities change and everything else stays.',
      parameters: { type: "object", properties: { text: { type: "string" }, based_on_previous: { type: "boolean" } }, required: ["text"] },
    },
  },
  { type: "function", function: { name: "evaluate_condition", description: "Engine verdicts for the current target: counts and the investigations with their verdict and extrapolation level. The only source of verdicts.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "three_part_answer", description: "The engine's known / unknown / next for the current target, with receipts.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "routes_to_evidence", description: "The smallest changes to the current target that would make investigations comparable.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "what_would_close_the_gap", description: "The engine's experiments-needed plan for the current target (a PYRION proposal, not a NASA plan).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "search_nasa_library", description: "Search the NASA library (507 documents) and return passages with doc_id, page, title and url. Quote from them exactly.", parameters: { type: "object", properties: { query: { type: "string" }, top: { type: "number" } }, required: ["query"] } } },
  { type: "function", function: { name: "get_page", description: "The full text of one page of a NASA document, to quote from.", parameters: { type: "object", properties: { doc_id: { type: "string" }, page: { type: "number" } }, required: ["doc_id", "page"] } } },
  {
    type: "function",
    function: {
      name: "run_calculator",
      description: `Deterministic arithmetic. NEVER calculate yourself. Calculators: ${calcNames.join(", ")}. ${Object.values(CALCULATOR_SPECS).join(" ")}`,
      parameters: { type: "object", properties: { name: { type: "string", enum: calcNames }, args: { type: "object" } }, required: ["name", "args"] },
    },
  },
  {
    type: "function",
    function: {
      name: "what_if_experiment",
      description:
        "What if this experiment were run? Adds ONE HYPOTHETICAL test (never saved, never a measurement) to the records in memory and reports how the verdict counts and the evidence map would change for the current target. Always call it a hypothetical.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "A short name for the experiment, e.g. 'PMMA rod at 34 % O2, 8.2 psia, lunar gravity'" },
          gravity_regime: { type: "string", enum: ["microgravity", "partial_gravity", "normal_gravity"] },
          fuel_phase: { type: "string", enum: ["solid", "liquid", "gas"] },
          diluent: { type: "string" },
          flame_type: { type: "string", enum: ["normal", "inverse"] },
          o2: { type: "string", description: 'oxygen as written, e.g. "34 %"' },
          pressure: { type: "string", description: 'total pressure WITH its unit, e.g. "8.2 psia"' },
        },
        required: ["label", "gravity_regime", "fuel_phase", "o2", "pressure"],
      },
    },
  },
  { type: "function", function: { name: "describe_ui", description: "What the page the visitor is on shows, and the help topics about the parts of this site.", parameters: { type: "object", properties: { topic: { type: "string" } } } } },
  { type: "function", function: { name: "show_on_envelope", description: "Offer the visitor a button that loads the current target into the dashboard.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "highlight", description: `Offer a button that highlights a part of the page. element is one of: ${Object.keys(HIGHLIGHTS).join(", ")}.`, parameters: { type: "object", properties: { element: { type: "string", enum: Object.keys(HIGHLIGHTS) } }, required: ["element"] } } },
];

export const SYSTEM_PROMPT = `You are TARS (Traceable Applicability Reasoning System), an expert in spacecraft fire safety and combustion science working inside PYRION, a tool that ranks NASA PSI combustion investigations by how well they apply to a condition. Talk like a knowledgeable colleague: direct, clear, no filler.

Scope: combustion and fire safety in space, cabin atmospheres, materials flammability, missions and NASA documents, and how this app works. Politely decline anything unrelated, and anything harmful (for example how to start a fire to hurt people).

Hard rules (code enforces them):
1. Never do arithmetic. For any partial pressure, unit conversion or atmosphere comparison, call run_calculator and use its numbers.
2. Verdicts (applicable, extrapolation, insufficient evidence, not comparable) come only from the engine tools. Say "in PSI", never "no data exists".
3. Facts from NASA documents need an exact quote from a page you found with search_nasa_library or get_page, with doc_id and page.
4. Copy every number EXACTLY as it appears in a tool result: never round it, never convert it, never restate an input (such as a pressure the visitor typed) unless it appears in that result. If you need another figure, call the calculator again.
5. Gravity levels and every other figure come from run_calculator (gravityValue for Moon, Mars, Earth) or a verified quote. Do not number points with digits such as (1) or 2.: use bullets or words, because a digit with no source is removed.
6. Your own reasoning is the expert layer; it is labelled "not verified against a source". Any number in it must come from a tool result or a quote, or the code removes it.

A question that asks what would happen, why, or to explain MUST be answered with an expert block that explains the physics in your own words (what raises or lowers flammability and why, what changes without buoyancy, what is uncertain). Engine blocks alone are not an answer to it. For physics questions the library has already been searched: include a nasa block with an exact quote whenever a passage matches. Use plain words: never write verdict codes or snake_case names.

When the visitor gives a condition, call set_condition first; for a follow-up like "and at 25 %?" call it with based_on_previous: true so only the stated change applies. For "what if we ran this experiment?" questions call what_if_experiment and always say the result is hypothetical, not a measurement. Use show_on_envelope when the visitor may want to see the condition on the dashboard, and highlight to point at parts of the page.

Final answer: ONLY a JSON array of blocks, no other text:
[{"layer":"engine"|"nasa"|"expert","text":"...","citations":[{"doc_id":"...","page":1,"quote":"exact words from the page"}],"toolRefs":["t1"]}]
- engine blocks restate engine tool output or a calculator result and list its "ref" in toolRefs.
- nasa blocks carry citations (exact quotes) and paraphrase them.
- expert blocks are your explanation; list the "ref" of any tool whose numbers you use.
Keep it as short as a good answer allows. Write in the visitor's language.`;

const VERDICT_CODES: Record<string, string> = {
  APPLICABLE: "applicable",
  EXTRAPOLATION: "extrapolation",
  INSUFFICIENT_EVIDENCE: "insufficient evidence",
  REGIME_BARRIER: "not comparable (different regime)",
};

/** Raw engine codes never reach a reader: verdict codes and snake_case names become the engine's plain labels. Quotes are not touched (they are not in `text`). */
export function plainify(text: string): string {
  return text
    .replace(/\b[A-Z]{2,}(?:_[A-Z0-9]+)+\b/g, (m) => VERDICT_CODES[m] ?? m.toLowerCase().replaceAll("_", " "))
    .replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g, (m) => {
      const v = valueLabel(m);
      if (v !== m) return v;
      const a = axisLabel(m);
      return a !== m.replaceAll("_", " ") ? a : m.replaceAll("_", " ");
    });
}

/** A "what would happen / why / explain" question must end with an explanation, not only with engine facts. */
export function isExplanatory(message: string): boolean {
  return /\b(what (would|will|could) (happen|occur)|what happens|why\b|how (does|do|would|come|can)|explain|what is the physics|what to expect|what.?s going on)\b/i.test(message) || /(?<![\p{L}])(qué (pasaría|pasa|ocurriría|ocurre|sucedería|esperar)|por qué|cómo (funciona|sería|puede|podría|se)|explic\p{L}*)(?![\p{L}])/iu.test(message);
}

/** A "what if we burned / ran / tested …" question, in English or Spanish. The language never changes which tools run. */
export function isWhatIf(message: string): boolean {
  return /\b(what if|what would happen if|if we (burn|burned|ran|run|test|tested|light|lit|were to))\b/i.test(message) || /(?<![\p{L}])(si (quemáramos|quemamos|probáramos|probamos|hiciéramos|hacemos|encendiéramos|corriéramos|ejecutáramos)|qué pasaría si|y si (quemamos|probamos|hacemos))(?![\p{L}])/iu.test(message);
}

/** The fuel phase a message names (by word, never guessed): null when it names none. */
export function fuelPhaseOf(message: string): "solid" | "liquid" | "gas" | null {
  if (/\b(pmma|plexiglas|polymethyl|cellulose|paper|foam|fabric|nomex|teflon|silicone|polyethylene|sample|rod|slab|solid|sólido|solido|papel|espuma|tela)\b/i.test(message)) return "solid";
  if (/\b(heptane|ethanol|methanol|decane|droplet|droplets|liquid|líquido|liquido|gota|gotas)\b/i.test(message)) return "liquid";
  if (/\b(methane|propane|ethylene|hydrogen|gas|gaseous|gaseoso|metano|propano)\b/i.test(message)) return "gas";
  return null;
}

function targetSummary(t: Target) {
  const c = t.continuous;
  return {
    regime: Object.fromEntries(Object.entries(t.regime).map(([k, v]) => [axisLabel(k), valueLabel(String(v))])),
    o2_percent: c.o2_mole_fraction !== undefined ? Number((c.o2_mole_fraction * 100).toPrecision(4)) : undefined,
    pressure_kpa: c.pressure !== undefined ? Number(c.pressure.toPrecision(4)) : undefined,
    pressure_psia: c.pressure !== undefined ? Number((c.pressure / 6.894757293168361).toPrecision(3)) : undefined,
    gravity_level_g: t.informational?.gravity_level,
  };
}

const cap = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Merge a follow-up's stated quantities into the previous target: only what was said changes. */
export function mergeTargets(prev: Target, next: Target): Target {
  return {
    regime: { ...prev.regime, ...next.regime },
    continuous: { ...prev.continuous, ...next.continuous },
    ...(prev.informational || next.informational ? { informational: { ...prev.informational, ...next.informational } } : {}),
  };
}

/** One hypothetical test as engine records. In memory only: it is never written anywhere. */
export function hypotheticalRecords(x: { gravity_regime: string; fuel_phase: string; diluent?: string; flame_type?: string; o2: number; pressureKpa: number }): ConditionRecord[] {
  const base = { accession: "HYPOTHETICAL", test_id: "what-if-1", method: "document" as const, source_file: "hypothetical", source_location: "what-if", quote: "hypothetical experiment, not a measurement", status: "extracted" as const, note: "HYPOTHETICAL: not a measurement", unit_original: "" };
  const rows: [string, string, string][] = [
    ["o2_mole_fraction", String(x.o2), "1"],
    ["pressure", String(x.pressureKpa), "kPa"],
    ["gravity_regime", x.gravity_regime, ""],
    ["fuel_phase", x.fuel_phase, ""],
    ...(x.diluent ? ([["diluent", x.diluent, ""]] as [string, string, string][]) : []),
    ...(x.flame_type ? ([["flame_type", x.flame_type, ""]] as [string, string, string][]) : []),
  ];
  return rows.map(([variable, value, unit], i) => ({ ...base, variable, value, unit, value_original: value, origin: { file: "hypothetical", line: i + 2 } }));
}

export function newState(target: Target | null = null): AgentState {
  return { target, engine: {}, tools: {}, actions: [], steps: [], counter: 0 };
}

const ref = (s: AgentState) => `t${++s.counter}`;

/** Run one tool. Always returns a JSON-able object for the model; an error is a field, never a throw. */
export async function executeTool(name: string, args: Record<string, unknown>, env: AgentEnv, s: AgentState, ui: UiContext = {}): Promise<Record<string, unknown>> {
  const need = (): Target | null => s.target;
  const noTarget = { error: "There is no current condition. Call set_condition first with the oxygen %, the pressure with its unit and the gravity." };
  s.steps.push({ tool: name, label: STATUS[name] ?? name });
  try {
    switch (name) {
      case "set_condition": {
        const text = String(args.text ?? "");
        let r = readByCode(text);
        // "and at 25 %?": a lone percentage in a follow-up is the oxygen level.
        const pct = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)];
        if (r.kind === "model" && args.based_on_previous && s.target && pct.length === 1 && (text.match(/\d+(?:[.,]\d+)?/g) ?? []).length === 1) r = readByCode(`${pct[0][1]} % oxygen`);
        if (r.kind === "issue") return { error: r.message };
        // A follow-up ("and at 25 %?") has leftover words but clear quantities: read those by code and change only them.
        if (r.kind === "model" && args.based_on_previous && s.target && Object.keys(r.extracted).length > 0) {
          const q = targetFromQuantities(r.extracted as TargetQuantities);
          if (q.ok) {
            s.target = mergeTargets(s.target, q.target);
            return { ref: ref(s), current_target: targetSummary(s.target), merged_with_previous: true, conversions: q.conversions.map((c) => c.display) };
          }
          return { error: q.errors.map((e) => e.message).join(" ") };
        }
        if (r.kind === "model") return { error: "Code could not read a complete condition from that text. Ask the visitor for oxygen as a percentage, the pressure with its unit (psia or kPa) and the gravity." };
        const prev = s.target;
        const target = args.based_on_previous && prev ? mergeTargets(prev, r.parsed.target) : r.parsed.target;
        s.target = target;
        return { ref: ref(s), current_target: targetSummary(target), merged_with_previous: !!(args.based_on_previous && prev), conversions: r.parsed.conversions };
      }
      case "evaluate_condition": {
        const t = need();
        if (!t) return noTarget;
        const ev = evaluate(env.records, t);
        const inv = new Map(env.investigations.map((i) => [i.accession, i]));
        const out = {
          counts: Object.fromEntries(Object.entries(ev.counts.investigations).map(([k, v]) => [verdictLabel(k as never), v])),
          investigations: ev.investigations.slice(0, 40).map((i) => ({ accession: i.accession, acronym: inv.get(i.accession)?.acronym, doi: inv.get(i.accession)?.doi, verdict: verdictLabel(i.verdict), level: i.extrapolationLevel ? levelSentence(i.extrapolationLevel) : undefined })),
          regimeUntested: ev.regimeUntested ? { gravity: valueLabel(ev.regimeUntested.value), testedOnly: ev.regimeUntested.testedValues.map(valueLabel) } : undefined,
        };
        const id = ref(s);
        s.engine[id] = out;
        return { ref: id, ...out };
      }
      case "three_part_answer": {
        const t = need();
        if (!t) return noTarget;
        const catalog = Object.fromEntries(env.investigations.map((i) => [i.accession, { acronym: i.acronym, title: i.title, doi: i.doi }]));
        const a = threePartAnswer(env.records, t, { mode: "advanced", catalog });
        const out = { known: a.known.map((k) => k.sentence), unknown: a.unknown.map((u) => u.sentence), next: a.next.map((n) => n.sentence), fingerprint: a.fingerprint };
        const id = ref(s);
        s.engine[id] = out;
        return { ref: id, ...out };
      }
      case "routes_to_evidence": {
        const t = need();
        if (!t) return noTarget;
        const r = routesToEvidence(env.records, t);
        const out = { routes: r.routes.slice(0, 5).map((x) => ({ accession: x.accession, kind: x.kind, sentence: x.sentence })), withoutRoute: r.unreachable.length };
        const id = ref(s);
        s.engine[id] = out;
        return { ref: id, ...out };
      }
      case "what_would_close_the_gap": {
        const t = need();
        if (!t) return noTarget;
        const x = experimentsNeeded(env.records, t);
        const out = { label: "PYRION proposal (a testable plan, not a NASA plan)", gap: x.gap.sentence, testPoints: x.testMatrix.pointCount, matrix: x.testMatrix.sentence, solidsFirst: x.solidsRationale.sentence, remaining: x.remainingGap.sentence, priority: x.priority.map((p) => p.sentence) };
        const id = ref(s);
        s.engine[id] = out;
        return { ref: id, ...out };
      }
      case "search_nasa_library": {
        if (!env.library) return { error: "The NASA library is not available on this server." };
        const hits = await env.library.search(String(args.query ?? ""), Math.min(Number(args.top) || 5, 8));
        const terms = new Set(String(args.query ?? "").toLowerCase().match(/[a-z0-9]{4,}/g) ?? []);
        return {
          note: "Quote only a usable_quote or text copied exactly from inside ONE page (at most 200 characters), with that page number.",
          passages: hits.map((h) => {
            // A sentence of the first page of the passage that shares the most words with the question, checked to be on that page word for word.
            const page = env.library?.page(h.doc_id, h.page_start);
            let usable: string | undefined;
            if (page) {
              const sentences = page.text.split(/(?<=[.!?])\s+/).map((x) => x.replace(/\s+/g, " ").trim()).filter((x) => x.length >= 40 && x.length <= 220);
              const score = (x: string) => (x.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((w) => terms.has(w)).length;
              const best = sentences.toSorted((a, b) => score(b) - score(a))[0];
              if (best && score(best) > 0 && quoteFound(best, page.text)) usable = best;
            }
            return { doc_id: h.doc_id, page: h.page_start, title: h.title, url: h.url, ...(usable ? { usable_quote: usable } : {}), text: cap(h.text, 600) };
          }),
        };
      }
      case "get_page": {
        if (!env.library) return { error: "The NASA library is not available on this server." };
        const p = env.library.page(String(args.doc_id ?? ""), Number(args.page));
        return p ? { doc_id: args.doc_id, page: args.page, title: p.title, text: cap(p.text, 3500) } : { error: "No such page in the library." };
      }
      case "run_calculator": {
        const r = runCalculator(String(args.name ?? ""), (args.args ?? {}) as Record<string, unknown>);
        const id = ref(s);
        s.tools[id] = r;
        // A calculator is code too: an engine block may restate its result.
        if (r.ok) s.engine[id] = { display: r.display, value: r.value, unit: r.unit, also: r.also, numbers: r.numbers };
        return r.ok ? { ref: id, result: r.display, provenance: r.provenance } : { ref: id, error: r.message };
      }
      case "what_if_experiment": {
        const o2 = parseQuantity(String(args.o2 ?? ""), "o2_mole_fraction");
        const pr = parseQuantity(String(args.pressure ?? ""), "pressure");
        if (!o2.ok) return { error: o2.message };
        if (!pr.ok) return { error: pr.message };
        const label = String(args.label ?? "hypothetical experiment").slice(0, 120);
        const hypo = hypotheticalRecords({ gravity_regime: String(args.gravity_regime), fuel_phase: String(args.fuel_phase), diluent: args.diluent ? String(args.diluent) : undefined, flame_type: args.flame_type ? String(args.flame_type) : undefined, o2: o2.value, pressureKpa: pr.value });
        const t: Target = s.target ?? { regime: { gravity_regime: String(args.gravity_regime) as never }, continuous: { o2_mole_fraction: o2.value, pressure: pr.value } };
        // A grid centred on the experiment's own point (odd node count), so the single hypothetical point is a node of the map.
        const grid = { o2: [Math.max(0.01, o2.value - 0.1), Math.min(1, o2.value + 0.1), 41] as [number, number, number], pressure: [pr.value * 0.6, pr.value * 1.4, 41] as [number, number, number] };
        const cells = (recs: readonly ConditionRecord[]) => evidenceMap(recs, t.regime, grid).cells.filter((c) => c.applicable.length > 0).length;
        const countsOf = (recs: readonly ConditionRecord[]) => evaluate(recs, t).counts.investigations;
        const out = {
          hypothetical: true,
          label: `HYPOTHETICAL: ${label}. Not a measurement; never saved to the data.`,
          target: targetSummary(t),
          before: { ...countsOf(env.records), mapCellsWithApplicableEvidence: cells(env.records) },
          after: { ...countsOf([...env.records, ...hypo]), mapCellsWithApplicableEvidence: cells([...env.records, ...hypo]) },
        };
        const id = ref(s);
        s.engine[id] = out;
        return { ref: id, ...out };
      }
      case "describe_ui": {
        const hits = searchTopics(env.topics, String(args.topic ?? ui.route ?? "what is this"), 3).filter((h) => h.score >= MIN_SCORE);
        return { page: ui, topics: hits.map((h) => ({ id: h.topic.id, title: h.topic.title, body: cap(h.topic.body, 900) })) };
      }
      case "show_on_envelope": {
        const t = need();
        if (!t) return noTarget;
        s.actions.push({ type: "show", target: t });
        return { ok: true, note: "The visitor will see a Show on the envelope button." };
      }
      case "highlight": {
        const h = HIGHLIGHTS[String(args.element)];
        if (!h) return { error: `Unknown element. Use one of: ${Object.keys(HIGHLIGHTS).join(", ")}.` };
        s.actions.push({ type: "highlight", selector: h.selector, label: h.label });
        return { ok: true, note: `The visitor will see a button that highlights ${h.label}.` };
      }
      default:
        return { error: `Unknown tool "${name}".` };
    }
  } catch (e) {
    return { error: `The tool failed: ${e instanceof Error ? e.message : "error"}` };
  }
}

/** The model's final text -> blocks. Tolerates fences and an object wrapper; anything else becomes one expert block (the checker still applies). */
export function parseBlocks(content: string): unknown {
  const text = content.trim();
  const a = text.indexOf("[");
  const b = text.lastIndexOf("]");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(text.slice(a, b + 1));
    } catch {
      /* fall through */
    }
  }
  const o = text.indexOf("{");
  const c = text.lastIndexOf("}");
  if (o >= 0 && c > o) {
    try {
      const x = JSON.parse(text.slice(o, c + 1)) as { blocks?: unknown };
      if (Array.isArray(x.blocks)) return x.blocks;
    } catch {
      /* fall through */
    }
  }
  return [{ layer: "expert", text }];
}

export interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AgentResult extends CheckResult {
  steps: { tool: string; label: string }[];
  actions: Action[];
  target: Target | null;
  rounds: number;
  /** The language of the visitor's message, for the labels of the answer. */
  lang: string;
  /** The engine's verdict counts at the target (codes), when a condition was evaluated. */
  engineCounts?: Record<string, number>;
  /** Problems found reading the condition (gauge pressure, a number that is not a pressure…), in plain words. */
  conditionIssues?: string[];
}

export async function runAgent(
  env: AgentEnv,
  input: { message: string; history?: HistoryTurn[]; lastTarget?: Target | null; ui?: UiContext },
): Promise<AgentResult> {
  const s = newState(input.lastTarget ?? null);
  const ui = input.ui ?? {};
  const lang = detectLang(input.message);
  // A complete condition in the message is the target, whether or not the model calls set_condition.
  // ensureTarget reads the message by code (a follow-up merges into the last target) before the model runs.
  const cond = ensureTarget(s, input.message);
  const conditionStated = cond.source === "question" || cond.source === "follow_up";
  const system = `${SYSTEM_PROMPT}${languageInstruction(lang) ? `\n\n${languageInstruction(lang)}` : ""}\n\nPage context (from the visitor's browser): ${cap(JSON.stringify(ui), 1500)}\nPrevious target: ${s.target ? JSON.stringify(targetSummary(s.target)) : "none"}`;
  const messages: ChatMsg[] = [{ role: "system", content: system }, ...(input.history ?? []).slice(-8).map((h) => ({ role: h.role, content: cap(h.text, 1200) }) as ChatMsg), { role: "user", content: input.message }];
  // For explanations the NASA library is searched first, so the model sees the passages and a verified quote is always possible.
  const explain = isExplanatory(input.message);
  let passagesFound = false;
  // "What if we burned X at this condition?": the hypothetical experiment runs by code, in any language, so the model only explains it.
  // In a what-if, a lone percentage the extractor left over ("al 30 % y 10,2 psia") is the oxygen level.
  if (isWhatIf(input.message) && s.target && s.target.continuous.o2_mole_fraction === undefined && cond.leftover.length === 1) {
    const m = /^(\d+(?:[.,]\d+)?)\s*%$/.exec(cond.leftover[0].trim());
    if (m) s.target = { ...s.target, continuous: { ...s.target.continuous, o2_mole_fraction: Number(m[1].replace(",", ".")) / 100 } };
  }
  if (isWhatIf(input.message) && s.target && s.target.continuous.o2_mole_fraction !== undefined && s.target.continuous.pressure !== undefined) {
    const phase = fuelPhaseOf(input.message) ?? (s.target.regime.fuel_phase as "solid" | "liquid" | "gas" | undefined) ?? null;
    if (phase) {
      const args = { label: cap(input.message, 100), gravity_regime: String(s.target.regime.gravity_regime ?? "partial_gravity"), fuel_phase: phase, o2: `${Number((s.target.continuous.o2_mole_fraction * 100).toPrecision(4))} %`, pressure: `${Number(s.target.continuous.pressure.toPrecision(6))} kPa` };
      const out = await executeTool("what_if_experiment", args, env, s, ui);
      messages.push({ role: "assistant", content: null, tool_calls: [{ id: "pre-whatif", type: "function", function: { name: "what_if_experiment", arguments: JSON.stringify(args) } }] });
      messages.push({ role: "tool", tool_call_id: "pre-whatif", content: JSON.stringify(out) });
    }
  }
  if (explain && env.library) {
    const out = await executeTool("search_nasa_library", { query: input.message, top: 5 }, env, s, ui);
    passagesFound = Array.isArray(out.passages) && out.passages.length > 0;
    messages.push({ role: "assistant", content: null, tool_calls: [{ id: "pre-search", type: "function", function: { name: "search_nasa_library", arguments: JSON.stringify({ query: input.message, top: 5 }) } }] });
    messages.push({ role: "tool", tool_call_id: "pre-search", content: JSON.stringify(out) });
  }
  let content = "";
  let rounds = 0;
  for (; rounds < MAX_ROUNDS; rounds++) {
    // The last round has no tools: the model must answer with what it has.
    const last = rounds === MAX_ROUNDS - 1;
    // The last round has no tools: say so, or some models keep writing tool calls as text.
    if (last && rounds > 0) messages.push({ role: "user", content: "No more tool calls are possible. Answer now, only with the JSON array of blocks, using what the tools returned." });
    const msg = await env.chat(messages, last ? undefined : TOOLS);
    if (msg.tool_calls?.length && !last) {
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        env.onStatus?.(STATUS[call.function.name] ?? "Working…");
        const out = await executeTool(call.function.name, args, env, s, ui);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(out) });
      }
      continue;
    }
    content = msg.content ?? "";
    break;
  }
  const empty: Corpus = { get: () => undefined, hasDocument: () => false };
  const check = (text: string) => checkAnswer(parseBlocks(text), { corpus: env.library?.corpus ?? empty, engine: s.engine, tools: s.tools });
  // Tool-call markup written as text is not an answer.
  const leaked = /<tool_call|<function=|<\/?parameter/i.test(content);
  let checked: CheckResult = leaked ? { kept: [], report: { dropped: [{ index: -1, layer: "answer", reason: "tool_call_text" }], flaggedNumbers: [], verifiedCitations: [] } } : check(content);
  // One repair round for everything the rules found missing: an answer withheld, no explanation for an explanatory question, no NASA quote
  // although the library has a matching passage.
  const missing = (c: CheckResult): string[] => {
    const out: string[] = [];
    if (c.kept.length === 0 && c.report.dropped.length > 0) out.push(`the code withheld your answer: ${c.report.dropped.map((d) => `${d.layer} block: ${d.reason}${d.detail ? ` (${d.detail})` : ""}`).join("; ")}`);
    if (explain && !c.kept.some((k) => k.layer === "expert")) out.push("the question asks for an explanation and your answer has no expert block that explains it");
    if (passagesFound && !c.kept.some((k) => k.layer === "nasa")) out.push("the NASA library returned matching passages but your answer has no nasa block with an exact quote and its doc_id and page");
    return out;
  };
  let problems = leaked ? ["you wrote tool-call text instead of the JSON answer"] : missing(checked);
  if (problems.length > 0 && (content || leaked)) {
    const refs = [...Object.keys(s.engine), ...Object.keys(s.tools)].filter((v, i, a) => a.indexOf(v) === i);
    messages.push({ role: "assistant", content: leaked ? "(tool call)" : content });
    messages.push({
      role: "user",
      content: `Fix this and answer again, only with the JSON array: ${problems.join("; ")}. Every number must be copied exactly, without rounding, from a tool result you list in toolRefs (available refs: ${refs.join(", ") || "none"}) or from a verified quote. Put what you cannot support in an expert block without numbers.`,
    });
    try {
      const again = await env.chat(messages, undefined);
      rounds++;
      if (again.content && !/<tool_call|<function=|<\/?parameter/i.test(again.content)) {
        const second = check(again.content);
        // keep the repaired answer when it is better than the first
        if (second.kept.length >= checked.kept.length) checked = second;
      }
    } catch {
      /* the first result stands */
    }
    problems = missing(checked);
  }
  // Raw codes never reach the reader, whatever the layer.
  checked = { ...checked, kept: checked.kept.map((k) => ({ ...k, text: plainify(k.text) })) };
  // Whenever a condition was stated (or changed) the answer carries the engine's verdict counts: if the model left them out, code adds them.
  const evaluated = conditionStated || s.steps.some((x) => x.tool === "set_condition" || x.tool === "evaluate_condition");
  let engineCounts: Record<string, number> | undefined;
  if (s.target && evaluated && Object.keys(env.records).length > 0) {
    const ev = evaluate(env.records, s.target);
    engineCounts = Object.fromEntries(Object.entries(ev.counts.investigations)) as Record<string, number>;
    if (!checked.kept.some((k) => k.layer === "engine")) {
      const parts = Object.entries(ev.counts.investigations).filter(([, v]) => v > 0).map(([k, v]) => `${verdictLabel(k as never)}: ${v}`);
      const total = Object.values(ev.counts.investigations).reduce((a, b) => a + b, 0);
      const lead = lang === "es" ? `El motor evalúa ${total} investigaciones en esta condición` : `The engine evaluates ${total} investigations at this condition`;
      const block: KeptBlock = { layer: "engine", text: plainify(`${lead} (verdict counts): ${parts.join("; ")}.`), label: ENGINE_LABEL, citations: [], provenance: [`computed by code (${ENGINE_NAME} ${ENGINE_VERSION}): evaluate() over the extracted records for this condition`], flagged: false };
      checked = { ...checked, kept: [block, ...checked.kept] };
    }
  }
  return { ...checked, steps: s.steps, actions: s.actions, target: s.target, rounds: rounds + 1, lang, ...(engineCounts ? { engineCounts } : {}), ...(cond.issues.length ? { conditionIssues: cond.issues } : {}) };
}
