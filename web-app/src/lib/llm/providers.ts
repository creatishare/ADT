/**
 * Model registry — shared metadata used by both client and server.
 *
 * All models now route through the company's unified AI gateway
 * (`hetao`). The gateway is OpenAI-compatible, so every model uses
 * the same provider, base URL, and API key — only the upstream model
 * name differs. See `server.ts` for the UI-id → upstream-model-name
 * mapping.
 */

export type ProviderId = "hetao";

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
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    hint: "公司网关 · 阿里中转 · 轻量快速",
    provider: "hetao",
  },
  {
    id: "deepseek-v4-flash-free",
    label: "DeepSeek V4 Flash (免费)",
    hint: "公司网关 · 本地中转 · 免费额度",
    provider: "hetao",
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    hint: "公司网关 · 阿里中转 · 综合能力强",
    provider: "hetao",
  },
  {
    id: "qwen3.6-flash",
    label: "Qwen 3.6 Flash",
    hint: "公司网关 · 通义千问轻量版",
    provider: "hetao",
  },
  {
    id: "gpt-5.4-mini",
    label: "GPT 5.4 Mini",
    hint: "公司网关 · OpenAI 轻量版",
    provider: "hetao",
  },
  {
    id: "gpt-5.5",
    label: "GPT 5.5",
    hint: "公司网关 · OpenAI 旗舰版",
    provider: "hetao",
  },
] as const satisfies ReadonlyArray<ModelMeta>;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export const DEFAULT_MODEL_ID: ModelId = "deepseek-v4-pro";

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
