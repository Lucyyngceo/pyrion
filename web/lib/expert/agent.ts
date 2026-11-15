// The expert chat agent: a model that calls tools, and code that decides what of its answer may be shown.
// Pure (no fs, no network): the model call and the data come in through `AgentEnv`, so the tests run it with stubs.
//
// The model never decides a verdict and never does arithmetic: verdicts come from engine tools, numbers from calculators or
// verified quotes. Its final answer is a list of layered blocks; checkAnswer keeps only what survives.

import { evaluate, experimentsNeeded, routesToEvidence, targetFromQuantities, threePartAnswer, type ConditionRecord, type Target, type TargetQuantities } from "../../../engine/src/index.ts";
import { readByCode } from "../ask-core.ts";
import { searchTopics, MIN_SCORE, type Topic } from "../tars/help.ts";
import { CALCULATOR_SPECS, runCalculator, type ToolResult } from "./calculators.ts";
import { checkAnswer, type Corpus, type CheckResult } from "./claims.ts";

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
4. Your own reasoning is the expert layer; it is labelled "not verified against a source". Any number in it must come from a tool result or a quote, or the code removes it.

When the visitor gives a condition, call set_condition first; for a follow-up like "and at 25 %?" call it with based_on_previous: true so only the stated change applies. Use show_on_envelope when the visitor may want to see the condition on the dashboard, and highlight to point at parts of the page.

Final answer: ONLY a JSON array of blocks, no other text:
[{"layer":"engine"|"nasa"|"expert","text":"...","citations":[{"doc_id":"...","page":1,"quote":"exact words from the page"}],"toolRefs":["t1"]}]
- engine blocks restate engine tool output and list its "ref" in toolRefs.
- nasa blocks carry citations (exact quotes) and paraphrase them.
- expert blocks are your explanation; list the "ref" of any tool whose numbers you use.
Keep it as short as a good answer allows. Write in the visitor's language.`;

function targetSummary(t: Target) {
  const c = t.continuous;
  return {
    regime: t.regime,
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
          counts: ev.counts.investigations,
          investigations: ev.investigations.slice(0, 40).map((i) => ({ accession: i.accession, acronym: inv.get(i.accession)?.acronym, doi: inv.get(i.accession)?.doi, verdict: i.verdict, level: i.extrapolationLevel })),
          regimeUntested: ev.regimeUntested,
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
        return { passages: hits.map((h) => ({ doc_id: h.doc_id, page: h.page_start, page_end: h.page_end, title: h.title, url: h.url, text: cap(h.text, 700) })) };
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
        return r.ok ? { ref: id, result: r.display, provenance: r.provenance } : { ref: id, error: r.message };
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
}

export async function runAgent(
  env: AgentEnv,
  input: { message: string; history?: HistoryTurn[]; lastTarget?: Target | null; ui?: UiContext },
): Promise<AgentResult> {
  const s = newState(input.lastTarget ?? null);
  const ui = input.ui ?? {};
  const system = `${SYSTEM_PROMPT}\n\nPage context (from the visitor's browser): ${cap(JSON.stringify(ui), 1500)}\nPrevious target: ${s.target ? JSON.stringify(targetSummary(s.target)) : "none"}`;
  const messages: ChatMsg[] = [{ role: "system", content: system }, ...(input.history ?? []).slice(-8).map((h) => ({ role: h.role, content: cap(h.text, 1200) }) as ChatMsg), { role: "user", content: input.message }];
  let content = "";
  let rounds = 0;
  for (; rounds < MAX_ROUNDS; rounds++) {
    // The last round has no tools: the model must answer with what it has.
    const last = rounds === MAX_ROUNDS - 1;
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
  const blocks = parseBlocks(content);
  const empty: Corpus = { get: () => undefined, hasDocument: () => false };
  const checked = checkAnswer(blocks, { corpus: env.library?.corpus ?? empty, engine: s.engine, tools: s.tools });
  return { ...checked, steps: s.steps, actions: s.actions, target: s.target, rounds: rounds + 1 };
}
