import { tool, generateText, type LanguageModel } from "ai";
import { z } from "zod";
import { VISUAL_PROMPT } from "@/lib/agents/prompts";
import type { ToolOutput } from "./types";

export function createGenerateVisualDesignTool(
  subAgentModel: LanguageModel,
  fallbackGuidance: string = ""
) {
  return tool({
    description:
      "第七步后：根据最终输出的《关卡设计介绍文档》生成即梦提示词 (JM-VisualDesigner)。",
    inputSchema: z.object({
      finalDocument: z
        .string()
        .describe("最终定稿的《关卡设计介绍文档》"),
      userGuidance: z
        .string()
        .optional()
        .describe(
          "【极其重要】用户对于画面色调、艺术风格的偏好。必须传递！"
        ),
      courseCode: z
        .string()
        .optional()
        .describe(
          "课程编号，格式：L{单元}-{课节}-{高/低年级}-题组{编号}，如 L3-1-高-题组2。从课节文档文件名或内容中提取。"
        ),
    }),
    execute: async ({ finalDocument, userGuidance, courseCode }): Promise<ToolOutput> => {
      const effectiveGuidance = userGuidance?.trim() || fallbackGuidance;
      let prompt = `【关卡设计介绍文档】：\n${finalDocument}\n\n`;
      if (effectiveGuidance) {
        prompt += `【用户对于画面和美术风格的要求 (重要！)】：\n${effectiveGuidance}\n\n`;
      }
      prompt += `请提取视觉需求，并输出符合要求的、精准的英文提示词（需说明 2K, 4:3 设置，同题组去重）。`;

      const { text } = await generateText({
        model: subAgentModel,
        system: VISUAL_PROMPT,
        prompt,
      });

      const visualContent = `# 即梦提示词 (Dreamina Prompts)\n\n${text}\n\n*(注意：在完整版本中，将通过即梦 CLI 自动渲染图片)*`;

      return {
        content: visualContent,
        artifact: { title: "即梦提示词", type: "markdown", content: visualContent, courseCode },
      };
    },
  });
}
