/**
 * Server-only model factory.
 *
 * Resolves a UI-facing ModelId (e.g. "deepseek-v4-pro") into a concrete AI
 * SDK model instance through the company's unified AI gateway
 * (https://ai-gateway.corp.hetao101.com).
 *
 * The gateway is OpenAI-compatible, so every UI model is created via
 * `@ai-sdk/openai` with the same baseURL + apiKey — only the *upstream*
 * model name differs. The UI-id → upstream-name map is defined in
 * `UPSTREAM_MODEL_NAME` below.
 *
 * Per-UI-model overrides:
 *   - `HETAO_MODEL_<UI_ID>` (uppercased, `.`/`-` → `_`) — e.g.
 *     `HETAO_MODEL_DEEPSEEK_V4_PRO="some.other.alias"` to swap the upstream
 *     alias without touching code.
 *
 * Each `createModel()` call picks the next API key from the gateway's
 * KeyPool (round-robin). Two concurrent requests can use different keys,
 * multiplying effective RPM/TPM capacity.
 */

import { createOpenAI } from "@ai-sdk/openai";
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL_ID,
  getProviderForModelId,
  type ModelId,
  type ProviderId,
} from "./providers";
import { getEnvNames, pickKey } from "./keyPool";
import { logChatDebug } from "@/lib/chat/debug";

export class MissingApiKeyError extends Error {
  public readonly envVar: string;
  constructor(
    public readonly modelId: ModelId,
    public readonly provider: ProviderId
  ) {
    const { plural, singular } = getEnvNames(provider);
    super(
      `Missing API key for model "${modelId}" (provider "${provider}"). ` +
        `Set ${plural} (comma-separated) or ${singular} in .env.local`
    );
    this.name = "MissingApiKeyError";
    // Expose the plural name as the primary env hint — singular still works
    // as fallback but the user-facing guidance should steer toward the pool.
    this.envVar = plural;
  }
}

function pickKeyFor(modelId: ModelId): string {
  const provider = getProviderForModelId(modelId);
  const key = pickKey(provider);
  if (!key) throw new MissingApiKeyError(modelId, provider);
  return key;
}

/**
 * Volcano Ark "thinking" models (and several third-party gateways that proxy
 * to Ark) require every assistant tool-call message in history to carry
 * `reasoning_content`. Vercel AI SDK does not preserve that field across turns,
 * which causes the upstream error:
 *   "thinking is enabled but reasoning_content is missing in assistant
 *    tool call message at index N"
 *
 * Mitigation: a fetch shim that injects `thinking: { type: "disabled" }` into
 * the JSON body of every OpenAI-compatible chat-completions request. Vendors
 * that don't recognise the field ignore it, so this is safe for all
 * OpenAI-compat backends (the company gateway forwards to OpenAI, DeepSeek,
 * Qwen, etc., any of which may sit behind an Ark-style thinking flag).
 */
const disableThinkingFetch: typeof fetch = async (input, init) => {
  const next: RequestInit = { ...(init ?? {}) };
  const body = next.body;
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      if (!("thinking" in parsed)) {
        parsed.thinking = { type: "disabled" };
        next.body = JSON.stringify(parsed);
      }
    } catch {
      // Non-JSON body (e.g. multipart) — leave untouched.
    }
  }
  const response = await fetch(input as Parameters<typeof fetch>[0], next);
  if (process.env.CHAT_DEBUG === "1") {
    // Fire-and-forget — never block the AI SDK from consuming the original
    // response stream. We clone first, then read the clone in the background.
    void inspectUpstreamResponse(input, response.clone());
  }
  return response;
};

/**
 * Background diagnostic: read the cloned upstream response and emit a
 * `[chat-debug] openai.upstream-response` log entry if it looks suspicious
 * (non-2xx, empty body, error envelope, or 200 OK with no assistant content).
 *
 * Only runs when `CHAT_DEBUG=1`. All errors are swallowed — diagnostics
 * must never affect the user-facing response.
 */
