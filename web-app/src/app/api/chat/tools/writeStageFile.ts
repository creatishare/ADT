import { tool, generateText, type LanguageModel } from "ai";
import { z } from "zod";
import { WRITER_PROMPT } from "@/lib/agents/prompts";
import type { ToolOutput } from "./types";

export function createWriteStageFileTool(
  subAgentModel: LanguageModel,
  fallbackGuidance: string = ""
) {
  return tool({
    description:
      "第七步：将通过验证的初步策划方案转化为面向编剧老师的《关卡设计介绍文档》。",
    inputSchema: z.object({
      validatedDocument: z
        .string()
        .describe("审核通过的最终策划方案内容"),
      worldview: z
        .string()
        .describe("阶段剧情世界观设定（确保文档风格符合设定）"),
      userGuidance: z
        .string()
        .optional()
        .describe(
          "【极其重要】从对话历史中总结出的用户指导、排版偏好或用词规则。必须传递！"
        ),
      courseCode: z
        .string()
        .optional()
        .describe(
          "课程编号，格式：L{单元}-{课节}-{高/低年级}-题组{编号}，如 L3-1-高-题组2。从课节文档文件名或内容中提取。"
        ),
    }),
    execute: async ({
      validatedDocument,
      worldview,
      userGuidance,
      courseCode,
    }): Promise<ToolOutput> => {
      const effectiveGuidance = userGuidance?.trim() || fallbackGuidance;
      let prompt = `【世界观设定】：\n${worldview}\n\n【通过验证的策划方案】：\n${validatedDocument}\n\n`;
      if (effectiveGuidance) {
        prompt += `【用户特别指导意见 (重要！)】：\n${effectiveGuidance}\n\n`;
      }
      prompt += `请将以上内容扩展撰写为正式落地的《关卡设计介绍文档》。包含关卡设计总览表、单个关卡的详细方案（附前后剧情）以及可替换效果类型表。`;

      const { text } = await generateText({
        model: subAgentModel,
        system: WRITER_PROMPT,
        prompt,
      });

      return {
        content: text,
        artifact: { title: "关卡设计介绍文档", type: "markdown", content: text, courseCode },
      };
    },
  });
}
