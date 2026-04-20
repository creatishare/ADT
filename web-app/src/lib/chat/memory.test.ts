import { describe, expect, it } from "vitest";
import {
  buildLayeredMemoryContext,
  buildTranscript,
  getMessageText,
  normalizeMessages,
  truncateText,
  type RequestMessage,
} from "./memory";

describe("memory helpers", () => {
  it("truncates long text", () => {
    expect(truncateText("abcdef", 4)).toBe("abcd...");
    expect(truncateText("abc", 10)).toBe("abc");
  });

  it("extracts text parts from a message", () => {
    const message: RequestMessage = {
      role: "user",
      parts: [
        { type: "text", text: "第一句" },
        { type: "text", text: "第二句" },
        { type: "dynamic-tool", toolName: "designStageFile", state: "output-available" },
      ],
    };

    expect(getMessageText(message)).toBe("第一句\n第二句");
  });

  it("normalizes raw messages and filters invalid roles", () => {
    const result = normalizeMessages([
      {
        role: "user",
        parts: [{ type: "text", text: "请保持幽默口吻" }],
      },
      {
        role: "assistant",
        parts: [{ type: "text", text: "好的" }],
      },
      {
        role: "unknown",
        parts: [{ type: "text", text: "should be removed" }],
      },
      null,
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("user");
    expect(result[1].role).toBe("assistant");
  });

  it("builds transcript from normalized messages", () => {
    const transcript = buildTranscript([
      {
        role: "user",
        parts: [{ type: "text", text: "不要魔法元素" }],
      },
      {
        role: "assistant",
        parts: [{ type: "text", text: "收到，会保持科学具象化" }],
      },
    ]);

    expect(transcript).toContain("用户：不要魔法元素");
    expect(transcript).toContain("助手：收到，会保持科学具象化");
  });

  it("builds layered memory context from structured memory", () => {
    const context = buildLayeredMemoryContext({
      userConstraints: ["不要出现魔法元素", "整体文风保持幽默"],
      workflowState: ["题组1概念已确认", "当前等待验证结果"],
      recentTools: ["designStageFile", "validateStageFile"],
    });

    expect(context).toContain("# Layered Memory");
    expect(context).toContain("## User Constraints");
    expect(context).toContain("不要出现魔法元素");
    expect(context).toContain("## Workflow State");
    expect(context).toContain("题组1概念已确认");
    expect(context).toContain("## Recent Tools");
    expect(context).toContain("designStageFile");
  });

  it("returns empty memory context when all sections are empty", () => {
    expect(
      buildLayeredMemoryContext({
        userConstraints: [],
        workflowState: [],
        recentTools: [],
      })
    ).toBe("");
  });
});