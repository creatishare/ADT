import { generateText, type LanguageModel } from "ai";

/**
 * Sub-agent call hardening.
 *
 * Two knobs every sub-agent tool should share:
 *
 * - `maxRetries: 1` — AI SDK default is 2 (= 3 attempts total). For
 *   ETIMEDOUT / ECONNRESET that's pure latency amplification: the upstream
 *   is unreachable, retrying 3× turns a 20s failure into a 60s failure.
 *   One retry is enough to paper over transient blips.
 * - `timeout: 45_000` — wall-clock cap per sub-agent call. Prevents the
 *   undici/provider socket from hanging indefinitely when a proxy or
 *   upstream stalls mid-stream.
 */

export const SUB_AGENT_TIMEOUT_MS = 45_000;
export const SUB_AGENT_MAX_RETRIES = 1;

type RunSubAgentArgs = {
  model: LanguageModel;
  system: string;
  prompt: string;
};

/**
 * Wrapper around `generateText` that applies shared timeout/retry policy and
 * normalizes low-level network errors into Chinese, user-facing messages the
 * Orchestrator can reason about.
 *
 * Errors are re-thrown — the AI SDK tool runtime converts that into a
 * `tool-error` state for the Orchestrator, which already knows how to offer
 * the user retry/skip options via its prompt.
 */
export async function runSubAgentText({
  model,
  system,
  prompt,
}: RunSubAgentArgs): Promise<string> {
  try {
    const { text } = await generateText({
      model,
      system,
      prompt,
      maxRetries: SUB_AGENT_MAX_RETRIES,
      timeout: SUB_AGENT_TIMEOUT_MS,
    });
    return text;
  } catch (error) {
    throw new Error(classifySubAgentError(error));
  }
}

/**
 * Map raw provider/network errors to a short Chinese label plus a
 * machine-matchable prefix like `[network_timeout]`. The prefix lets the
 * Orchestrator prompt (or future code) branch on error kind without parsing
 * free-form English stack traces.
 */
export function classifySubAgentError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes("etimedout") ||
    lower.includes("connect timeout") ||
    lower.includes("timed out") ||
    lower.includes("aborted") && lower.includes("timeout")
  ) {
    return `[network_timeout] 子 Agent 调用超时（${SUB_AGENT_TIMEOUT_MS / 1000}s 内未返回）。可能是当前网络不能直连该模型供应商，或代理不稳定。`;
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
