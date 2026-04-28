import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `streamText` is mocked at module load time so streaming-path tests can
// drive `result.textStream` via controlled async iterables. Existing
// classifier tests don't touch `streamText` and are unaffected.
vi.mock("ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("ai")>();
  return {
    ...original,
    streamText: vi.fn(),
  };
});

import { streamText } from "ai";
import { _resetGates } from "@/lib/llm/gate";
import {
  classifySubAgentError,
  runSubAgentText,
  SUB_AGENT_IDLE_HEAVY_MS,
  SUB_AGENT_IDLE_LIGHT_MS,
  SUB_AGENT_TIMEOUT_HEAVY_MS,
  SUB_AGENT_TIMEOUT_LIGHT_MS,
} from "./shared";

const mockedStreamText = vi.mocked(streamText);

/**
 * Build a result-like object for a successful stream that yields a fixed
 * sequence of deltas with no delay.
 */
function streamingResult(deltas: string[]): { textStream: AsyncIterable<string> } {
  async function* gen() {
    for (const d of deltas) yield d;
  }
  return { textStream: gen() } as unknown as { textStream: AsyncIterable<string> };
}

/**
 * Build a result-like object whose `textStream` yields a few deltas then
 * throws an idle-abort-style error, simulating the AI SDK's `chunkMs`
 * behavior without involving real timers.
 */
function stallingResult(
  deltas: string[],
  abortMessage = "stream aborted: chunk timeout"
): { textStream: AsyncIterable<string> } {
  async function* gen() {
    for (const d of deltas) yield d;
    throw new Error(abortMessage);
  }
  return { textStream: gen() } as unknown as { textStream: AsyncIterable<string> };
}

describe("classifySubAgentError", () => {
  it("tags ETIMEDOUT as network_timeout", () => {
    const msg = classifySubAgentError(
      new Error("Failed after 3 attempts. Last error: Cannot connect to API: read ETIMEDOUT")
    );
    // ETIMEDOUT surfaces as "Cannot connect to API" first, which matches
    // the unreachable branch — either tag is acceptable for this case.
    expect(msg).toMatch(/\[(network_timeout|network_unreachable)\]/);
  });

  it("tags connect timeout as network_timeout", () => {
    const msg = classifySubAgentError(new Error("connect timeout"));
    expect(msg.startsWith("[network_timeout]")).toBe(true);
  });

  it("tags ECONNRESET as network_unreachable", () => {
    const msg = classifySubAgentError(new Error("read ECONNRESET"));
    expect(msg.startsWith("[network_unreachable]")).toBe(true);
  });

  it("tags 401 / invalid api key as auth_failed", () => {
    expect(classifySubAgentError(new Error("401 Unauthorized"))).toMatch(
      /^\[auth_failed\]/
    );
    expect(classifySubAgentError(new Error("Invalid API key"))).toMatch(
      /^\[auth_failed\]/
    );
  });

  it("tags 429 as rate_limited", () => {
    const msg = classifySubAgentError(new Error("429 Too Many Requests: rate limit exceeded"));
    expect(msg.startsWith("[rate_limited]")).toBe(true);
  });

  it("falls back to sub_agent_error for unknown messages", () => {
    const msg = classifySubAgentError(new Error("weird provider glitch"));
    expect(msg.startsWith("[sub_agent_error]")).toBe(true);
    expect(msg).toContain("weird provider glitch");
  });

  it("handles non-Error inputs", () => {
    expect(classifySubAgentError("raw string")).toMatch(/^\[sub_agent_error\]/);
    expect(classifySubAgentError(undefined)).toMatch(/^\[sub_agent_error\]/);
  });

  it("reflects the configured timeout in network_timeout messages", () => {
    const lightMsg = classifySubAgentError(new Error("connect timeout"));
    expect(lightMsg).toContain(`${SUB_AGENT_TIMEOUT_LIGHT_MS / 1000}s`);

    const heavyMsg = classifySubAgentError(
      new Error("connect timeout"),
      SUB_AGENT_TIMEOUT_HEAVY_MS
    );
    expect(heavyMsg).toContain(`${SUB_AGENT_TIMEOUT_HEAVY_MS / 1000}s`);
    expect(heavyMsg).not.toContain(`${SUB_AGENT_TIMEOUT_LIGHT_MS / 1000}s`);
  });

  it("formats streaming-path timeout message with idle window", () => {
    const msg = classifySubAgentError(
      new Error("stream aborted: chunk timeout"),
      SUB_AGENT_TIMEOUT_HEAVY_MS,
      SUB_AGENT_IDLE_HEAVY_MS
    );
    expect(msg.startsWith("[network_timeout]")).toBe(true);
    expect(msg).toContain(`${SUB_AGENT_IDLE_HEAVY_MS / 1000}s 内无新内容`);
    expect(msg).toContain(`总预算 ${SUB_AGENT_TIMEOUT_HEAVY_MS / 1000}s`);
  });

  it("passes through pre-classified [empty_response] errors", () => {
    const msg = classifySubAgentError(
      new Error("[empty_response] 子 Agent 返回空内容（可能触发了内容过滤）")
    );
    expect(msg.startsWith("[empty_response]")).toBe(true);
  });
});

