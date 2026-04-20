import { tool, generateText, type LanguageModel } from "ai";
import { z } from "zod";
import { VALIDATOR_PROMPT } from "@/lib/agents/prompts";
import type { ToolOutput } from "./types";

export function createValidateStageFileTool(subAgentModel: LanguageModel) {
  return tool({
    description:
      "第四步：验证策划师输出的初步策划文档是否包含魔法、逻辑是否自洽。",
    inputSchema: z.object({
      documentContent: z
        .string()
        .describe("需要验证的初步策划文档全文"),
      worldview: z.string().describe("阶段剧情世界观设定"),
      topicInfo: z.string().describe("课节关卡知识点信息整理"),
      userGuidance: z
        .string()
        .optional()
        .describe(
          "【极其重要】用户特别关心的验证重点或之前的踩坑点。必须传递！"
        ),
    }),
    execute: async ({
      documentContent,
      worldview,
      topicInfo,
      userGuidance,
    }): Promise<ToolOutput> => {
      let prompt = `【世界观设定】：\n${worldview}\n\n【知识点信息】：\n${topicInfo}\n\n【需要审查的初步策划文档】：\n${documentContent}\n\n`;
      if (userGuidance) {
        prompt += `【用户特别关注的审查重点 (重要！)】：\n${userGuidance}\n\n`;
      }
      prompt += `请严格按照标准审查以上文档，发现任何"魔法元素"直接一票否决。输出带表格的验证报告和具体修改建议。`;

      const { text } = await generateText({
        model: subAgentModel,
        system: VALIDATOR_PROMPT,
        prompt,
      });

      return {
        content: text,
        artifact: { title: "验证报告", type: "markdown", content: text },
      };
    },
  });
}
