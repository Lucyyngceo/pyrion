// Provider configuration from the environment. Server only. Key values never leave this module except in request headers.

export type ProviderId = "openrouter" | "nim";

export interface Provider {
  id: ProviderId;
  base: string;
  key: string;
  models: string[];
  headers: Record<string, string>;
}

type Env = Record<string, string | undefined>;

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
const clean = (v: string | undefined) => (v ?? "").trim().replace(/\/+$/, "");

/** Primary first (OpenRouter), then the fallback (NVIDIA NIM, the PYRION_LLM_* variables). Unconfigured providers are left out. */
export function loadProviders(env: Env = process.env): Provider[] {
  const out: Provider[] = [];
  const or = { base: clean(env.OPENROUTER_BASE_URL), key: (env.OPENROUTER_API_KEY ?? "").trim(), models: list(env.OPENROUTER_MODELS) };
  if (or.base && or.key && or.models.length) {
    out.push({ id: "openrouter", ...or, headers: { "HTTP-Referer": "https://pyrion.us", "X-Title": "PYRION" } });
  }
  const nim = { base: clean(env.PYRION_LLM_BASE_URL), key: (env.PYRION_LLM_API_KEY ?? "").trim(), models: list(env.PYRION_LLM_MODELS) };
  if (nim.base && nim.key && nim.models.length) out.push({ id: "nim", ...nim, headers: {} });
  return out;
}

/** Model ids a caller may request, primary first, without duplicates. */
export const allModels = (providers: Provider[]) => [...new Set(providers.flatMap((p) => p.models))];

/** Public view of the configuration: no key, no base URL. */
export const publicConfig = (providers: Provider[]) => providers.map((p) => ({ provider: p.id, models: p.models }));

const DEFAULT_CLIENT_MODELS = ["nvidia/nemotron-3-ultra-550b-a55b", "google/gemma-4-31b-it", "mistralai/mistral-small-3.2-24b-instruct"];

/**
 * Models a visitor may ask for: PYRION_CLIENT_MODELS (default: the two cheap ones), limited to configured models.
 * The expensive models stay server-side. If none of the list is configured, the first configured model is the only choice.
 */
export function clientModels(providers: Provider[], env: Env = process.env): string[] {
  const wanted = env.PYRION_CLIENT_MODELS !== undefined && env.PYRION_CLIENT_MODELS.trim() !== "" ? list(env.PYRION_CLIENT_MODELS) : DEFAULT_CLIENT_MODELS;
  const configured = allModels(providers);
  const ok = wanted.filter((m) => configured.includes(m));
  return ok.length ? ok : configured.slice(0, 1);
}

export interface ModelInfo {
  /** false: send chat_template_kwargs { enable_thinking: false } to NIM for short structured answers. Unknown models: true (provider default). */
  thinking?: boolean;
  /** Verified from the model page. Models not in this table are "unverified" and get no label. */
  /** "required": the endpoint rejects reasoning disabled; send reasoning { effort, exclude: true } instead. */
  reasoning?: "required";
  /** The name the page shows ("Nemotron 3 Ultra"). Models without one show their id. */
  name?: string;
  open_weights: true;
  license: string;
  source: string;
  checked: string;
}

/** One entry per model, checked against the model pages on 2026-11-14. Not environment: a license is a fact, not a setting. */
export const MODEL_INFO: Readonly<Record<string, ModelInfo>> = {
  "google/gemma-4-31b-it": { name: "Gemma 4 31B", open_weights: true, license: "Apache-2.0", source: "https://huggingface.co/google/gemma-4-31b-it", checked: "2026-11-14" },
  "openai/gpt-oss-120b": { name: "gpt-oss-120b", open_weights: true, license: "Apache-2.0", source: "https://huggingface.co/openai/gpt-oss-120b", checked: "2026-11-15", reasoning: "required" },
  "mistralai/mistral-small-3.2-24b-instruct": { name: "Mistral Small 3.2", open_weights: true, license: "Apache-2.0", source: "https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506", checked: "2026-11-15" },
  "meta-llama/llama-4-maverick": { name: "Llama 4 Maverick", open_weights: true, license: "Llama 4 Community License", source: "https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E-Instruct", checked: "2026-11-15" },
  "nvidia/nemotron-3-ultra-550b-a55b": {
    name: "Nemotron 3 Ultra",
    thinking: false,
    open_weights: true,
    license: "OpenMDW-1.1 (per NVIDIA NGC catalog)",
    source: "https://catalog.ngc.nvidia.com/orgs/nim/nvidia/models/nemotron-3-ultra-550b-a55b",
    checked: "2026-11-14",
  },
};

export const modelInfo = (model: string): ModelInfo | undefined => MODEL_INFO[model];

/** What the page may say about a model: a verified open-weights label with license and source, or nothing. */
export function openWeightsLabel(model: string): { license: string; source: string } | null {
  const i = MODEL_INFO[model];
  return i?.open_weights ? { license: i.license, source: i.source } : null;
}

/** The name to show for a model: its table name, or its id. */
export const displayName = (model: string): string => MODEL_INFO[model]?.name ?? model;
