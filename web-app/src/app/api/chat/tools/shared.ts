import {
  generateObject,
  generateText,
  streamText,
  type LanguageModel,
} from "ai";
import type { z } from "zod";
import { getGate } from "@/lib/llm/gate";
import { getProviderForModelId, type ModelId } from "@/lib/llm/providers";

/**
 * Sub-agent call hardening.
 *
 * Two execution paths, switched by `SUB_AGENT_USE_STREAMING`:
 *
 * - Streaming path (recommended, opt-in via env): uses `streamText` with the
 *   AI SDK's native `chunkMs` (inter-chunk idle timeout). The model can take
 *   as long as it wants overall, as long as it keeps emitting tokens — only
 *   actual stalls trigger an abort. On idle abort, we retry once if the
 *   remaining wall-clock budget can fit at least one more idle window.
 * - Legacy path (default, fallback): uses `generateText` with a flat
 *   wall-clock `timeout`. Kept for safe rollout — if some OpenAI-compat
 *   provider buffers the entire response server-side and emits one chunk,
 *   `chunkMs` is ineffective there and we want a known-good fallback.
 *
 * Concurrency gate (provider-scoped) and HTTP-level retries (`maxRetries`)
 * apply to both paths. The streaming path lowers `maxRetries` to 2 so the
 * SDK's internal retries don't starve our outer idle-retry budget.
 *
 * Errors are re-thrown — the AI SDK tool runtime converts that into a
 * `tool-error` state for the Orchestrator, which already knows how to offer
 * the user retry/skip options via its prompt.
 */

export const SUB_AGENT_TIMEOUT_LIGHT_MS = 60_000;
export const SUB_AGENT_TIMEOUT_HEAVY_MS = 120_000;
export const SUB_AGENT_TIMEOUT_MS = SUB_AGENT_TIMEOUT_LIGHT_MS;
export const SUB_AGENT_MAX_RETRIES = 3;

// Streaming path constants (only effective when SUB_AGENT_USE_STREAMING=1)
export const SUB_AGENT_STREAMING_TIMEOUT_LIGHT_MS = 90_000;
export const SUB_AGENT_STREAMING_TIMEOUT_HEAVY_MS = 180_000;
export const SUB_AGENT_IDLE_LIGHT_MS = 40_000;
export const SUB_AGENT_IDLE_HEAVY_MS = 60_000;
export const SUB_AGENT_STREAMING_MAX_RETRIES = 2;

type RunSubAgentArgs = {
  model: LanguageModel;
  modelId: ModelId;
  system: string;
  prompt: string;
  /**
   * Total wall-clock cap. In streaming mode this is the absolute ceiling;
   * the actual abort is usually driven by `idleMs` instead.
   */
  timeoutMs?: number;
  /**
   * Streaming mode only: max gap between two stream chunks before abort.
   * Defaults are derived from `timeoutMs` magnitude.
   */
  idleMs?: number;
};

function isStreamingEnabled(): boolean {
  return process.env.SUB_AGENT_USE_STREAMING === "1";
}

function deriveStreamingBudget(timeoutMs: number): {
  totalMs: number;
  idleMs: number;
} {
  // Map the caller's "intent" (light/heavy) onto streaming-path budgets:
  //   timeoutMs >= 120s (heavy intent) → 180s total / 60s idle
  //   timeoutMs >= 60s  (light intent) → 90s total / 40s idle
  //   smaller values are respected literally so tests / unusual callers can
  //   request tight budgets without being silently upgraded.
  if (timeoutMs >= SUB_AGENT_TIMEOUT_HEAVY_MS) {
    return {
      totalMs: SUB_AGENT_STREAMING_TIMEOUT_HEAVY_MS,
      idleMs: SUB_AGENT_IDLE_HEAVY_MS,
    };
  }
  if (timeoutMs >= SUB_AGENT_TIMEOUT_LIGHT_MS) {
    return {
      totalMs: SUB_AGENT_STREAMING_TIMEOUT_LIGHT_MS,
      idleMs: SUB_AGENT_IDLE_LIGHT_MS,
    };
  }
  return {
    totalMs: timeoutMs,
    idleMs: Math.min(SUB_AGENT_IDLE_LIGHT_MS, timeoutMs),
  };
}

