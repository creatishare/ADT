import { describe, expect, it } from "vitest";
import {
  EMPTY_GUIDANCE,
  mergeGuidance,
  parseGuidance,
  serializeGuidanceForPrompt,
  type GuidanceModel,
} from "./guidance";

describe("parseGuidance", () => {
  it("returns EMPTY_GUIDANCE for non-object input", () => {
    expect(parseGuidance(null)).toEqual(EMPTY_GUIDANCE);
    expect(parseGuidance(undefined)).toEqual(EMPTY_GUIDANCE);
    expect(parseGuidance(42)).toEqual(EMPTY_GUIDANCE);
    expect(parseGuidance("x")).toEqual(EMPTY_GUIDANCE);
  });

  it("treats legacy string[] as wordingStyle (backward compatibility)", () => {
    const legacy = ["避免折叠机构", "动作流程统一用现在时"];
    const out = parseGuidance(legacy);
    expect(out.wordingStyle).toEqual(legacy);
    expect(out.logicVisualPatterns).toEqual([]);
    expect(out.perGroupTheme).toEqual({});
  });

  it("filters out empty strings from legacy arrays", () => {
    const out = parseGuidance(["", "real-line", ""]);
    expect(out.wordingStyle).toEqual(["real-line"]);
  });

  it("accepts a well-formed structured object", () => {
    const input = {
      logicVisualPatterns: [
        {
          construct: "for循环退出",
          pattern: "计数器跳动+绿灯亮",
          polarity: "prefer",
          sourceGroup: "L3-1-高-题组1",
        },
      ],
      wordingStyle: ["现在时"],
      avoidances: ["折叠机构"],
      perGroupTheme: {
        "L3-1-高-题组1": { theme: "航天探索", note: "概念3" },
      },
      mode: "standard",
    };
    const out = parseGuidance(input);
    expect(out.logicVisualPatterns).toHaveLength(1);
    expect(out.logicVisualPatterns[0]?.polarity).toBe("prefer");
    expect(out.wordingStyle).toEqual(["现在时"]);
    expect(out.avoidances).toEqual(["折叠机构"]);
    expect(out.perGroupTheme["L3-1-高-题组1"]?.theme).toBe("航天探索");
    expect(out.mode).toBe("standard");
  });

  it("recovers partial input dropping invalid items rather than throwing", () => {
    const out = parseGuidance({
      logicVisualPatterns: [
        { construct: "ok", pattern: "ok", polarity: "prefer" },
        { construct: "bad" /* missing pattern/polarity */ },
        "not-an-object",
      ],
      wordingStyle: ["a", 42, null, "b"],
      perGroupTheme: {
        good: { theme: "工程" },
        bad: { /* missing theme */ note: "x" },
      },
      mode: "not-a-mode",
    });
    expect(out.logicVisualPatterns).toHaveLength(1);
    expect(out.logicVisualPatterns[0]?.construct).toBe("ok");
    expect(out.wordingStyle).toEqual(["a", "b"]);
    expect(out.perGroupTheme.good?.theme).toBe("工程");
    expect(out.perGroupTheme.bad).toBeUndefined();
    expect(out.mode).toBeUndefined();
  });
});

describe("serializeGuidanceForPrompt", () => {
  const fullGuidance: GuidanceModel = {
    logicVisualPatterns: [
      {
        construct: "for循环退出",
        pattern: "计数器跳动+绿灯亮+UI显示总数",
        polarity: "prefer",
        reason: "孩子易懂",
        sourceGroup: "L3-1-高-题组1",
      },
      {
        construct: "递归归出",
        pattern: "栈塌缩动画",
        polarity: "avoid",
      },
    ],
    wordingStyle: ["动作流程统一用现在时"],
    avoidances: ["不要折叠机构"],
    perGroupTheme: {
      "L3-1-高-题组1": { theme: "航天探索", note: "概念3：火星探测车" },
      "L3-1-高-题组2": { theme: "机械工程" },
    },
    mode: "standard",
  };

  it("emits empty string for an empty model", () => {
    expect(serializeGuidanceForPrompt(EMPTY_GUIDANCE)).toBe("");
  });

  it("emits mode flag when defined", () => {
    const out = serializeGuidanceForPrompt({ ...EMPTY_GUIDANCE, mode: "single-group" });
    expect(out).toContain("[mode:single-group]");
  });

  it("emits logicVisualPatterns with ✓/✗ markers", () => {
    const out = serializeGuidanceForPrompt(fullGuidance);
    expect(out).toContain("## 跨题组逻辑↔舞台映射偏好");
    expect(out).toContain("✓ for循环退出 → 计数器跳动+绿灯亮+UI显示总数");
    expect(out).toContain("（原因：孩子易懂）");
    expect(out).toContain("✗ 递归归出 → 栈塌缩动画");
  });

  it("emits wordingStyle and avoidances sections when non-empty", () => {
    const out = serializeGuidanceForPrompt(fullGuidance);
    expect(out).toContain("## 用词与排版偏好");
    expect(out).toContain("- 动作流程统一用现在时");
    expect(out).toContain("## 用户明确禁忌");
    expect(out).toContain("- 不要折叠机构");
  });

  it("only emits the perGroupTheme entry matching activeCourseCode", () => {
    const out = serializeGuidanceForPrompt(fullGuidance, "L3-1-高-题组2");
    expect(out).toContain("## 当前题组题材（仅 L3-1-高-题组2）");
    expect(out).toContain("题材：机械工程");
    // Other groups' themes must NEVER leak into this serialization
    expect(out).not.toContain("航天探索");
    expect(out).not.toContain("L3-1-高-题组1");
  });

  it("omits the perGroupTheme section entirely when activeCourseCode is undefined", () => {
    const out = serializeGuidanceForPrompt(fullGuidance);
    expect(out).not.toContain("## 当前题组题材");
    // And no theme content leaks
    expect(out).not.toContain("航天探索");
    expect(out).not.toContain("机械工程");
  });

  it("omits the perGroupTheme section when activeCourseCode has no entry", () => {
    const out = serializeGuidanceForPrompt(fullGuidance, "L9-9-高-题组9");
    expect(out).not.toContain("## 当前题组题材");
  });

  it("skips empty sections without leaving empty headers", () => {
    const partial: GuidanceModel = {
      ...EMPTY_GUIDANCE,
      wordingStyle: ["only-this"],
    };
    const out = serializeGuidanceForPrompt(partial);
    expect(out).toContain("## 用词与排版偏好");
    expect(out).not.toContain("## 跨题组逻辑");
    expect(out).not.toContain("## 用户明确禁忌");
  });
});

