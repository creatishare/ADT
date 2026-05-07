import { tool } from "ai";
import { z } from "zod";
import { type LanguageModel } from "ai";
import { DESIGNER_PROMPT } from "@/lib/agents/prompts";
import type { ModelId } from "@/lib/llm/providers";
import type { ToolOutput } from "./types";
import {
  runSubAgentText,
  SUB_AGENT_TIMEOUT_HEAVY_MS,
  SUB_AGENT_TIMEOUT_LIGHT_MS,
} from "./shared";

/**
 * Schema for the designStageFile tool, exported separately so it can be
 * unit-tested directly without spinning up an LLM.
 */
export const designStageFileInputSchema = z.object({
  topicInfo: z.string().describe("当前题组的题目、代码、知识点等信息（adapt_concepts 模式下传入课节文档全文）"),
  worldview: z.string().describe("阶段剧情世界观设定"),
  mode: z
    .enum(["generate_concepts", "integrate_document", "adapt_concepts"])
    .describe(
      "运行模式：生成5个概念(generate_concepts) / 整合为初步文档(integrate_document) / 整合用户已有壳子方案(adapt_concepts)"
    ),
  selectedConcepts: z
    .string()
    .optional()
    .describe(
      "integrate_document 模式：用户挑选出的最终概念汇总信息；adapt_concepts 模式：用户上传的壳子方案文档全文"
    ),
  userGuidance: z
    .string()
    .optional()
    .describe(
      "【极其重要】从对话历史中总结出的用户指导、偏好、修改意见和避坑规则。必须传递给子Agent！"
    ),
  courseCode: z
    .string()
    .optional()
    .describe(
      "课程编号，格式：L{单元}-{课节}-{高/低年级}-题组{编号}，如 L3-1-高-题组2。从课节文档文件名或内容中提取。"
    ),
});

export type DesignStageFileInput = z.infer<typeof designStageFileInputSchema>;
type DesignMode = DesignStageFileInput["mode"];

function buildPrompt(
  input: DesignStageFileInput,
  effectiveGuidance: string,
): string {
  const { topicInfo, worldview, selectedConcepts } = input;
  const guidanceBlock = effectiveGuidance
    ? `【用户特别指导意见 (重要！)】：\n${effectiveGuidance}\n\n`
    : "";

  switch (input.mode) {
    case "generate_concepts":
      return (
        `【世界观设定】：\n${worldview}\n\n` +
        `【题组信息】：\n${topicInfo}\n\n` +
        guidanceBlock +
        `请严格遵循无魔法、科学具象化原则，针对当前这一个题组，生成5个高质量的"核心包装概念"。`
      );
    case "integrate_document":
      return (
        `【世界观设定】：\n${worldview}\n\n` +
        `【选定的概念信息】：\n${selectedConcepts ?? ""}\n\n` +
        guidanceBlock +
        `请将以上选中的概念整合成一份完整的"初步策划文档"。包含：关卡编号、效果描述、映射关系（表格形式），以及题组前后剧情衔接。`
      );
    case "adapt_concepts":
      return (
        `【世界观设定】：\n${worldview}\n\n` +
        `【课节知识点（含每个题组的代码与知识点）】：\n${topicInfo}\n\n` +
        `【用户已有壳子方案文档全文】：\n${selectedConcepts ?? ""}\n\n` +
        guidanceBlock +
        `请按 DESIGNER_PROMPT 中"mode = 'adapt_concepts'"章节的硬性约束，整合用户壳子方案为一份"初步策划文档"。` +
        `**保持玩法本质不变**（动作类型 / 阶段覆盖 / 双向流），仅做轻量适配（题材包装 / 命名 / 视觉细节），并用 1-2 句剧情把所有题组串成一条主线。` +
        `请在文档开头追加"适配前后差异对照"小节，便于人工核对。`
      );
  }
}

function getArtifactTitle(mode: DesignMode): string {
  switch (mode) {
    case "generate_concepts":
      return "核心包装概念";
    case "integrate_document":
      return "初步策划文档";
    case "adapt_concepts":
      return "整合后初步策划文档";
  }
}

function getTimeoutMs(mode: DesignMode): number {
  // adapt_concepts 与 integrate_document 都是文档级输出，使用 heavy 超时；
  // generate_concepts 仍走 light 超时。
  return mode === "generate_concepts"
    ? SUB_AGENT_TIMEOUT_LIGHT_MS
    : SUB_AGENT_TIMEOUT_HEAVY_MS;
}

export function createDesignStageFileTool(
  subAgentModel: LanguageModel,
  modelId: ModelId,
  fallbackGuidance: string = ""
) {
  return tool({
    description:
      "第一/三/六步：针对单个题组生成5个核心包装概念（generate_concepts），或整合选中概念为初步文档（integrate_document），或整合用户已有壳子方案（adapt_concepts，整合模式专用）。",
    inputSchema: designStageFileInputSchema,
    execute: async (input): Promise<ToolOutput> => {
      const effectiveGuidance =
        input.userGuidance?.trim() || fallbackGuidance;
      const prompt = buildPrompt(input, effectiveGuidance);

      const text = await runSubAgentText({
        model: subAgentModel,
        modelId,
        system: DESIGNER_PROMPT,
        prompt,
        timeoutMs: getTimeoutMs(input.mode),
      });

      return {
        content: text,
        artifact: {
          title: getArtifactTitle(input.mode),
          type: "markdown",
          content: text,
          courseCode: input.courseCode,
        },
      };
    },
  });
}
