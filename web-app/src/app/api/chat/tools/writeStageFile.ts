import { tool, type LanguageModel } from "ai";
import { z } from "zod";
import { WRITER_PROMPT } from "@/lib/agents/prompts";
import type { ModelId } from "@/lib/llm/providers";
import type { ToolOutput } from "./types";
import { tolerantText } from "./inputSchema";
import { runSubAgentText, SUB_AGENT_TIMEOUT_HEAVY_MS } from "./shared";

export function createWriteStageFileTool(
  subAgentModel: LanguageModel,
  modelId: ModelId,
  fallbackGuidance: string = "",
  fallbackSourceMaterial: string = ""
) {
  return tool({
    description:
      "第七步：将通过验证的初步策划方案转化为面向编剧老师的《关卡设计介绍文档》。",
    // 使用 tolerantText：与 validateStageFile 同理，避免长文档下漏传 / 截断字段时
    // SDK 在 execute 之前抛出 "Type validation failed" 直接令工具失败。
    inputSchema: z.object({
      validatedDocument: tolerantText(
        "审核通过的最终策划方案内容。【必填且必须完整】请一次性完整传入，切勿截断或概括。"
      ),
      worldview: tolerantText(
        "阶段剧情世界观设定（确保文档风格符合设定）。若省略，服务端会从会话头锚源材料回填。"
      ),
      userGuidance: tolerantText(
        "【极其重要】从对话历史中总结出的用户指导、排版偏好或用词规则。必须传递！"
      ),
      courseCode: tolerantText(
        "课程编号，格式：L{单元}-{课节}-{高/低年级}-题组{编号}，如 L3-1-高-题组2。从课节文档文件名或内容中提取。"
      ),
    }),
    execute: async ({
      validatedDocument,
      worldview,
      userGuidance,
      courseCode,
    }): Promise<ToolOutput> => {
      const effectiveDoc = validatedDocument?.trim() ?? "";
      if (!effectiveDoc) {
        throw new Error(
          "[missing_document] 未收到通过验证的最终策划方案（validatedDocument 为空或被截断）。请重新调用 writeStageFile，并在 validatedDocument 中一次性完整传入定稿文档（注意文档可能较长，请确保未被截断）。"
        );
      }

      const effectiveWorldview =
        worldview?.trim() || fallbackSourceMaterial.trim();
      const effectiveGuidance = userGuidance?.trim() || fallbackGuidance;

      let prompt = "";
      if (effectiveWorldview) {
        prompt += `【世界观设定】：\n${effectiveWorldview}\n\n`;
      }
      prompt += `【通过验证的策划方案】：\n${effectiveDoc}\n\n`;
      if (effectiveGuidance) {
        prompt += `【用户特别指导意见 (重要！)】：\n${effectiveGuidance}\n\n`;
      }
      prompt += `请将以上内容扩展撰写为正式落地的《关卡设计介绍文档》。包含关卡设计总览表、单个关卡的详细方案（附前后剧情）以及可替换效果类型表。`;

      const text = await runSubAgentText({
        model: subAgentModel,
        modelId,
        system: WRITER_PROMPT,
        prompt,
        timeoutMs: SUB_AGENT_TIMEOUT_HEAVY_MS,
      });

      return {
        content: text,
        artifact: { title: "关卡设计介绍文档", type: "markdown", content: text, courseCode },
      };
    },
  });
}
