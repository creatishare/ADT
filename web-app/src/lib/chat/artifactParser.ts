/**
 * Artifact parsing utilities.
 *
 * All business logic for categorising, summarising, and analysing artifact
 * content lives here so that ArtifactArea stays a pure presentation layer.
 */

export type ArtifactCategory =
  | "验证报告"
  | "视觉提示词"
  | "落地文档"
  | "概念方案"
  | "通用工件";

export type ArtifactStatus =
  | "待修改"
  | "已通过"
  | "可用于出图"
  | "待筛选"
  | "已选定"
  | "已生成";

export interface ArtifactStatusContext {
  /** True if this concept artifact has been selected (a downstream artifact with the same courseCode exists). */
  conceptSelected?: boolean;
}

export interface ArtifactMetrics {
  lines: number;
  sections: number;
  tables: number;
}

export interface ValidationReport {
  conclusion: "通过" | "不通过，需修改" | "待人工判断";
  suggestions: string[];
  risks: string[];
}

export interface PromptArtifact {
  englishPrompt: string;
  chineseDescription: string;
  specs: string[];
}

export function getArtifactTypeLabel(
  type: "markdown" | "image" | "code" | null
) {
  if (type === "image") return "图片";
  if (type === "code") return "代码";
  return "文档";
}

export function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getArtifactCategory(title: string): ArtifactCategory {
  if (title.includes("验证")) return "验证报告";
  if (title.includes("即梦") || title.includes("提示词")) return "视觉提示词";
  if (title.includes("设计介绍") || title.includes("设计文档")) return "落地文档";
  if (title.includes("概念")) return "概念方案";
  return "通用工件";
}

export function getArtifactStatus(
  title: string,
  content: string,
  context?: ArtifactStatusContext
): ArtifactStatus {
  if (title.includes("验证")) {
    if (content.includes("不通过") || content.includes("需修改"))
      return "待修改";
    if (content.includes("通过")) return "已通过";
  }
  if (title.includes("即梦") || title.includes("提示词")) return "可用于出图";
  if (title.includes("概念")) {
    return context?.conceptSelected ? "已选定" : "待筛选";
  }
  return "已生成";
}

export function getArtifactMetrics(content: string): ArtifactMetrics {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length;
  const sections = (content.match(/^#{1,6}\s/gm) ?? []).length;
  const tables = (content.match(/^\|.+\|$/gm) ?? []).length;
  return { lines, sections, tables };
}

export function getArtifactSummary(title: string): string {
  if (title.includes("验证"))
    return "聚焦逻辑一致性、儿童友好与无魔法原则的审核结果。";
  if (title.includes("即梦") || title.includes("提示词"))
    return "用于后续出图的视觉提示词与画面要求摘要。";
  if (title.includes("设计介绍") || title.includes("设计文档"))
    return "面向编剧和美术协作的正式落地文档。";
  if (title.includes("概念")) return "当前题组的候选包装方向与设计思路。";
  return "由子智能体生成的结构化工件内容。";
}

export function parseValidationReport(content: string): ValidationReport {
  let conclusion: ValidationReport["conclusion"];
  if (content.includes("不通过") || content.includes("需修改")) {
    conclusion = "不通过，需修改";
  } else if (content.includes("通过")) {
    conclusion = "通过";
  } else {
    conclusion = "待人工判断";
  }

  const suggestionsBlock =
    content.match(/### 修改建议清单([\s\S]*?)(?:\n## |$)/)?.[1] ?? "";
  const suggestions = suggestionsBlock
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\./.test(line))
    .slice(0, 5);

  const risks: string[] = [
    content.includes("魔法") ? "出现魔法相关表述，需重点复核" : null,
    content.includes("不通过")
      ? "当前方案存在阻断项，不建议直接进入下游文档环节"
      : null,
    content.includes("适合8-12岁") ? "已覆盖目标年龄适配性审查" : null,
  ].filter((x): x is string => x !== null);

  return { conclusion, suggestions, risks };
}

export function parsePromptArtifact(content: string): PromptArtifact {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const englishPrompt =
    lines.find(
      (line) =>
        /[a-zA-Z]{4,}/.test(line) && !/[\u4e00-\u9fa5]/.test(line)
    ) ?? "未自动提取到英文 Prompt";
  const chineseDescription =
    lines.find(
      (line) =>
        /[\u4e00-\u9fa5]/.test(line) &&
        !line.startsWith("#") &&
        !line.startsWith("*(注意")
    ) ?? "未自动提取到中文说明";
  const specs: string[] = [
    content.includes("2K") ? "2K" : null,
    content.includes("4:3") ? "4:3" : null,
    content.includes("同题组") || content.includes("去重") ? "同题组去重" : null,
  ].filter((x): x is string => x !== null);

  return { englishPrompt, chineseDescription, specs };
}

/** Parse JSON-wrapped content returned by some tool outputs. */
export function getParsedContent(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return parsed.content ?? parsed.url ?? content;
  } catch {
    return content;
  }
}

/**
 * Normalize LLM-generated markdown so remark-gfm can render tables/lists.
 *
 * Common LLM quirks we fix:
 * 1. Em/en-dashes (—/–) used as bullet markers → convert to "-".
 * 2. Em-dashes used in table separator rows (|———|———|) → convert to "-".
 * 3. Tables indented because they sit inside a list item → dedent and
 *    surround with blank lines so remark-gfm recognises them as tables.
 */
export function normalizeMarkdown(content: string): string {
  // Strip wrapping code fences that LLMs sometimes add around their markdown output.
  let out = content
    .replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/, "$1")
    .trimStart();

  // 1. List bullets using Chinese-style dashes at line start (with optional indent).
  out = out.replace(/^(\s*)[–—]\s+/gm, "$1- ");

  // 2. Table separator rows: a line that is only pipes + dashes/em-dashes/spaces.
  out = out.replace(
    /^(\s*)\|([\s\-—–|:]+)\|[ \t]*$/gm,
    (_match, indent: string, middle: string) => {
      const normalized = middle.replace(/[—–]/g, "-");
      return `${indent}|${normalized}|`;
    }
  );

  // 3. Dedent tables & pad with blank lines so GFM parser kicks in.
  const lines = out.split("\n");
  const result: string[] = [];
  let i = 0;
  const isTableLine = (line: string) =>
    /^\s*\|.*\|\s*$/.test(line) && line.trim().length > 2;

  while (i < lines.length) {
    const cur = lines[i] ?? "";
    const nxt = lines[i + 1] ?? "";
    if (isTableLine(cur) && i + 1 < lines.length && isTableLine(nxt)) {
      const block: string[] = [];
      while (i < lines.length) {
        const blockLine = lines[i];
        if (blockLine === undefined || !isTableLine(blockLine)) break;
        block.push(blockLine.replace(/^\s+/, ""));
        i += 1;
      }
      const lastResult = result[result.length - 1];
      if (result.length > 0 && lastResult !== undefined && lastResult.trim() !== "") {
        result.push("");
      }
      result.push(...block);
      const after = lines[i];
      if (i < lines.length && after !== undefined && after.trim() !== "") {
        result.push("");
      }
      continue;
    }
    result.push(cur);
    i += 1;
  }
  return result.join("\n");
}

