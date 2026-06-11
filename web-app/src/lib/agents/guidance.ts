/**
 * Dimensioned guidance model for accumulating user preferences across
 * orchestrator turns and forwarding them to sub-agents.
 *
 * Background (2026-05-11): the previous flat `accumulatedGuidance: string[]`
 * conflated **per-group theme choices** (e.g. "用户挑了航天概念" for 题组1)
 * with **cross-group long-term preferences** (e.g. "for 循环退出阶段我喜欢
 * 计数器跳动+绿灯亮"). The orchestrator then forwarded the whole flat list
 * to every sub-agent, which biased later groups toward themes the user
 * happened to pick for earlier groups.
 *
 * Fix: structure guidance into 4 explicit dimensions with distinct scopes.
 *
 * Scope rules (enforced by `serializeGuidanceForPrompt`):
 *  - `logicVisualPatterns` / `wordingStyle` / `avoidances` — cross-group.
 *    Always serialized for the current call regardless of which group is
 *    being processed.
 *  - `perGroupTheme[courseCode]` — single-group scope. Only the entry for
 *    the **currently active** courseCode is serialized; other entries are
 *    silently ignored (theme choices from earlier groups never leak into
 *    later groups' sub-agent prompts).
 *
 * The Orchestrator is instructed (in prompts.ts) to write each user signal
 * into exactly one bucket. The serializer enforces scope on the read side
 * as a defense-in-depth measure in case the orchestrator misclassifies.
 */
import { z } from "zod";

export const LogicVisualPatternSchema = z.object({
  construct: z
    .string()
    .min(1)
    .describe(
      "代码结构标签，例如 'for循环退出' / '递归归出' / 'if假分支' / 'cout输出'"
    ),
  pattern: z
    .string()
    .min(1)
    .describe(
      "用户认可或拒绝的舞台映射方式，例如 '计数器跳动 + 绿灯亮 + UI 显示总数'"
    ),
  reason: z.string().optional().describe("用户给出的理由（可选）"),
  polarity: z
    .enum(["prefer", "avoid"])
    .describe("prefer = 倾向采用；avoid = 倾向回避"),
  sourceGroup: z
    .string()
    .optional()
    .describe(
      "首次出现该偏好的题组 courseCode，仅做溯源；不影响后续题组是否使用"
    ),
});

export type LogicVisualPattern = z.infer<typeof LogicVisualPatternSchema>;

export const PerGroupThemeEntrySchema = z.object({
  theme: z.string().min(1).describe("用户为该题组挑定的题材，如 '航天探索'"),
  note: z.string().optional().describe("挑选理由或微调备注"),
});

export type PerGroupThemeEntry = z.infer<typeof PerGroupThemeEntrySchema>;

export const GuidanceModelSchema = z.object({
  logicVisualPatterns: z.array(LogicVisualPatternSchema).default([]),
  wordingStyle: z.array(z.string().min(1)).default([]),
  avoidances: z.array(z.string().min(1)).default([]),
  perGroupTheme: z.record(z.string(), PerGroupThemeEntrySchema).default({}),
  mode: z
    .enum(["standard", "single-group", "integration"])
    .optional(),
});

export type GuidanceModel = z.infer<typeof GuidanceModelSchema>;

export const EMPTY_GUIDANCE: GuidanceModel = {
  logicVisualPatterns: [],
  wordingStyle: [],
  avoidances: [],
  perGroupTheme: {},
};

/**
 * Accept either:
 *  - the new structured GuidanceModel shape, or
 *  - the legacy `string[]` shape (treated as cross-group `wordingStyle`
 *    lines so old sessions keep working).
 *
 * Anything unrecognizable returns `EMPTY_GUIDANCE` rather than throwing.
 */
export function parseGuidance(input: unknown): GuidanceModel {
  if (Array.isArray(input)) {
    const legacy = input.filter((x): x is string => typeof x === "string" && x.length > 0);
    return { ...EMPTY_GUIDANCE, wordingStyle: legacy };
  }

  if (!input || typeof input !== "object") return EMPTY_GUIDANCE;

  const parsed = GuidanceModelSchema.safeParse(input);
  if (parsed.success) return parsed.data;

  // Best-effort partial recovery — strip unknown fields, keep what fits.
  const candidate = input as Record<string, unknown>;
  const recovered: GuidanceModel = { ...EMPTY_GUIDANCE };

  if (Array.isArray(candidate.logicVisualPatterns)) {
    recovered.logicVisualPatterns = candidate.logicVisualPatterns
      .map((item) => LogicVisualPatternSchema.safeParse(item))
      .filter((r): r is { success: true; data: LogicVisualPattern } => r.success)
      .map((r) => r.data);
  }
  if (Array.isArray(candidate.wordingStyle)) {
    recovered.wordingStyle = candidate.wordingStyle.filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
  }
  if (Array.isArray(candidate.avoidances)) {
    recovered.avoidances = candidate.avoidances.filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
  }
  if (candidate.perGroupTheme && typeof candidate.perGroupTheme === "object") {
    const themes: Record<string, PerGroupThemeEntry> = {};
    for (const [key, value] of Object.entries(
      candidate.perGroupTheme as Record<string, unknown>,
    )) {
      const r = PerGroupThemeEntrySchema.safeParse(value);
      if (r.success) themes[key] = r.data;
    }
    recovered.perGroupTheme = themes;
  }
  if (
    candidate.mode === "standard" ||
    candidate.mode === "single-group" ||
    candidate.mode === "integration"
  ) {
    recovered.mode = candidate.mode;
  }

  return recovered;
}

