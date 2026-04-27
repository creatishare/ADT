import { generateText, type LanguageModel } from "ai";
import { getGate } from "@/lib/llm/gate";
import { getProviderForModelId, type ModelId } from "@/lib/llm/providers";

/**
 * Sub-agent call hardening.
 *
 * Three knobs every sub-agent tool shares:
 *
 * - `maxRetries: 3` — with exponential backoff built into the AI SDK, this
 *   papers over transient 429/503 bursts when multiple users hit the same
 *   provider key. Bumped from `1` after observing multi-user RPM contention
 *   in production. Retries still respect the per-call `timeout` below, so a
 *   permanently unreachable upstream still fails within the configured
 *   wall-clock cap.
 * - Tiered `timeout` — wall-clock cap per sub-agent call.
 *     - `SUB_AGENT_TIMEOUT_LIGHT_MS` (60s): designStageFile, generateVisualDesign
 *     - `SUB_AGENT_TIMEOUT_HEAVY_MS` (120s): validateStageFile, writeStageFile
 *   Heavy tools operate on accumulated documents whose prompts grow with
 *   each round; the previous flat 45s was insufficient once 3+ topic groups
 *   had been processed (sub-agent calls reliably hit network_timeout).
 *   Prevents the undici/provider socket from hanging indefinitely when a
 *   proxy or upstream stalls mid-stream.
 * - Provider-scoped concurrency gate — bounds the number of in-flight
 *   sub-agent calls per provider to `keyPoolSize × LLM_PER_KEY_CONCURRENCY`
 *   (default 3 per key). Extra work queues locally instead of bursting the
 *   provider and immediately eating 429s.
 */

export const SUB_AGENT_TIMEOUT_LIGHT_MS = 60_000;
export const SUB_AGENT_TIMEOUT_HEAVY_MS = 120_000;
export const SUB_AGENT_TIMEOUT_MS = SUB_AGENT_TIMEOUT_LIGHT_MS;
export const SUB_AGENT_MAX_RETRIES = 3;

type RunSubAgentArgs = {
  model: LanguageModel;
  modelId: ModelId;
  system: string;
  prompt: string;
  timeoutMs?: number;
};

/**
 * Wrapper around `generateText` that applies shared timeout/retry/gate
 * policy and normalizes low-level network errors into Chinese, user-facing
 * messages the Orchestrator can reason about.
 *
 * `timeoutMs` defaults to `SUB_AGENT_TIMEOUT_LIGHT_MS` (60s) for concept
 * generation. Heavy tools (validate/write) that operate on accumulated
 * documents should pass `SUB_AGENT_TIMEOUT_HEAVY_MS` (120s).
 *
 * Errors are re-thrown — the AI SDK tool runtime converts that into a
 * `tool-error` state for the Orchestrator, which already knows how to offer
 * the user retry/skip options via its prompt.
 */
export async function runSubAgentText({
  model,
  modelId,
  system,
  prompt,
  timeoutMs = SUB_AGENT_TIMEOUT_LIGHT_MS,
}: RunSubAgentArgs): Promise<string> {
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

/**
 * Map raw provider/network errors to a short Chinese label plus a
 * machine-matchable prefix like `[network_timeout]`. The prefix lets the
 * Orchestrator prompt (or future code) branch on error kind without parsing
 * free-form English stack traces.
 */
export function classifySubAgentError(
  error: unknown,
  timeoutMs: number = SUB_AGENT_TIMEOUT_LIGHT_MS
): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes("etimedout") ||
    lower.includes("connect timeout") ||
    lower.includes("timed out") ||
    lower.includes("aborted") && lower.includes("timeout")
  ) {
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
  return `[sub_agent_error] 子 Agent 调用失败：${raw}`;
}
