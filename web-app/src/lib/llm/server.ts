/**
 * Server-only model factory.
 *
 * Resolves a UI-facing ModelId (e.g. "gemini-3.1") into a concrete AI SDK
 * model instance using the matching provider and environment variables.
 *
 * Kimi, DeepSeek, and Doubao all expose OpenAI-compatible endpoints, so they
 * reuse `@ai-sdk/openai` with a custom baseURL and API key.
 *
 * Model IDs sent to provider APIs can be overridden via env vars (e.g.
 * `GOOGLE_GENERATIVE_AI_MODEL`, `OPENAI_MODEL`, etc.) without touching code.
 *
 * Each `createModel()` call picks the next API key from the per-provider
 * KeyPool (round-robin). This means two concurrent requests hitting the same
 * `modelId` can talk to different keys, multiplying effective RPM/TPM
 * capacity across the pool.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
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
 * OpenAI-compat backends (OpenAI proper, Moonshot, DeepSeek, Doubao, and any
 * aggregator that forwards to one of them).
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

/** Create an AI SDK model instance ready to be passed to streamText/generateText. */
export function createModel(modelId: ModelId) {
  switch (modelId) {
    case "gemini-3.1": {
      const provider = createGoogleGenerativeAI({
        apiKey: pickKeyFor(modelId),
        baseURL: process.env.GOOGLE_GENERATIVE_AI_BASE_URL,
      });
      return provider(process.env.GOOGLE_GENERATIVE_AI_MODEL || "gemini-2.5-flash");
    }

    case "gpt-5-4": {
      const provider = createOpenAI({
        apiKey: pickKeyFor(modelId),
        baseURL: process.env.OPENAI_BASE_URL,
        fetch: disableThinkingFetch,
      });
      // Use Chat Completions API explicitly — Responses API requires
      // previous_response_id chaining which this app does not maintain.
      return provider.chat(process.env.OPENAI_MODEL || "gpt-5.4");
    }

    case "kimi-k2.6": {
      const provider = createOpenAI({
        apiKey: pickKeyFor(modelId),
        baseURL: process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1",
        fetch: disableThinkingFetch,
      });
      return provider.chat(process.env.MOONSHOT_MODEL || "kimi-k2.6");
    }

    case "deepseek-v4-pro": {
      const provider = createOpenAI({
        apiKey: pickKeyFor(modelId),
        baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
        fetch: disableThinkingFetch,
      });
      return provider.chat(process.env.DEEPSEEK_MODEL || "deepseek-chat");
    }

    case "doubao-seed-2.0-pro": {
      const provider = createOpenAI({
        apiKey: pickKeyFor(modelId),
        baseURL:
          process.env.DOUBAO_BASE_URL ||
          "https://ark.cn-beijing.volces.com/api/v3",
        fetch: disableThinkingFetch,
      });
      return provider.chat(process.env.DOUBAO_MODEL || "doubao-seed-2.0-pro");
    }

    default: {
      // Exhaustiveness check — unreachable for known ModelId values.
      const _never: never = modelId;
      throw new Error(`Unsupported model id: ${_never}`);
    }
  }
}
