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

export function createDesignStageFileTool(
  subAgentModel: LanguageModel,
  modelId: ModelId,
  fallbackGuidance: string = ""
) {
  return tool({
    description:
      "第一步/第六步：针对单个题组，根据核心知识点和世界观生成5个核心包装概念，或者将选中概念整合为初步策划文档。",
    inputSchema: z.object({
      topicInfo: z.string().describe("当前题组的题目、代码、知识点等信息"),
      worldview: z.string().describe("阶段剧情世界观设定"),
      mode: z
        .enum(["generate_concepts", "integrate_document"])
        .describe(
          "运行模式：生成5个概念(generate_concepts) 或 整合为初步文档(integrate_document)"
        ),
      selectedConcepts: z
        .string()
        .optional()
        .describe("整合模式下，用户挑选出的最终概念汇总信息"),
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
    }),
    execute: async ({
      topicInfo,
      worldview,
      mode,
      selectedConcepts,
      userGuidance,
      courseCode,
    }): Promise<ToolOutput> => {
      const effectiveGuidance = userGuidance?.trim() || fallbackGuidance;
      let prompt = "";
      if (mode === "generate_concepts") {
        prompt = `【世界观设定】：\n${worldview}\n\n【题组信息】：\n${topicInfo}\n\n`;
        if (effectiveGuidance) {
          prompt += `【用户特别指导意见 (重要！)】：\n${effectiveGuidance}\n\n`;
        }
        prompt += `请严格遵循无魔法、科学具象化原则，针对当前这一个题组，生成5个高质量的"核心包装概念"。`;
      } else {
        prompt = `【世界观设定】：\n${worldview}\n\n【选定的概念信息】：\n${selectedConcepts}\n\n`;
        if (effectiveGuidance) {
          prompt += `【用户特别指导意见 (重要！)】：\n${effectiveGuidance}\n\n`;
        }
        prompt += `请将以上选中的概念整合成一份完整的"初步策划文档"。包含：关卡编号、效果描述、映射关系（表格形式），以及题组前后剧情衔接。`;
      }

      const timeoutMs =
        mode === "integrate_document"
          ? SUB_AGENT_TIMEOUT_HEAVY_MS
          : SUB_AGENT_TIMEOUT_LIGHT_MS;

      const text = await runSubAgentText({
        model: subAgentModel,
        modelId,
        system: DESIGNER_PROMPT,
        prompt,
        timeoutMs,
      });

      const title =
        mode === "generate_concepts" ? "核心包装概念" : "初步策划文档";
      return {
        content: text,
        artifact: { title, type: "markdown", content: text, courseCode },
      };
    },
  });
}