describe("mergeGuidance", () => {
  it("returns a new object (no mutation of prev)", () => {
    const prev: GuidanceModel = {
      ...EMPTY_GUIDANCE,
      wordingStyle: ["a"],
    };
    const merged = mergeGuidance(prev, { wordingStyle: ["b"] });
    expect(prev.wordingStyle).toEqual(["a"]);
    expect(merged.wordingStyle).toEqual(["a", "b"]);
  });

  it("dedupes wordingStyle on merge", () => {
    const merged = mergeGuidance(
      { ...EMPTY_GUIDANCE, wordingStyle: ["a", "b"] },
      { wordingStyle: ["b", "c"] },
    );
    expect(merged.wordingStyle).toEqual(["a", "b", "c"]);
  });

  it("dedupes logicVisualPatterns by construct+polarity", () => {
    const prev: GuidanceModel = {
      ...EMPTY_GUIDANCE,
      logicVisualPatterns: [
        { construct: "for循环退出", pattern: "old", polarity: "prefer" },
      ],
    };
    const merged = mergeGuidance(prev, {
      logicVisualPatterns: [
        { construct: "for循环退出", pattern: "new-but-same-key", polarity: "prefer" },
        { construct: "for循环退出", pattern: "different-polarity-keeps", polarity: "avoid" },
        { construct: "递归归出", pattern: "p", polarity: "prefer" },
      ],
    });
    // First "for循环退出 prefer" wins; the duplicate is dropped.
    expect(merged.logicVisualPatterns).toHaveLength(3);
    expect(merged.logicVisualPatterns[0]?.pattern).toBe("old");
    expect(merged.logicVisualPatterns[1]?.polarity).toBe("avoid");
  });

  it("upserts perGroupTheme by courseCode without affecting others", () => {
    const prev: GuidanceModel = {
      ...EMPTY_GUIDANCE,
      perGroupTheme: { "L3-1-高-题组1": { theme: "航天" } },
    };
    const merged = mergeGuidance(prev, {
      perGroupTheme: {
        "L3-1-高-题组1": { theme: "航天", note: "微调" },
        "L3-1-高-题组2": { theme: "工程" },
      },
    });
    expect(merged.perGroupTheme["L3-1-高-题组1"]?.note).toBe("微调");
    expect(merged.perGroupTheme["L3-1-高-题组2"]?.theme).toBe("工程");
  });

  it("overrides mode only when delta.mode is defined", () => {
    const prev: GuidanceModel = { ...EMPTY_GUIDANCE, mode: "standard" };
    expect(mergeGuidance(prev, {}).mode).toBe("standard");
    expect(mergeGuidance(prev, { mode: "integration" }).mode).toBe("integration");
  });
});

describe("scope isolation — the cross-group bias regression test", () => {
  // This test pins down the core fix: theme picked for group 1 must never
  // leak into a sub-agent call targeting group 2.
  it("never leaks group-1 theme when serializing for group-2 courseCode", () => {
    const guidance: GuidanceModel = {
      ...EMPTY_GUIDANCE,
      perGroupTheme: {
        "L3-1-高-题组1": { theme: "航天探索" },
        "L3-1-高-题组2": { theme: "机械工程" },
      },
    };

    const forGroup2 = serializeGuidanceForPrompt(guidance, "L3-1-高-题组2");
    expect(forGroup2).not.toContain("航天探索");
    expect(forGroup2).not.toContain("题组1");
    expect(forGroup2).toContain("机械工程");
  });

  it("never leaks any theme when activeCourseCode is omitted (cross-group call)", () => {
    const guidance: GuidanceModel = {
      ...EMPTY_GUIDANCE,
      perGroupTheme: {
        "L3-1-高-题组1": { theme: "航天探索" },
        "L3-1-高-题组2": { theme: "机械工程" },
      },
    };

    const crossGroup = serializeGuidanceForPrompt(guidance);
    expect(crossGroup).not.toContain("航天探索");
    expect(crossGroup).not.toContain("机械工程");
  });
});
