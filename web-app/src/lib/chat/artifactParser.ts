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

export interface DimensionScore {
  /** Dimension name with bold/whitespace stripped, e.g. "非魔法性". */
  name: string;
  /** Original score string as written, e.g. "5/5". */
  score: string;
  /** Numerator parsed from score (the achieved points). */
  scoreValue: number;
  /** Denominator parsed from score (the maximum points). */
  maxScore: number;
  /** True only when scoreValue === maxScore — strict full-score check. */
  passed: boolean;
  /** Free-text rationale from the report's "说明" column. */
  description: string;
}

export interface ValidationReport {
  conclusion: "通过" | "不通过，需修改" | "待人工判断";
  suggestions: string[];
  /**
   * Per-dimension scoring extracted from the report's "### 评分明细" table.
   * UI components should iterate over this (filtering by `!passed`) instead
   * of relying on the legacy `risks` array.
   */
  dimensions: DimensionScore[];
  /**
   * Legacy free-text bullets retained for backwards compatibility; new UI
   * should prefer `dimensions`.
   */
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

function stripMarkdownEmphasis(text: string): string {
  // Removes surrounding **bold**, *italic*, __bold__, _italic_ pairs.
  return text.replace(/[*_]+/g, "").trim();
}

function isTableRow(line: string): boolean {
  return line.startsWith("|") && line.endsWith("|");
}

function isSeparatorRow(line: string): boolean {
  // Markdown table separator like |---|---|---| or |:---:|---:|
  return /^\|[\s\-:|]+\|$/.test(line);
}

function parseDimensionsTable(content: string): DimensionScore[] {
  // Locate the "### 评分明细" block and stop at the next "###" heading or EOF.
  const block = content.match(/###\s*评分明细([\s\S]*?)(?:\n###\s|\n##\s|$)/)?.[1];
  if (!block) return [];
  const dims: DimensionScore[] = [];
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!isTableRow(line)) continue;
    if (isSeparatorRow(line)) continue;
    // Drop the leading and trailing pipe, then split.
    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => stripMarkdownEmphasis(cell));
    if (cells.length < 3) continue;
    const [name, score, ...rest] = cells;
    if (!name || !score) continue;
    // Skip the header row.
    if (name === "维度" || /^Dimension$/i.test(name)) continue;
    const scoreMatch = score.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (!scoreMatch) continue;
    const scoreValue = Number(scoreMatch[1]);
    const maxScore = Number(scoreMatch[2]);
    if (!Number.isFinite(scoreValue) || !Number.isFinite(maxScore) || maxScore <= 0) {
      continue;
    }
    const description = rest.join(" | ").trim();
    dims.push({
      name,
      score,
      scoreValue,
      maxScore,
      passed: scoreValue === maxScore,
      description,
    });
  }
  return dims;
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

  const dimensions = parseDimensionsTable(content);

  // Legacy `risks` is now derived from real dimension scoring instead of
  // hard-coded keyword matches, so the UI no longer surfaces misleading
  // "watch-list" items unrelated to this run.
  const risks: string[] = dimensions
    .filter((d) => !d.passed)
    .map((d) => `${d.name} ${d.score}：${d.description}`);

  return { conclusion, suggestions, dimensions, risks };
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
 * 1. ``` ```markdown ``` / ``` ```md ``` fences wrapping section bodies. The
 *    Designer/Validator/Writer prompts use these fences to mark *template
 *    examples*; the model often copies the pattern verbatim and wraps every
 *    section of its real output the same way, which makes ReactMarkdown
 *    render tables/headings/bold as raw text inside <pre><code>. Strip these
 *    anywhere they appear. Generic ``` fences without a language tag are
 *    preserved — they may be intentional code blocks (e.g. C++ snippets).
 * 2. Outer fence wrapping the whole output (any language).
 * 3. Em/en-dashes (—/–) used as bullet markers → convert to "-".
 * 4. Em-dashes used in table separator rows (|———|———|) → convert to "-".
 * 5. Tables indented because they sit inside a list item → dedent and
 *    surround with blank lines so remark-gfm recognises them as tables.
 */
export function normalizeMarkdown(content: string): string {
  // 1. Strip ```markdown / ```md fences anywhere in the content (line-anchored).
  let out = content.replace(
    /^[ \t]*```(?:markdown|md)[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```[ \t]*$/gm,
    "$1"
  );

  // 2. Strip a single outer fence (any language, or none) wrapping the
  //    entire content — preserved from the legacy implementation.
  out = out
    .replace(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n```\s*$/, "$1")
    .trimStart();

  // 3. List bullets using Chinese-style dashes at line start (with optional indent).
  out = out.replace(/^(\s*)[–—]\s+/gm, "$1- ");

  // 4. Table separator rows: a line that is only pipes + dashes/em-dashes/spaces.
  out = out.replace(
    /^(\s*)\|([\s\-—–|:]+)\|[ \t]*$/gm,
    (_match, indent: string, middle: string) => {
      const normalized = middle.replace(/[—–]/g, "-");
      return `${indent}|${normalized}|`;
    }
  );

  // 5. Dedent tables & pad with blank lines so GFM parser kicks in.
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

