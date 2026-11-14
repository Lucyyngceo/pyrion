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

const DEFAULT_CLIENT_MODELS = ["qwen/qwen3.8-27b", "moonshotai/kimi-k2.6"];

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

/** Models whose license has been checked and may be called open weights (PYRION_OPEN_WEIGHTS_MODELS). Default: none. */
export const openWeightsModels = (env: Env = process.env): string[] => list(env.PYRION_OPEN_WEIGHTS_MODELS);