describe("runSubAgentText (streaming path)", () => {
  const SHARED_ARGS = {
    model: {} as never,
    modelId: "kimi-k2.6" as const,
    system: "system",
    prompt: "prompt",
  };

  beforeEach(() => {
    process.env.SUB_AGENT_USE_STREAMING = "1";
    _resetGates();
    mockedStreamText.mockReset();
  });

  afterEach(() => {
    delete process.env.SUB_AGENT_USE_STREAMING;
  });

  it("concatenates text deltas from a successful stream", async () => {
    mockedStreamText.mockReturnValueOnce(
      streamingResult(["hello ", "world", "!"]) as never
    );
    const text = await runSubAgentText({
      ...SHARED_ARGS,
      timeoutMs: SUB_AGENT_TIMEOUT_LIGHT_MS,
    });
    expect(text).toBe("hello world!");
    expect(mockedStreamText).toHaveBeenCalledTimes(1);
  });

  it("throws [network_timeout] with idle window when stream stalls", async () => {
    // Both attempt + idle-retry stall. Heavy budget (180s total / 60s idle)
    // gives plenty of room for one retry, so set up two stalling mocks.
    mockedStreamText.mockReturnValueOnce(stallingResult(["partial"]) as never);
    mockedStreamText.mockReturnValueOnce(stallingResult([]) as never);

    let captured: Error | null = null;
    try {
      await runSubAgentText({
        ...SHARED_ARGS,
        timeoutMs: SUB_AGENT_TIMEOUT_HEAVY_MS,
      });
    } catch (err) {
      captured = err as Error;
    }

    expect(captured).not.toBeNull();
    expect(captured!.message).toMatch(/^\[network_timeout\]/);
    expect(captured!.message).toContain(`${SUB_AGENT_IDLE_HEAVY_MS / 1000}s 内无新内容`);
    expect(mockedStreamText).toHaveBeenCalledTimes(2);
  });

  it("retries once on idle abort and returns the second attempt's text", async () => {
    mockedStreamText.mockReturnValueOnce(stallingResult(["partial"]) as never);
    mockedStreamText.mockReturnValueOnce(
      streamingResult(["recovered", " ", "ok"]) as never
    );

    const text = await runSubAgentText({
      ...SHARED_ARGS,
      timeoutMs: SUB_AGENT_TIMEOUT_HEAVY_MS,
    });

    expect(text).toBe("recovered ok");
    expect(mockedStreamText).toHaveBeenCalledTimes(2);
  });

  it("does not retry when remaining budget is too small to fit another idle window", async () => {
    // Tiny budget — first attempt stalls and consumes the entire budget,
    // remaining ≤ 2× idleMs so no retry.
    const tinyBudget = SUB_AGENT_IDLE_LIGHT_MS; // exactly one idle window
    mockedStreamText.mockReturnValueOnce(stallingResult([]) as never);

    await expect(
      runSubAgentText({ ...SHARED_ARGS, timeoutMs: tinyBudget, idleMs: tinyBudget })
    ).rejects.toThrow(/^\[network_timeout\]/);

    expect(mockedStreamText).toHaveBeenCalledTimes(1);
  });

  it("classifies a non-idle stream error without retrying", async () => {
    mockedStreamText.mockReturnValueOnce(
      stallingResult([], "401 Unauthorized") as never
    );
    await expect(
      runSubAgentText({ ...SHARED_ARGS, timeoutMs: SUB_AGENT_TIMEOUT_LIGHT_MS })
    ).rejects.toThrow(/^\[auth_failed\]/);
    expect(mockedStreamText).toHaveBeenCalledTimes(1);
  });

  it("rejects an empty stream as [empty_response]", async () => {
    mockedStreamText.mockReturnValueOnce(streamingResult([]) as never);
    await expect(
      runSubAgentText({ ...SHARED_ARGS, timeoutMs: SUB_AGENT_TIMEOUT_LIGHT_MS })
    ).rejects.toThrow(/^\[empty_response\]/);
  });
});