// ---------------------------------------------------------------------------
// Orchestrator state block & awaiting-user tags
// ---------------------------------------------------------------------------

export type AwaitingUserAction =
  | "concept_selection"
  | "validation_decision"
  | null;

export interface OrchestratorState {
  currentStep: number | null;
  currentLesson: string | null;
  currentGroup: string | null;
  totalGroups: number | null;
  processedGroups: string[];
  pendingGroups: string[];
  awaitingUser: AwaitingUserAction;
  accumulatedGuidance: string[];
}

const STATE_BLOCK_REGEX = /```state\s*\n([\s\S]*?)\n```/;
const AWAITING_USER_REGEX = /\[AWAITING_USER:(concept_selection|validation_decision)\]/;

export function parseOrchestratorState(
  text: string
): OrchestratorState | null {
  const match = text.match(STATE_BLOCK_REGEX);
  if (!match || match[1] === undefined) return null;
  try {
    const raw = JSON.parse(match[1]) as Partial<OrchestratorState>;
    return {
      currentStep: typeof raw.currentStep === "number" ? raw.currentStep : null,
      currentLesson:
        typeof raw.currentLesson === "string" ? raw.currentLesson : null,
      currentGroup:
        typeof raw.currentGroup === "string" ? raw.currentGroup : null,
      totalGroups:
        typeof raw.totalGroups === "number" ? raw.totalGroups : null,
      processedGroups: Array.isArray(raw.processedGroups)
        ? raw.processedGroups.filter((x): x is string => typeof x === "string")
        : [],
      pendingGroups: Array.isArray(raw.pendingGroups)
        ? raw.pendingGroups.filter((x): x is string => typeof x === "string")
        : [],
      awaitingUser:
        raw.awaitingUser === "concept_selection" ||
        raw.awaitingUser === "validation_decision"
          ? raw.awaitingUser
          : null,
      accumulatedGuidance: Array.isArray(raw.accumulatedGuidance)
        ? raw.accumulatedGuidance.filter(
            (x): x is string => typeof x === "string"
          )
        : [],
    };
  } catch {
    return null;
  }
}

export function parseAwaitingUser(text: string): AwaitingUserAction {
  const match = text.match(AWAITING_USER_REGEX);
  if (!match) return null;
  return match[1] as AwaitingUserAction;
}

/** Strip state fence and awaiting-user tag so they don't show in the bubble. */
export function stripOrchestratorMeta(text: string): string {
  return text
    .replace(STATE_BLOCK_REGEX, "")
    .replace(AWAITING_USER_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getAwaitingUserLabel(action: AwaitingUserAction): string {
  switch (action) {
    case "concept_selection":
      return "等待你挑选 1 个包装概念（输入编号 1-5）";
    case "validation_decision":
      return "等待你决定验证意见处理方式（A 全部采纳 / B 部分采纳 / C 直接通过）";
    default:
      return "";
  }
}