import {
  parseGuidance,
  serializeGuidanceForPrompt,
  type GuidanceModel,
} from "@/lib/agents/guidance";

export interface OrchestratorState {
  currentStep: number | null;
  currentLesson: string | null;
  currentGroup: string | null;
  totalGroups: number | null;
  processedGroups: string[];
  pendingGroups: string[];
  awaitingUser: AwaitingUserAction;
  /**
   * Structured, dimensioned guidance accumulator.
   *
   * As of 2026-05-11 the Orchestrator writes this as a typed object
   * (see `GuidanceModel`). Pre-2026-05-11 sessions may have written a
   * `string[]` here — `parseGuidance` accepts both and migrates the legacy
   * shape into `wordingStyle` so old conversations keep rendering.
   */
  accumulatedGuidance: GuidanceModel;
  /**
   * Flat list view derived from `accumulatedGuidance` for callers that
   * still want a single-line-per-item display (e.g. UI progress chips).
   * Includes only cross-group dimensions; per-group themes are excluded
   * to mirror the cross-group serialization scope.
   */
  guidanceLines: string[];
}

const STATE_BLOCK_REGEX = /```state\s*\n([\s\S]*?)\n```/;
const AWAITING_USER_REGEX = /\[AWAITING_USER:(concept_selection|validation_decision)\]/;

export function parseOrchestratorState(
  text: string
): OrchestratorState | null {
  const match = text.match(STATE_BLOCK_REGEX);
  if (!match || match[1] === undefined) return null;
  try {
    const raw = JSON.parse(match[1]) as Record<string, unknown>;
    const guidance = parseGuidance(raw.accumulatedGuidance);
    return {
      currentStep: typeof raw.currentStep === "number" ? raw.currentStep : null,
      currentLesson:
        typeof raw.currentLesson === "string" ? raw.currentLesson : null,
      currentGroup:
        typeof raw.currentGroup === "string" ? raw.currentGroup : null,
      totalGroups:
        typeof raw.totalGroups === "number" ? raw.totalGroups : null,
      processedGroups: Array.isArray(raw.processedGroups)
        ? (raw.processedGroups as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [],
      pendingGroups: Array.isArray(raw.pendingGroups)
        ? (raw.pendingGroups as unknown[]).filter(
            (x): x is string => typeof x === "string",
          )
        : [],
      awaitingUser:
        raw.awaitingUser === "concept_selection" ||
        raw.awaitingUser === "validation_decision"
          ? raw.awaitingUser
          : null,
      accumulatedGuidance: guidance,
      guidanceLines: flattenGuidanceForDisplay(guidance),
    };
  } catch {
    return null;
  }
}

/**
 * Flatten the cross-group dimensions of a `GuidanceModel` into single-line
 * strings for legacy/UI callers that previously consumed `string[]`.
 * Per-group themes are deliberately excluded.
 */
function flattenGuidanceForDisplay(guidance: GuidanceModel): string[] {
  const out: string[] = [];
  for (const p of guidance.logicVisualPatterns) {
    const marker = p.polarity === "avoid" ? "✗" : "✓";
    out.push(`${marker} ${p.construct} → ${p.pattern}`);
  }
  out.push(...guidance.wordingStyle);
  for (const item of guidance.avoidances) out.push(`禁忌：${item}`);
  return out;
}

/**
 * Convenience: turn an `OrchestratorState`'s guidance into the segmented
 * prompt-ready text that sub-agents consume, scoped to a specific course.
 * Re-exported here so callers don't need to import `guidance.ts` directly.
 */
export function serializeStateGuidance(
  state: Pick<OrchestratorState, "accumulatedGuidance">,
  activeCourseCode?: string,
): string {
  return serializeGuidanceForPrompt(state.accumulatedGuidance, activeCourseCode);
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