/**
 * Serialize a `GuidanceModel` into the section-headed markdown text that
 * sub-agents read out of the `userGuidance` parameter.
 *
 * `activeCourseCode` controls per-group scope enforcement:
 *  - If provided, only `perGroupTheme[activeCourseCode]` is included.
 *  - If omitted, no per-group theme is emitted (safer default — e.g. when
 *    calling `integrate_document` which spans all groups).
 *
 * Returns an empty string when the model has nothing to convey, so callers
 * can treat the result as a drop-in for `userGuidance`.
 */
export function serializeGuidanceForPrompt(
  guidance: GuidanceModel,
  activeCourseCode?: string,
): string {
  const sections: string[] = [];

  if (guidance.mode) {
    sections.push(`[mode:${guidance.mode}]`);
  }

  if (guidance.logicVisualPatterns.length > 0) {
    const lines = guidance.logicVisualPatterns.map((p) => {
      const marker = p.polarity === "avoid" ? "✗" : "✓";
      const tail = p.reason ? `（原因：${p.reason}）` : "";
      return `- ${marker} ${p.construct} → ${p.pattern}${tail}`;
    });
    sections.push(
      [
        "## 跨题组逻辑↔舞台映射偏好（长期，所有题组通用）",
        "说明：以下记录用户对'某种代码逻辑应如何在舞台上呈现'的长期偏好；",
        "在新题组里如果出现相同代码结构，请优先复用 ✓ 模式，避免 ✗ 模式。",
        ...lines,
      ].join("\n"),
    );
  }

  if (guidance.wordingStyle.length > 0) {
    sections.push(
      [
        "## 用词与排版偏好（长期）",
        ...guidance.wordingStyle.map((line) => `- ${line}`),
      ].join("\n"),
    );
  }

  if (guidance.avoidances.length > 0) {
    sections.push(
      [
        "## 用户明确禁忌（长期）",
        ...guidance.avoidances.map((line) => `- ${line}`),
      ].join("\n"),
    );
  }

  if (activeCourseCode) {
    const entry = guidance.perGroupTheme[activeCourseCode];
    if (entry) {
      const note = entry.note ? `\n  备注：${entry.note}` : "";
      sections.push(
        [
          `## 当前题组题材（仅 ${activeCourseCode}）`,
          "说明：此题材**只**适用于本题组上下文。其它题组的题材选择不在此处出现。",
          `- 题材：${entry.theme}${note}`,
        ].join("\n"),
      );
    }
  }

  return sections.join("\n\n");
}

/**
 * Shallow-merge guidance updates from a single orchestrator turn into the
 * running accumulator. Lists are concatenated and de-duplicated by their
 * primary key; `perGroupTheme` is upsert by courseCode; `mode` is
 * overwritten if `delta.mode` is defined.
 *
 * Used in tests and (later) in any server-side accumulation path. The
 * orchestrator itself manages accumulation in its State Block today, so
 * this is mainly a guarantee for downstream code that needs to compose
 * deltas safely.
 */
export function mergeGuidance(
  prev: GuidanceModel,
  delta: Partial<GuidanceModel>,
): GuidanceModel {
  const merged: GuidanceModel = {
    logicVisualPatterns: [...prev.logicVisualPatterns],
    wordingStyle: [...prev.wordingStyle],
    avoidances: [...prev.avoidances],
    perGroupTheme: { ...prev.perGroupTheme },
    mode: prev.mode,
  };

  if (delta.logicVisualPatterns) {
    const seen = new Set(
      merged.logicVisualPatterns.map((p) => `${p.construct} ${p.polarity}`),
    );
    for (const item of delta.logicVisualPatterns) {
      const key = `${item.construct} ${item.polarity}`;
      if (!seen.has(key)) {
        merged.logicVisualPatterns.push(item);
        seen.add(key);
      }
    }
  }

  if (delta.wordingStyle) {
    const seen = new Set(merged.wordingStyle);
    for (const line of delta.wordingStyle) {
      if (!seen.has(line)) {
        merged.wordingStyle.push(line);
        seen.add(line);
      }
    }
  }

  if (delta.avoidances) {
    const seen = new Set(merged.avoidances);
    for (const line of delta.avoidances) {
      if (!seen.has(line)) {
        merged.avoidances.push(line);
        seen.add(line);
      }
    }
  }

  if (delta.perGroupTheme) {
    for (const [code, entry] of Object.entries(delta.perGroupTheme)) {
      merged.perGroupTheme[code] = entry;
    }
  }

  if (delta.mode !== undefined) {
    merged.mode = delta.mode;
  }

  return merged;
}