async function inspectUpstreamResponse(
  input: Parameters<typeof fetch>[0],
  cloned: Response
): Promise<void> {
  try {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input instanceof Request
          ? input.url
          : "<unknown>";
    const status = cloned.status;
    const rawBody = await cloned.text();
    const trimmed = rawBody.trim();

    let hasError = false;
    let hasContent = false;
    let hasToolCalls = false;
    let isStream = false;
    if (trimmed.length > 0) {
      // OpenAI streaming responses are SSE (`data: {...}` lines), not JSON.
      // Non-streaming responses are a single JSON object.
      isStream = trimmed.startsWith("data:") || trimmed.includes("\ndata:");
      if (!isStream) {
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          hasError = "error" in parsed && parsed.error != null;
          const choices = (parsed as { choices?: unknown }).choices;
          if (Array.isArray(choices) && choices.length > 0) {
            const first = choices[0] as { message?: { content?: unknown; tool_calls?: unknown } };
            const content = first?.message?.content;
            hasContent = typeof content === "string" && content.trim().length > 0;
            hasToolCalls = Array.isArray(first?.message?.tool_calls)
              && (first.message.tool_calls as unknown[]).length > 0;
          }
        } catch {
          // Non-JSON, non-SSE — log as-is.
        }
      } else {
        // Quick scan of SSE for content/tool_call deltas. Anything matching
        // "content":"..." or "tool_calls" implies upstream did emit usable
        // output, so we don't flag it as suspicious.
        hasContent = /"content"\s*:\s*"[^"]/.test(rawBody);
        hasToolCalls = rawBody.includes('"tool_calls"');
        hasError = /"error"\s*:/.test(rawBody);
      }
    }

    const suspicious =
      status >= 400 || trimmed.length === 0 || hasError ||
      (!isStream && status < 400 && !hasContent && !hasToolCalls);
    if (!suspicious) return;

    // Redact common secret shapes before logging.
    const redacted = rawBody
      .replace(/sk-[A-Za-z0-9_\-]{8,}/g, "sk-<redacted>")
      .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer <redacted>");
    const bodySnippet = redacted.length > 1000
      ? `${redacted.slice(0, 1000)}…`
      : redacted;

    logChatDebug("openai.upstream-response", {
      url,
      status,
      bodyLength: rawBody.length,
      isStream,
      hasError,
      hasContent,
      hasToolCalls,
      bodySnippet,
    });
  } catch {
    // Diagnostics must never throw.
  }
}

export function resolveModelId(raw: string | null | undefined): ModelId {
  if (!raw) return DEFAULT_MODEL_ID;
  const match = AVAILABLE_MODELS.find((m) => m.id === raw);
  return match ? (match.id as ModelId) : DEFAULT_MODEL_ID;
}

/**
 * Resolve the model id for the memory-extraction sub-call. Honors the
 * `MEMORY_MODEL_ID` env var when it points at a valid `ModelId`, otherwise
 * falls back to the supplied primary model id. Only returns a distinct id
 * when the env value is both known AND different from the primary.
 */
export function resolveMemoryModelId(primary: ModelId): ModelId {
  const raw = process.env.MEMORY_MODEL_ID;
  if (!raw) return primary;
  const match = AVAILABLE_MODELS.find((m) => m.id === raw);
  return match ? (match.id as ModelId) : primary;
}

/**
 * UI ModelId → upstream model name (the alias the gateway expects in the
 * `model` field of the OpenAI-compatible request body).
 *
 * Per-model override env var name format:
 *   `HETAO_MODEL_<UPPER_SNAKE_OF_UI_ID>`
 *
 * Example: to swap the alias for "deepseek-v4-pro", set
 *   HETAO_MODEL_DEEPSEEK_V4_PRO="ali.public.deepseek-v4-pro-2026q2"
 */
const UPSTREAM_MODEL_NAME: Record<ModelId, string> = {
  "deepseek-v4-flash": "ali.public.deepseek-v4-flash",
  "deepseek-v4-flash-free": "ht.local.deepseek-v4-flash",
  "deepseek-v4-pro": "ali.public.deepseek-v4-pro",
  "qwen3.6-flash": "qwen3.6-flash",
  "gpt-5.4-mini": "gpt-5.4-mini",
  "gpt-5.5": "gpt-5.5",
};

const DEFAULT_HETAO_BASE_URL = "https://ai-gateway.corp.hetao101.com";

function modelOverrideEnvName(modelId: ModelId): string {
  return `HETAO_MODEL_${modelId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

function resolveUpstreamModelName(modelId: ModelId): string {
  const override = process.env[modelOverrideEnvName(modelId)]?.trim();
  if (override) return override;
  return UPSTREAM_MODEL_NAME[modelId];
}

/** Create an AI SDK model instance ready to be passed to streamText/generateText. */
export function createModel(modelId: ModelId) {
  // All models route through the company AI gateway. We pick a key per call
  // (round-robin) and select the upstream alias via the UI ModelId map.
  const provider = createOpenAI({
    apiKey: pickKeyFor(modelId),
    baseURL: process.env.HETAO_GATEWAY_BASE_URL || DEFAULT_HETAO_BASE_URL,
    fetch: disableThinkingFetch,
  });
  // Use Chat Completions API explicitly — Responses API requires
  // previous_response_id chaining which this app does not maintain.
  return provider.chat(resolveUpstreamModelName(modelId));
}
