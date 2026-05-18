import { describe, expect, it, vi } from "vitest";
import type { LanguageModel } from "ai";
import {
  __testables,
  designStageFileInputSchema,
} from "./designStageFile";
import * as shared from "./shared";
import type { ConceptList } from "@/lib/agents/schemas";

const baseInput = {
  topicInfo: "题组 1：for 循环",
  worldview: "宇宙基地",
};

describe("designStageFile inputSchema", () => {
  it("accepts the original 'generate_concepts' mode", () => {
    const r = designStageFileInputSchema.safeParse({
      ...baseInput,
      mode: "generate_concepts",
    });
    expect(r.success).toBe(true);
  });

  it("accepts the original 'integrate_document' mode", () => {
    const r = designStageFileInputSchema.safeParse({
      ...baseInput,
      mode: "integrate_document",
      selectedConcepts: "选中的 4 个概念",
    });
    expect(r.success).toBe(true);
  });

  it("accepts the new 'adapt_concepts' mode", () => {
    const r = designStageFileInputSchema.safeParse({
      ...baseInput,
      mode: "adapt_concepts",
      selectedConcepts: "用户上传的壳子方案文档全文",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown mode value", () => {
    const r = designStageFileInputSchema.safeParse({
      ...baseInput,
      mode: "totally-made-up",
    });
    expect(r.success).toBe(false);
  });

  it("requires topicInfo and worldview", () => {
    const missingTopic = designStageFileInputSchema.safeParse({
      worldview: "x",
      mode: "generate_concepts",
    });
    expect(missingTopic.success).toBe(false);

    const missingWorld = designStageFileInputSchema.safeParse({
      topicInfo: "x",
      mode: "generate_concepts",
    });
    expect(missingWorld.success).toBe(false);
  });

  it("allows optional userGuidance and courseCode", () => {
    const r = designStageFileInputSchema.safeParse({
      ...baseInput,
      mode: "adapt_concepts",
      selectedConcepts: "壳子",
      userGuidance: "[mode:integration] 保持玩法本质",
      courseCode: "L3-1-高-题组1",
    });
    expect(r.success).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// generate_concepts 路径：schema + lint+retry 闭环
// -----------------------------------------------------------------------------

const cleanConceptList: ConceptList = {
  concepts: Array.from({ length: 5 }, (_, i) => ({
    title: `干净概念 ${i + 1}`,
    themeDimension: "机械工程" as const,
    oneLineWrapper: `工程车在传送带循环 ${i + 1} 次抓取货物`,
    dramaticConflict: {
      blocker: `${i + 1} 件不同形状的货物分散在传送带不同位置，机械臂一次只能夹一件`,
      whyThisCode:
        "货物件数由调度系统在运行时下发，事前无法写死固定行数；只能用循环按件数迭代",
      failureCost: "漏夹任何一件就触发流水线停机、整批订单作废",
    },
    codeMapping: [
      {
        structure: "for 循环",
        phase: "进入" as const,
        stageEffect: "机械臂启动到位",
      },
      {
        structure: "for 循环",
        phase: "迭代" as const,
        stageEffect: "机械臂抓取一块货物",
      },
      {
        structure: "for 循环",
        phase: "退出" as const,
        stageEffect: "电子屏显示总数",
      },
    ],
    visualKeyElements: ["机械臂", "传送带", "电子屏"],
    diffFromOthers: "强调机械重复，与其他概念形成题材差异",
    productionDifficulty: "简单" as const,
    vocabularyCheck: "全部使用推荐词汇白名单中的具象词",
  })),
};

const dirtyConceptList: ConceptList = {
  concepts: Array.from({ length: 5 }, (_, i) => ({
    ...cleanConceptList.concepts[i]!,
    // 在第一个概念的 stageEffect 中故意混入硬核词汇 + 制作复杂度
    oneLineWrapper:
      i === 0
        ? "引力锚定桩在地下层叠压缩，触发弹簧反弹机关"
        : cleanConceptList.concepts[i]!.oneLineWrapper,
  })),
};

const fakeModel = {} as unknown as LanguageModel;

describe("designStageFile · schema path (provider supports structured output)", () => {
  it("returns immediately with no hits when first generation is clean", async () => {
    const spy = vi
      .spyOn(shared, "runSubAgentObject")
      .mockResolvedValueOnce(cleanConceptList);

    const result = await __testables.runGenerateConceptsWithLint({
      subAgentModel: fakeModel,
      modelId: "gemini-3.1",
      system: "test",
      prompt: "生成 5 个概念",
      timeoutMs: 60_000,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    // 干净 list 序列化后 markdown 应含概念标题
    expect(result.markdown).toContain("概念 1：干净概念 1");
    expect(result.lintHitsAfterRetry).toEqual([]);

    spy.mockRestore();
  });

  it("retries with feedback prompt when blacklist is hit on first try", async () => {
    const spy = vi
      .spyOn(shared, "runSubAgentObject")
      .mockResolvedValueOnce(dirtyConceptList) // 第一次：脏
      .mockResolvedValueOnce(cleanConceptList); // 第二次：干净

    const result = await __testables.runGenerateConceptsWithLint({
      subAgentModel: fakeModel,
      modelId: "gemini-3.1",
      system: "test",
      prompt: "生成 5 个概念",
      timeoutMs: 60_000,
    });

    expect(spy).toHaveBeenCalledTimes(2);
    // 第二次调用的 prompt 应该包含 lint 反馈段
    const secondCallArgs = spy.mock.calls[1]?.[0];
    expect(secondCallArgs?.prompt).toContain("lint 检查");
    expect(secondCallArgs?.prompt).toContain("引力锚");
    // 最终结果干净
    expect(result.markdown).toContain("概念 1：干净概念 1");
    expect(result.lintHitsAfterRetry).toEqual([]);

    spy.mockRestore();
  });

  it("surfaces remaining lint hits when retry cap is exhausted (graceful degrade)", async () => {
    // 每次都返回脏 list，重试也救不了
    const spy = vi
      .spyOn(shared, "runSubAgentObject")
      .mockResolvedValue(dirtyConceptList);

    const result = await __testables.runGenerateConceptsWithLint({
      subAgentModel: fakeModel,
      modelId: "gemini-3.1",
      system: "test",
      prompt: "生成 5 个概念",
      timeoutMs: 60_000,
    });

    // LINT_MAX_RETRIES=1，所以共调 2 次（首发 + 重试 1 次）
    expect(spy).toHaveBeenCalledTimes(1 + __testables.LINT_MAX_RETRIES);
    // 报告最终仍命中黑名单
    expect(result.lintHitsAfterRetry.length).toBeGreaterThan(0);
    const offendingWords = result.lintHitsAfterRetry.map((h) => h.word);
    expect(offendingWords).toContain("引力锚");

    spy.mockRestore();
  });
});

// -----------------------------------------------------------------------------
// 文本回退路径：当 provider（如 DeepSeek）不支持 generateObject 的
// response_format JSON-schema 模式时，自动降级到 generateText + 同样的 lint+retry。
// 真实触发错误样例（DeepSeek 2026-05-08）：
//   "[unsupported_response_format] ... This response_format type is unavailable now"
// -----------------------------------------------------------------------------

const cleanMarkdown = `## 概念 1：干净的传送带概念

- **题材维度**：机械工程
- **代码映射表**：详见正文表格
- **制作难度自评**：简单
`;

const dirtyMarkdown = `## 概念 1：引力锚定桩在地下层叠压缩

- **题材维度**：航天探索
- 触发弹簧反弹机关。
`;

describe("designStageFile · text fallback when provider rejects schema mode", () => {
  it("falls back to runSubAgentText when first call throws unsupported_response_format", async () => {
    const objectSpy = vi
      .spyOn(shared, "runSubAgentObject")
      .mockRejectedValueOnce(
        new Error(
          "[unsupported_response_format] 子 Agent 当前供应商不支持结构化输出（response_format JSON schema），将回退到文本路径。原始错误：This response_format type is unavailable now",
        ),
      );
    const textSpy = vi
      .spyOn(shared, "runSubAgentText")
      .mockResolvedValueOnce(cleanMarkdown);

    const result = await __testables.runGenerateConceptsWithLint({
      subAgentModel: fakeModel,
      modelId: "deepseek-v4-pro",
      system: "test",
      prompt: "生成 5 个概念",
      timeoutMs: 60_000,
    });

    expect(objectSpy).toHaveBeenCalledTimes(1);
    expect(textSpy).toHaveBeenCalledTimes(1);
    expect(result.markdown).toBe(cleanMarkdown);
    expect(result.lintHitsAfterRetry).toEqual([]);

    objectSpy.mockRestore();
    textSpy.mockRestore();
  });

  it("text fallback also retries once with feedback when lint hits", async () => {
    const objectSpy = vi
      .spyOn(shared, "runSubAgentObject")
      .mockRejectedValueOnce(
        new Error("[unsupported_response_format] ..."),
      );
    const textSpy = vi
      .spyOn(shared, "runSubAgentText")
      .mockResolvedValueOnce(dirtyMarkdown) // 第一次返回带"引力锚 / 地下 / 弹簧反弹"
      .mockResolvedValueOnce(cleanMarkdown); // 第二次干净

    const result = await __testables.runGenerateConceptsWithLint({
      subAgentModel: fakeModel,
      modelId: "deepseek-v4-pro",
      system: "test",
      prompt: "生成 5 个概念",
      timeoutMs: 60_000,
    });

    expect(objectSpy).toHaveBeenCalledTimes(1);
    expect(textSpy).toHaveBeenCalledTimes(2);

    const secondTextCall = textSpy.mock.calls[1]?.[0];
    expect(secondTextCall?.prompt).toContain("lint 检查");
    expect(secondTextCall?.prompt).toContain("引力锚");

    expect(result.markdown).toBe(cleanMarkdown);
    expect(result.lintHitsAfterRetry).toEqual([]);

    objectSpy.mockRestore();
    textSpy.mockRestore();
  });

  it("does NOT fall back for non-unsupported errors (e.g. network timeout)", async () => {
    const objectSpy = vi
      .spyOn(shared, "runSubAgentObject")
      .mockRejectedValueOnce(
        new Error("[network_timeout] 子 Agent 调用超时（60s 内未返回）。"),
      );
    const textSpy = vi.spyOn(shared, "runSubAgentText");

    await expect(
      __testables.runGenerateConceptsWithLint({
        subAgentModel: fakeModel,
        modelId: "gemini-3.1",
        system: "test",
        prompt: "生成 5 个概念",
        timeoutMs: 60_000,
      }),
    ).rejects.toThrow(/network_timeout/);

    expect(objectSpy).toHaveBeenCalledTimes(1);
    expect(textSpy).not.toHaveBeenCalled();

    objectSpy.mockRestore();
    textSpy.mockRestore();
  });
});

// -----------------------------------------------------------------------------
// 新增 fallback 触发点：provider 接受 schema 但 LLM 输出不符合 schema。
// 真实失败案例（用户反馈 2026-05-13）：concept-schema 升级加入 dramaticConflict 后，
// Gemini schema 模式偶发 "No object generated: could not parse the response"。
// 此前只有 [unsupported_response_format] 会 fallback，这种 case 直接报红。
// -----------------------------------------------------------------------------

describe("designStageFile · text fallback when LLM output fails schema validation", () => {
  it("falls back to runSubAgentText on [schema_parse_failed]", async () => {
    const objectSpy = vi
      .spyOn(shared, "runSubAgentObject")
      .mockRejectedValueOnce(
        new Error(
          "[schema_parse_failed] 子 Agent 结构化输出未通过 schema 校验（缺字段 / 长度不足 / 格式偏离），将回退到文本路径。原始错误：No object generated: could not parse the response.",
        ),
      );
    const textSpy = vi
      .spyOn(shared, "runSubAgentText")
      .mockResolvedValueOnce(cleanMarkdown);

    const result = await __testables.runGenerateConceptsWithLint({
      subAgentModel: fakeModel,
      modelId: "gemini-3.1",
      system: "test",
      prompt: "生成 5 个概念",
      timeoutMs: 60_000,
    });

    expect(objectSpy).toHaveBeenCalledTimes(1);
    expect(textSpy).toHaveBeenCalledTimes(1);
    expect(result.markdown).toBe(cleanMarkdown);
    expect(result.lintHitsAfterRetry).toEqual([]);

    objectSpy.mockRestore();
    textSpy.mockRestore();
  });

  it("schema_parse_failed fallback also feeds the lint+retry loop", async () => {
    const objectSpy = vi
      .spyOn(shared, "runSubAgentObject")
      .mockRejectedValueOnce(new Error("[schema_parse_failed] ..."));
    const textSpy = vi
      .spyOn(shared, "runSubAgentText")
      .mockResolvedValueOnce(dirtyMarkdown)
      .mockResolvedValueOnce(cleanMarkdown);

    const result = await __testables.runGenerateConceptsWithLint({
      subAgentModel: fakeModel,
      modelId: "gemini-3.1",
      system: "test",
      prompt: "生成 5 个概念",
      timeoutMs: 60_000,
    });

    expect(objectSpy).toHaveBeenCalledTimes(1);
    expect(textSpy).toHaveBeenCalledTimes(2);
    expect(result.markdown).toBe(cleanMarkdown);
    expect(result.lintHitsAfterRetry).toEqual([]);

    objectSpy.mockRestore();
    textSpy.mockRestore();
  });
});
