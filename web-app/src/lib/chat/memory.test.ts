import { describe, expect, it } from "vitest";
import {
  applyHeadAnchorWindow,
  buildLayeredMemoryContext,
  buildTranscript,
  getMessageText,
  normalizeMessages,
  truncateText,
  type RequestMessage,
} from "./memory";

function userMsg(text: string): RequestMessage {
  return { role: "user", parts: [{ type: "text", text }] };
}

function assistantMsg(text: string): RequestMessage {
  return { role: "assistant", parts: [{ type: "text", text }] };
}

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
    expect(result[0]!.role).toBe("user");
    expect(result[1]!.role).toBe("assistant");
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

// ----------------------------------------------------------------------------
// applyHeadAnchorWindow —— 解决长会话中 kickoff 消息（含 4 题组完整知识点）
// 被 slice(-MAX_RECENT_MESSAGES) 切出窗口的 bug。
// 真实场景：标准模式下题组 1-2 反复修改 → 历史 16+ 消息 → 第 1 条 user 消息
//   被切走 → Orchestrator 调 designStageFile 时找不到题组 3 的题干。
// ----------------------------------------------------------------------------

describe("applyHeadAnchorWindow", () => {
  it("returns the input unchanged when total length is within the window", () => {
    const msgs = [userMsg("kickoff"), assistantMsg("ok"), userMsg("第 2 轮")];
    expect(applyHeadAnchorWindow(msgs, 8)).toEqual(msgs);
  });

  it("anchors the first user message + the last (maxRecent-1) messages when long", () => {
    const msgs: RequestMessage[] = [
      userMsg("KICKOFF · 4 题组完整知识点"),
      assistantMsg("回应 1"),
      userMsg("反馈 2"),
      assistantMsg("回应 2"),
      userMsg("反馈 3"),
      assistantMsg("回应 3"),
      userMsg("反馈 4"),
      assistantMsg("回应 4"),
      userMsg("反馈 5"),
      assistantMsg("回应 5"),
      userMsg("反馈 6"),
    ];
    const out = applyHeadAnchorWindow(msgs, 4);
    // 4 = 1 头锚 + 最近 3
    expect(out).toHaveLength(4);
    expect(getMessageText(out[0]!)).toBe("KICKOFF · 4 题组完整知识点");
    // 末尾 3 条应为最近 3 条原始消息
    expect(getMessageText(out[1]!)).toBe(getMessageText(msgs[msgs.length - 3]!));
    expect(getMessageText(out[2]!)).toBe(getMessageText(msgs[msgs.length - 2]!));
    expect(getMessageText(out[3]!)).toBe(getMessageText(msgs[msgs.length - 1]!));
  });

  it("does NOT duplicate the kickoff when it already lives inside the recent window", () => {
    const msgs: RequestMessage[] = [
      userMsg("kickoff"),
      assistantMsg("a"),
      userMsg("b"),
      assistantMsg("c"),
    ];
    // window=4 includes everything → kickoff shouldn't be prepended again
    const out = applyHeadAnchorWindow(msgs, 4);
    expect(out).toHaveLength(4);
    const kickoffOccurrences = out.filter(
      (m) => m.role === "user" && getMessageText(m) === "kickoff",
    ).length;
    expect(kickoffOccurrences).toBe(1);
  });

  it("falls back to slice(-maxRecent) when there is no user-role message at all", () => {
    const msgs: RequestMessage[] = [
      assistantMsg("a"),
      assistantMsg("b"),
      assistantMsg("c"),
      assistantMsg("d"),
      assistantMsg("e"),
    ];
    const out = applyHeadAnchorWindow(msgs, 3);
    expect(out).toHaveLength(3);
    expect(out).toEqual(msgs.slice(-3));
  });

  it("returns empty for empty input", () => {
    expect(applyHeadAnchorWindow([], 8)).toEqual([]);
  });

  it("returns empty when maxRecent is 0 or negative", () => {
    const msgs = [userMsg("a"), assistantMsg("b")];
    expect(applyHeadAnchorWindow(msgs, 0)).toEqual([]);
    expect(applyHeadAnchorWindow(msgs, -1)).toEqual([]);
  });

  it("when maxRecent is 1, drops the anchor and returns just the last message (anchor cannot fit)", () => {
    const msgs: RequestMessage[] = [
      userMsg("kickoff"),
      assistantMsg("a"),
      userMsg("b"),
      assistantMsg("c"),
    ];
    const out = applyHeadAnchorWindow(msgs, 1);
    expect(out).toHaveLength(1);
    expect(getMessageText(out[0]!)).toBe("c");
  });

  it("skips leading assistant/system messages to locate the FIRST user message", () => {
    // 防御性场景：如果 history 由 system / assistant 起头（罕见但可能）
    const msgs: RequestMessage[] = [
      assistantMsg("welcome"),
      userMsg("KICKOFF"),
      assistantMsg("a"),
      userMsg("b"),
      assistantMsg("c"),
      userMsg("d"),
      assistantMsg("e"),
      userMsg("f"),
      assistantMsg("g"),
      userMsg("h"),
    ];
    const out = applyHeadAnchorWindow(msgs, 4);
    expect(out).toHaveLength(4);
    expect(getMessageText(out[0]!)).toBe("KICKOFF");
    // 后面 3 条 = 最近 3 条 = msgs[7], msgs[8], msgs[9]
    expect(getMessageText(out[1]!)).toBe("f");
    expect(getMessageText(out[2]!)).toBe("g");
    expect(getMessageText(out[3]!)).toBe("h");
  });

  it("preserves immutability: input array is not mutated", () => {
    const msgs: RequestMessage[] = [
      userMsg("kickoff"),
      assistantMsg("a"),
      userMsg("b"),
      assistantMsg("c"),
      userMsg("d"),
    ];
    const before = msgs.map((m) => getMessageText(m));
    applyHeadAnchorWindow(msgs, 2);
    const after = msgs.map((m) => getMessageText(m));
    expect(after).toEqual(before);
  });
});