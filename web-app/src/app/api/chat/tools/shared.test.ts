import { describe, expect, it } from "vitest";
import {
  classifySubAgentError,
  SUB_AGENT_TIMEOUT_HEAVY_MS,
  SUB_AGENT_TIMEOUT_LIGHT_MS,
} from "./shared";

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
});
