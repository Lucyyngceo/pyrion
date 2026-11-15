// PYRION as a Model Context Protocol (MCP) server, over Streamable HTTP (JSON-RPC 2.0 in a POST, one JSON response).
// Read-only and deterministic: every tool is the same code the site runs (the applicability engine, the extracted records,
// the NASA library). No language model is called here, so any AI assistant that connects gets the engine's answer, never ours.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { TOOL_DEFS, runTool, truncateResult, validateArgs, type ToolContext } from "@/lib/copilot-tools";
import { serverData } from "@/lib/server-eval";
import { PRESET_VIEWS } from "@/lib/presets";
import { loadLibrary } from "@/lib/expert/library";

export const dynamic = "force-dynamic";

const PROTOCOL = "2025-06-18";
const SERVER = { name: "pyrion", title: "PYRION Ω — NASA PSI fire evidence", version: "1.0.0" };
const DERIVED = path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "data", "derived");
const INSTRUCTIONS =
  "PYRION checks a cabin atmosphere (oxygen, pressure, gravity, fuel) against the condition records extracted from NASA's Physical Sciences Informatics (PSI) combustion investigations. " +
  "Verdicts come from fixed rules in code, never from a model; quote them as PYRION's verdict and cite the DOI each tool returns. " +
  "'Insufficient evidence' and 'not comparable' are real answers: do not turn them into a prediction. PYRION never calls a condition safe. " +
  "Give quantities as text with their units (\"30 %\", \"10.2 psia\", \"Moon\"); the engine converts units.";

const readOpt = (f: string) => readFile(path.join(DERIVED, f), "utf8").catch(() => null);

let ctxCache: Promise<ToolContext> | null = null;
function context(): Promise<ToolContext> {
  ctxCache ??= (async () => {
    const [{ records, investigations }, emb, bass, flex] = await Promise.all([serverData(), readOpt("text_similarity.json"), readOpt("bass2_flow_steps.csv"), readOpt("flex_model.json")]);
    return {
      records,
      investigations,
      embedding: emb ? JSON.parse(emb) : undefined,
      presets: PRESET_VIEWS.map((v) => ({ id: v.preset.id, label: v.preset.label })),
      bassCsv: bass,
      flex: flex ? JSON.parse(flex) : undefined,
      sha256: async (text: string) => createHash("sha256").update(text).digest("hex"),
    };
  })();
  return ctxCache;
}

type Tool = { name: string; title: string; description: string; inputSchema: Record<string, unknown> };

const EXTRA: Tool[] = [
  {
    name: "list_presets",
    title: "Named cabin atmospheres",
    description: "The named conditions PYRION knows (ISS cabin air, the challenge's Moon Base, NASA exploration atmospheres), each with its values and the source it cites.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_investigations",
    title: "PSI combustion investigations",
    description: "The 24 NASA PSI combustion investigations: accession, acronym, title, DOI and license.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_nasa_library",
    title: "Search NASA documents",
    description: "BM25 search over the page-by-page text of the NASA documents PYRION reads (PSI reports, NTRS papers, NASA standards). Returns passages with document, page and link, to quote verbatim.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, top: { type: "integer", minimum: 1, maximum: 10 } }, required: ["query"], additionalProperties: false },
  },
];

const TITLES: Record<string, string> = {
  evaluate_target: "Applicability verdicts for a condition",
  find_evidence: "Find extracted test records",
  get_receipt: "Source of one value",
  transfer_hypothesis: "Gravity transfer (hypothesis)",
  fm2_balance: "FM2 chamber oxygen balance",
  text_search: "Text-similarity ranking (not physics)",
  flex_model: "FLEX droplet model",
  suggest_experiments: "Suggested experiments (FLEX)",
};

const TOOLS: Tool[] = [
  ...TOOL_DEFS.map((d) => ({ name: d.function.name, title: TITLES[d.function.name] ?? d.function.name, description: d.function.description, inputSchema: d.function.parameters })),
  ...EXTRA,
];

const text = (value: unknown, isError = false) => {
  const { text: t } = truncateResult(value, 20_000);
  return { content: [{ type: "text", text: t }], isError };
};

async function callTool(name: string, args: Record<string, unknown>) {
  if (name === "list_presets") {
    return text(PRESET_VIEWS.map((v) => ({ id: v.preset.id, label: v.preset.label, values: v.summary })));
  }
  if (name === "list_investigations") {
    const { investigations } = await serverData();
    return text(investigations.map((i) => ({ accession: i.accession, acronym: i.acronym, title: i.title, doi: i.doi ? `https://doi.org/${i.doi.replace(/^https?:\/\/doi\.org\//, "")}` : null, license: i.license })));
  }
  if (name === "search_nasa_library") {
    const q = typeof args.query === "string" ? args.query.trim() : "";
    if (!q) return text("query is required", true);
    const top = Math.min(10, Math.max(1, Number.isInteger(args.top) ? (args.top as number) : 5));
    const lib = await loadLibrary();
    if (!lib) return text({ available: false, message: "The NASA library is not loaded on this server." });
    const hits = await lib.search(q.slice(0, 500), top);
    return text(hits.map((h) => ({ document: h.title, doc_id: h.doc_id, pages: h.page_start === h.page_end ? h.page_start : `${h.page_start}-${h.page_end}`, url: h.url, passage: h.text.slice(0, 1500) })));
  }
  const v = validateArgs(name, args);
  if (!v.ok) return text(v.error, true);
  const out = await runTool(await context(), name, v.value);
  return text(out);
}

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function handle(m: Rpc) {
  switch (m.method) {
    case "initialize":
      return ok(m.id, { protocolVersion: PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: INSTRUCTIONS });
    case "ping":
      return ok(m.id, {});
    case "tools/list":
      return ok(m.id, { tools: TOOLS });
    case "tools/call": {
      const name = typeof m.params?.name === "string" ? m.params.name : "";
      if (!TOOLS.some((t) => t.name === name)) return fail(m.id, -32602, `unknown tool: ${name}`);
      const args = (m.params?.arguments && typeof m.params.arguments === "object" ? m.params.arguments : {}) as Record<string, unknown>;
      try {
        return ok(m.id, await callTool(name, args));
      } catch {
        return ok(m.id, text("The tool failed on the server.", true));
      }
    }
    default:
      return fail(m.id, -32601, `method not found: ${m.method ?? ""}`);
  }
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, mcp-protocol-version, mcp-session-id", "access-control-allow-methods": "POST, GET, OPTIONS" };

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(fail(null, -32700, "parse error"), { status: 400, headers: CORS });
  }
  const msgs = (Array.isArray(body) ? body : [body]) as Rpc[];
  const replies = [];
  for (const m of msgs.slice(0, 20)) {
    if (m.id === undefined || m.id === null) continue; // notifications get no reply
    replies.push(await handle(m));
  }
  if (replies.length === 0) return new Response(null, { status: 202, headers: CORS });
  return Response.json(Array.isArray(body) ? replies : replies[0], { headers: CORS });
}

/** No server-sent stream: this server only answers requests. */
export async function GET(req: Request) {
  if ((req.headers.get("accept") ?? "").includes("text/event-stream")) return new Response(null, { status: 405, headers: { ...CORS, allow: "POST" } });
  return Response.json({ server: SERVER, protocol: PROTOCOL, transport: "streamable-http (POST JSON-RPC)", tools: TOOLS.map((t) => t.name) }, { headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
