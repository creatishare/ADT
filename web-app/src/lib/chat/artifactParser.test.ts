import { describe, expect, it } from "vitest";
import {
  normalizeMarkdown,
  parseOrchestratorState,
  parseValidationReport,
  serializeStateGuidance,
} from "./artifactParser";

describe("normalizeMarkdown — code-fence stripping", () => {
  it("strips a single internal ```markdown fence around a table", () => {
    const input = [
      "## 1. 关卡设计总览表",
      "",
      "```markdown",
      "| 题组 | courseCode | 核心知识点 |",
      "|------|-----------|-----------|",
      "| 题组1 | L16-1-发展-题组1 | for 循环 |",
      "```",
      "",
      "## 2. 单个关卡的详细设计方案",
    ].join("\n");

    const out = normalizeMarkdown(input);
    expect(out).not.toMatch(/```markdown/);
    expect(out).toContain("| 题组 | courseCode | 核心知识点 |");
    expect(out).toContain("## 1. 关卡设计总览表");
    expect(out).toContain("## 2. 单个关卡的详细设计方案");
  });

  it("strips multiple internal ```markdown fences in one document", () => {
    const input = [
      "## A",
      "```markdown",
      "**bold**",
      "```",
      "## B",
      "```md",
      "### inner",
      "```",
      "## C",
    ].join("\n");

    const out = normalizeMarkdown(input);
    expect(out).not.toMatch(/```(?:markdown|md)\b/);
    expect(out).toContain("**bold**");
    expect(out).toContain("### inner");
  });

  it("preserves generic ```bash / ```cpp code blocks (intentional code)", () => {
    const input = [
      "看下面这段代码：",
      "",
      "```bash",
      "dreamina generate --prompt \"...\"",
      "```",
      "",
      "或 C++：",
      "",
      "```cpp",
      "for(int i=0;i<3;i++) {}",
      "```",
    ].join("\n");

    const out = normalizeMarkdown(input);
    expect(out).toContain("```bash");
    expect(out).toContain("```cpp");
    expect(out).toContain("dreamina generate");
    expect(out).toContain("for(int i=0;i<3;i++)");
  });

  it("strips a single outer fence wrapping the entire document (legacy)", () => {
    const input = "```markdown\n# Title\n\nbody\n```";
    const out = normalizeMarkdown(input);
    expect(out.trimEnd()).toBe("# Title\n\nbody");
  });

  it("still normalizes em-dash separator rows after fence stripping", () => {
    const input = [
      "```markdown",
      "| A | B |",
      "|———|———|",
      "| 1 | 2 |",
      "```",
    ].join("\n");

    const out = normalizeMarkdown(input);
    expect(out).not.toMatch(/```/);
    expect(out).toMatch(/\|\s*-+\s*\|\s*-+\s*\|/);
  });
});

describe("parseValidationReport — dimension score extraction", () => {
  const sampleReport = `## 验证报告

### 总体结论
**需修改** 总分：17/20

### 评分明细
| 维度 | 得分 | 说明 |
|------|------|------|
| 非魔法性 | 5/5 | 所有现象均为科技设备与自然物理过程 |
| 代码-舞台一致性 | 3/5 | 题组2缺失递归"归出"阶段的逐层独立可视化 |
| 儿童认知适配 | 4/5 | 整体节奏适合 8-12 岁 |
| 剧情连贯性 | 5/5 | 题组之间衔接自然流畅 |

### 修改建议清单
1. **[题组2 · 代码-舞台一致性]**
   - 问题位置：题组2 描述
   - 具体修改：改为：补充递归归出动画
`;

  it("extracts every dimension row with name / score / description", () => {
    const report = parseValidationReport(sampleReport);
    expect(report.dimensions).toHaveLength(4);
    const byName = Object.fromEntries(
      report.dimensions.map((d) => [d.name, d])
    );
    expect(byName["非魔法性"]).toMatchObject({
      score: "5/5",
      scoreValue: 5,
      maxScore: 5,
      passed: true,
    });
    expect(byName["代码-舞台一致性"]).toMatchObject({
      score: "3/5",
      scoreValue: 3,
      maxScore: 5,
      passed: false,
    });
    expect(byName["代码-舞台一致性"]!.description).toContain("递归");
  });

  it("treats partial-score dimensions as failed", () => {
    const report = parseValidationReport(sampleReport);
    const failing = report.dimensions.filter((d) => !d.passed);
    expect(failing.map((d) => d.name)).toEqual([
      "代码-舞台一致性",
      "儿童认知适配",
    ]);
  });

  it("returns an empty dimensions array when no scoring table is present", () => {
    const report = parseValidationReport("## 验证报告\n\n通过\n");
    expect(report.dimensions).toEqual([]);
  });

  it("survives bold-wrapped cells like **非魔法性** | **5/5**", () => {
    const md = `## 验证报告

### 评分明细
| 维度 | 得分 | 说明 |
|------|------|------|
| **非魔法性** | **5/5** | 完全科学具象 |
| **代码-舞台一致性** | **2/5** | 缺反向流 |
`;
    const report = parseValidationReport(md);
    expect(report.dimensions).toHaveLength(2);
    expect(report.dimensions[0]!.name).toBe("非魔法性");
    expect(report.dimensions[1]!.scoreValue).toBe(2);
    expect(report.dimensions[1]!.passed).toBe(false);
  });

  it("ignores header and separator rows", () => {
    const report = parseValidationReport(sampleReport);
    expect(report.dimensions.find((d) => d.name === "维度")).toBeUndefined();
    expect(report.dimensions.find((d) => /^-+$/.test(d.name))).toBeUndefined();
  });

  it("preserves backwards-compat fields conclusion / suggestions", () => {
    const report = parseValidationReport(sampleReport);
    expect(report.conclusion).toBe("不通过，需修改");
    expect(report.suggestions.length).toBeGreaterThan(0);
  });
});

// ----------------------------------------------------------------------------
// parseOrchestratorState — structured guidance accumulator
// ----------------------------------------------------------------------------

describe("parseOrchestratorState — structured accumulatedGuidance", () => {
  function wrapState(json: string): string {
    return ["pre-text", "```state", json, "```", "post-text"].join("\n");
  }

  it("parses a structured GuidanceModel from the state block", () => {
    const json = JSON.stringify({
      currentStep: 2,
      processedGroups: ["题组1"],
      pendingGroups: ["题组2"],
      accumulatedGuidance: {
        logicVisualPatterns: [
          {
            construct: "for循环退出",
            pattern: "计数器跳动+绿灯亮",
            polarity: "prefer",
          },
        ],
        wordingStyle: ["现在时"],
        avoidances: [],
        perGroupTheme: {
          "L3-1-高-题组1": { theme: "航天探索" },
        },
        mode: "standard",
      },
    });

    const state = parseOrchestratorState(wrapState(json));
    expect(state).not.toBeNull();
    expect(state?.accumulatedGuidance.logicVisualPatterns).toHaveLength(1);
    expect(state?.accumulatedGuidance.wordingStyle).toEqual(["现在时"]);
    expect(state?.accumulatedGuidance.perGroupTheme["L3-1-高-题组1"]?.theme).toBe(
      "航天探索",
    );
    expect(state?.guidanceLines).toContain("✓ for循环退出 → 计数器跳动+绿灯亮");
    expect(state?.guidanceLines).toContain("现在时");
  });

  it("falls back gracefully when accumulatedGuidance is a legacy string[]", () => {
    const json = JSON.stringify({
      currentStep: 1,
      accumulatedGuidance: ["legacy line A", "legacy line B"],
    });

    const state = parseOrchestratorState(wrapState(json));
    expect(state).not.toBeNull();
    expect(state?.accumulatedGuidance.wordingStyle).toEqual([
      "legacy line A",
      "legacy line B",
    ]);
    expect(state?.guidanceLines).toEqual(["legacy line A", "legacy line B"]);
  });

  it("returns empty guidance when accumulatedGuidance is missing", () => {
    const json = JSON.stringify({ currentStep: 1 });
    const state = parseOrchestratorState(wrapState(json));
    expect(state?.accumulatedGuidance.logicVisualPatterns).toEqual([]);
    expect(state?.accumulatedGuidance.perGroupTheme).toEqual({});
    expect(state?.guidanceLines).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// serializeStateGuidance — per-group theme isolation regression test
// ----------------------------------------------------------------------------

describe("serializeStateGuidance — per-group theme isolation", () => {
  it("never includes theme entries for groups other than the active courseCode", () => {
    const json = JSON.stringify({
      accumulatedGuidance: {
        perGroupTheme: {
          "L3-1-高-题组1": { theme: "航天探索" },
          "L3-1-高-题组2": { theme: "机械工程" },
        },
      },
    });
    const state = parseOrchestratorState(
      ["```state", json, "```"].join("\n"),
    );
    expect(state).not.toBeNull();

    const forGroup2 = serializeStateGuidance(state!, "L3-1-高-题组2");
    expect(forGroup2).toContain("机械工程");
    expect(forGroup2).not.toContain("航天探索");

    const crossGroup = serializeStateGuidance(state!);
    expect(crossGroup).not.toContain("机械工程");
    expect(crossGroup).not.toContain("航天探索");
  });
});