/**
 * Wrapper around `generateText` / `streamText` that applies shared
 * timeout/retry/gate policy and normalizes low-level network errors into
 * Chinese, user-facing messages the Orchestrator can reason about.
 *
 * `timeoutMs` defaults to `SUB_AGENT_TIMEOUT_LIGHT_MS` (60s) for concept
 * generation. Heavy tools (validate/write) that operate on accumulated
 * documents should pass `SUB_AGENT_TIMEOUT_HEAVY_MS` (120s).
 */
export async function runSubAgentText({
  model,
  modelId,
  system,
  prompt,
  timeoutMs = SUB_AGENT_TIMEOUT_LIGHT_MS,
  idleMs,
}: RunSubAgentArgs): Promise<string> {
  if (isStreamingEnabled()) {
    return runViaStreaming({ model, modelId, system, prompt, timeoutMs, idleMs });
  }
  return runViaGenerateText({ model, modelId, system, prompt, timeoutMs });
}

async function runViaGenerateText({
  model,
  modelId,
  system,
  prompt,
  timeoutMs,
}: {
  model: LanguageModel;
  modelId: ModelId;
  system: string;
  prompt: string;
  timeoutMs: number;
}): Promise<string> {
  const gate = getGate(getProviderForModelId(modelId));
  try {
    return await gate.run(async () => {
      const { text } = await generateText({
        model,
        system,
        prompt,
        maxRetries: SUB_AGENT_MAX_RETRIES,
        timeout: timeoutMs,
      });
      return text;
    });
  } catch (error) {
    throw new Error(classifySubAgentError(error, timeoutMs));
  }
}

async function runViaStreaming({
  model,
  modelId,
  system,
  prompt,
  timeoutMs,
  idleMs,
}: {
  model: LanguageModel;
  modelId: ModelId;
  system: string;
  prompt: string;
  timeoutMs: number;
  idleMs?: number;
}): Promise<string> {
  const derived = deriveStreamingBudget(timeoutMs);
  const totalMs = derived.totalMs;
  const effectiveIdle = idleMs ?? derived.idleMs;

  const gate = getGate(getProviderForModelId(modelId));
  const start = Date.now();

  const attempt = (budget: number) =>
    gate.run(() =>
      streamOnce({
        model,
        system,
        prompt,
        totalMs: budget,
        idleMs: effectiveIdle,
      })
    );

  try {
    return await attempt(totalMs);
  } catch (err) {
    const elapsed = Date.now() - start;
    const remaining = totalMs - elapsed;
    if (isIdleAbort(err) && remaining > effectiveIdle * 2) {
      try {
        return await attempt(remaining);
      } catch (err2) {
        throw new Error(classifySubAgentError(err2, totalMs, effectiveIdle));
      }
    }
    throw new Error(classifySubAgentError(err, totalMs, effectiveIdle));
  }
}

async function streamOnce(args: {
  model: LanguageModel;
  system: string;
  prompt: string;
  totalMs: number;
  idleMs: number;
}): Promise<string> {
  const result = streamText({
    model: args.model,
    system: args.system,
    prompt: args.prompt,
    maxRetries: SUB_AGENT_STREAMING_MAX_RETRIES,
    timeout: { totalMs: args.totalMs, chunkMs: args.idleMs },
  });

  let buf = "";
  for await (const delta of result.textStream) {
    buf += delta;
  }

  if (buf.length === 0) {
    throw new Error(
      "[empty_response] 子 Agent 返回空内容（可能触发了内容过滤或上游异常）。请重试，或换一个模型。"
    );
  }
  return buf;
}

function isIdleAbort(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (m.includes("aborted")) return true;
  if (m.includes("chunk") && m.includes("timeout")) return true;
  if (m.includes("idle")) return true;
  return false;
}

/**
 * Structured-output sibling of `runSubAgentText`.
 *
 * Wraps `generateObject` with the same provider gate + retry policy and
 * normalizes errors via `classifySubAgentError`. Used by the `generate_concepts`
 * branch of `designStageFile` so the LLM produces a typed `ConceptList`
 * instead of free-form markdown — schema enforcement removes the need for
 * format-related text in the prompt.
 *
 * Streaming path is intentionally NOT supported here: structured generation
 * provides far less value from streaming, and `generateObject` already has
 * provider-level fallbacks in the Vercel AI SDK.
 */
