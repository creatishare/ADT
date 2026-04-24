/**
 * Model registry — shared metadata used by both client and server.
 *
 * Add new models here. The server-side factory (`server.ts`) resolves each
 * entry to a concrete provider via environment variables.
 */

export type ProviderId = "google" | "openai" | "moonshot" | "deepseek" | "doubao";

export interface ModelMeta {
  /** Stable ID used by UI + request header. */
  id: string;
  /** Display name shown in the picker. */
  label: string;
  /** Short hint shown under the label. */
  hint: string;
  /** Provider used server-side to build the model instance. */
  provider: ProviderId;
}

export const AVAILABLE_MODELS = [
  {
    id: "gemini-3.1",
    label: "Gemini 3.1",
    hint: "Google · 综合推理强",
    provider: "google",
  },
  {
    id: "gpt-5.2",
    label: "GPT 5.2",
    hint: "OpenAI · 代码与长文",
    provider: "openai",
  },
  {
    id: "kimi-k2.5",
    label: "Kimi K2.5",
    hint: "Moonshot · 中文长上下文",
    provider: "moonshot",
  },
  {
    id: "deepseek-v3.2",
    label: "DeepSeek V3.2",
    hint: "DeepSeek · 成本敏感场景",
    provider: "deepseek",
  },
  {
    id: "doubao-seed-2.0-pro",
    label: "Doubao Seed 2.0 Pro",
    hint: "字节火山引擎 · 国内直连",
    provider: "doubao",
  },
] as const satisfies ReadonlyArray<ModelMeta>;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export const DEFAULT_MODEL_ID: ModelId = "gemini-3.1";

export function isKnownModelId(value: unknown): value is ModelId {
  return (
    typeof value === "string" &&
    AVAILABLE_MODELS.some((m) => m.id === value)
  );
}

export function getModelMeta(id: string): ModelMeta | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === id);
}

export function getProviderForModelId(id: ModelId): ProviderId {
  const meta = AVAILABLE_MODELS.find((m) => m.id === id);
  if (!meta) throw new Error(`Unknown ModelId: ${id}`);
  return meta.provider;
}
