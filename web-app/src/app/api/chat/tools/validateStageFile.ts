import { tool, type LanguageModel } from "ai";
import { z } from "zod";
import { VALIDATOR_PROMPT } from "@/lib/agents/prompts";
import type { ModelId } from "@/lib/llm/providers";
import type { ToolOutput } from "./types";
import { tolerantText } from "./inputSchema";
import { runSubAgentText, SUB_AGENT_TIMEOUT_HEAVY_MS } from "./shared";

export function createValidateStageFileTool(
  subAgentModel: LanguageModel,
  modelId: ModelId,
  fallbackGuidance: string = "",
  fallbackSourceMaterial: string = ""
) {
  return tool({
    description:
      "第四步：验证策划师输出的初步策划文档是否包含魔法、逻辑是否自洽。",
    // 使用 tolerantText 而非严格 z.string()：Orchestrator 在长文档下偶尔会漏传或
    // 截断字段，严格 schema 会在 execute 之前抛出 "Type validation failed" 直接令
    // 工具失败。容错 schema 把兜底责任下移到 execute（见下方回填 / 缺失校验逻辑）。
    inputSchema: z.object({
      documentContent: tolerantText(
        "需要验证的初步策划文档全文。【必填且必须完整】文档通常较长，请一次性完整传入，切勿截断或概括。"
      ),
      worldview: tolerantText(
        "阶段剧情世界观设定。若省略，服务端会自动从会话头锚源材料回填。"
      ),
      topicInfo: tolerantText(
        "课节关卡知识点信息整理。若省略，服务端会自动从会话头锚源材料回填。"
      ),
      userGuidance: tolerantText(
        "【极其重要】用户特别关心的验证重点或之前的踩坑点。必须传递！"
      ),
      courseCode: tolerantText(
        "课程编号，格式：L{单元}-{课节}-{高/低年级}-题组{编号}，如 L3-1-高-题组2。从课节文档文件名或内容中提取。"
      ),
    }),
    execute: async ({
      documentContent,
      worldview,
      topicInfo,
      userGuidance,
      courseCode,
    }): Promise<ToolOutput> => {
      const effectiveDoc = documentContent?.trim() ?? "";
      // documentContent 无法从历史可靠回填（工具产物不进入规范化文本历史），
      // 缺失时抛出可重试的明确错误，由 Orchestrator 重新发起完整调用，
      // 而不是在没有审查对象的情况下空跑验证。
      if (!effectiveDoc) {
        throw new Error(
          "[missing_document] 未收到需要验证的初步策划文档全文（documentContent 为空或被截断）。请重新调用 validateStageFile，并在 documentContent 中一次性完整传入待验证文档（注意文档可能较长，请确保未被截断）。"
        );
      }

      const effectiveWorldview = worldview?.trim() ?? "";
      const effectiveTopic = topicInfo?.trim() ?? "";
      const effectiveGuidance = userGuidance?.trim() || fallbackGuidance;
      const anchor = fallbackSourceMaterial.trim();

      let prompt = "";
      if (effectiveWorldview) {
        prompt += `【世界观设定】：\n${effectiveWorldview}\n\n`;
      }
      if (effectiveTopic) {
        prompt += `【知识点信息】：\n${effectiveTopic}\n\n`;
      }
      // 世界观与知识点都缺失时，用会话头锚源材料回填，避免验证在缺乏上下文时空跑。
      if (!effectiveWorldview && !effectiveTopic && anchor) {
        prompt += `【源材料（世界观 + 知识点，自会话头锚回填）】：\n${anchor}\n\n`;
      }
      prompt += `【需要审查的初步策划文档】：\n${effectiveDoc}\n\n`;
      if (effectiveGuidance) {
        prompt += `【用户特别关注的审查重点 (重要！)】：\n${effectiveGuidance}\n\n`;
      }
      prompt += `请严格按照标准审查以上文档，发现任何"魔法元素"直接一票否决。输出带表格的验证报告和具体修改建议。`;

      const text = await runSubAgentText({
        model: subAgentModel,
        modelId,
        system: VALIDATOR_PROMPT,
        prompt,
        timeoutMs: SUB_AGENT_TIMEOUT_HEAVY_MS,
      });

      return {
        content: text,
        artifact: { title: "验证报告", type: "markdown", content: text, courseCode },
      };
    },
  });
}