export async function runSubAgentObject<TSchema extends z.ZodTypeAny>({
  model,
  modelId,
  system,
  prompt,
  schema,
  timeoutMs = SUB_AGENT_TIMEOUT_LIGHT_MS,
}: {
  model: LanguageModel;
  modelId: ModelId;
  system: string;
  prompt: string;
  schema: TSchema;
  timeoutMs?: number;
}): Promise<z.infer<TSchema>> {
  const gate = getGate(getProviderForModelId(modelId));
  try {
    return await gate.run(async () => {
      const { object } = await generateObject({
        model,
        system,
        prompt,
        schema,
        maxRetries: SUB_AGENT_MAX_RETRIES,
        timeout: timeoutMs,
      });
      return object as z.infer<TSchema>;
    });
  } catch (error) {
    throw new Error(classifySubAgentError(error, timeoutMs));
  }
}

/**
 * Map raw provider/network errors to a short Chinese label plus a
 * machine-matchable prefix like `[network_timeout]`. The prefix lets the
 * Orchestrator prompt (or future code) branch on error kind without parsing
 * free-form English stack traces.
 *
 * `idleMs` is included only when the streaming path is active; in that case
 * the timeout message describes inter-chunk stalling instead of total
 * wall-clock exhaustion.
 */
export function classifySubAgentError(
  error: unknown,
  timeoutMs: number = SUB_AGENT_TIMEOUT_LIGHT_MS,
  idleMs?: number
): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  // Pre-classified errors thrown by streamOnce — pass through unchanged.
  if (raw.startsWith("[empty_response]")) return raw;

  if (
    lower.includes("etimedout") ||
    lower.includes("connect timeout") ||
    lower.includes("timed out") ||
    (lower.includes("aborted") && lower.includes("timeout")) ||
    (idleMs != null && (lower.includes("aborted") || lower.includes("idle") || lower.includes("chunk")))
  ) {
    if (idleMs != null) {
      return `[network_timeout] 子 Agent 流式响应停滞（${idleMs / 1000}s 内无新内容，总预算 ${timeoutMs / 1000}s）。可能是网络中断或代理掉链。`;
    }
    return `[network_timeout] 子 Agent 调用超时（${timeoutMs / 1000}s 内未返回）。可能是当前网络不能直连该模型供应商，或代理不稳定。`;
  }
  if (
    lower.includes("econnreset") ||
    lower.includes("econnrefused") ||
    lower.includes("cannot connect to api") ||
    lower.includes("socket hang up") ||
    lower.includes("network request failed")
  ) {
    return "[network_unreachable] 子 Agent 无法连接到模型服务。请检查网络/代理，或切换到可达的模型。";
  }
  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid api key")
  ) {
    return "[auth_failed] 子 Agent 鉴权失败。请确认所选模型的 API Key 是否正确、是否已开通对应模型权限。";
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return "[rate_limited] 子 Agent 被供应商限流。请稍后重试或切换模型。";
  }
  // Provider 不支持 generateObject 所需的 response_format JSON-schema 模式。
  // 已知场景：DeepSeek / Doubao / Kimi 的 OpenAI 兼容协议在多数版本上不支持
  // `response_format: { type: 'json_schema', ... }`，会返回类似
  //   "This response_format type is unavailable now"
  //   "response_format is not supported"
  // 的 400 错误。上层（runGenerateConceptsWithLint）据此前缀自动降级到
  // generateText 路径。
  if (
    lower.includes("response_format") ||
    lower.includes("response format") ||
    (lower.includes("json") && lower.includes("schema") && (lower.includes("not support") || lower.includes("unavailable"))) ||
    (lower.includes("structured") && lower.includes("output") && (lower.includes("not support") || lower.includes("unavailable")))
  ) {
    return `[unsupported_response_format] 子 Agent 当前供应商不支持结构化输出（response_format JSON schema），将回退到文本路径。原始错误：${raw}`;
  }
  return `[sub_agent_error] 子 Agent 调用失败：${raw}`;
}

/**
 * Helper for upstream callers (e.g. designStageFile.runGenerateConceptsWithLint)
 * to detect a normalized "structured output unsupported" error and fall back
 * to a non-schema text path. Looks for the `[unsupported_response_format]`
 * prefix produced by `classifySubAgentError`.
 */
export function isUnsupportedResponseFormatError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("[unsupported_response_format]");
}
