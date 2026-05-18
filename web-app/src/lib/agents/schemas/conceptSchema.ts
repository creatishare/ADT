import { z } from "zod";

/**
 * 概念方案的结构化输出 schema（路径 B · Zod-as-format-contract）。
 *
 * 设计取舍：
 * - **格式约束代码化**：以前 prompt 里大段"必须使用三列""每个阶段单独占一行"
 *   等纯格式描述，全部由 Zod schema 强制——LLM 不可能输出不合 schema 的对象。
 * - **过滤"困难"难度**：`productionDifficulty` 枚举只有 ['简单', '中等']，
 *   高难度概念无法通过 schema，强制重新构思。
 * - **执行阶段枚举化**：`phase` 字段封口在已知阶段集合里，杜绝
 *   "随便写个执行阶段名"的幻觉。
 *
 * 这一组 schema 仅用于 generate_concepts 模式。integrate_document /
 * adapt_concepts 后续再做（DEV_LOG TODO）。
 */

/**
 * 已知执行阶段集合（与 DESIGNER_PROMPT 的"执行阶段必查清单"对齐）。
 *
 * - 顺序：进入 / 完成
 * - 循环：进入 / 迭代 / 退出
 * - 递归：递入 / 触底 / 归出
 * - 分支：真分支 / 假分支
 * - 函数调用：调用 / 返回
 * - 控制流跳出：触发（break/continue/早 return 共用）
 * - 输出：输出（cout/printf 共用）
 */
export const ExecutionPhase = z.enum([
  "进入",
  "迭代",
  "退出",
  "递入",
  "触底",
  "归出",
  "真分支",
  "假分支",
  "调用",
  "返回",
  "触发",
  "输出",
  "完成",
]);
export type ExecutionPhase = z.infer<typeof ExecutionPhase>;

/**
 * 题材维度候选（与 DESIGNER_PROMPT "差异化要求"对齐）。
 */
export const ThemeDimension = z.enum([
  "航天探索",
  "机械工程",
  "自然生态",
  "物流运输",
  "建造施工",
  "科学实验",
  "考古探险",
  "农业种植",
]);
export type ThemeDimension = z.infer<typeof ThemeDimension>;

/**
 * 制作难度自评（路径 A 的硬性约束之一）。
 * 注意：**没有"困难"枚举**——即使 LLM 想输出，schema 也会拒绝。
 */
export const ProductionDifficulty = z.enum(["简单", "中等"]);
export type ProductionDifficulty = z.infer<typeof ProductionDifficulty>;

/**
 * 单条代码 → 舞台映射。每个执行阶段一行（递归三阶段=三行）。
 */
export const CodeMappingRow = z.object({
  structure: z
    .string()
    .min(1)
    .describe('代码结构标识，如 "for 循环" 或 "f(n-1)" 或 "if (n%2==0)"'),
  phase: ExecutionPhase.describe(
    "该行对应的执行阶段；递归题至少要有递入/触底/归出三阶段，循环题至少要有进入/迭代/退出。",
  ),
  stageEffect: z
    .string()
    .min(1)
    .describe("该阶段在舞台上对应的具体可视化效果（动作 + 视觉元素）"),
});
export type CodeMappingRow = z.infer<typeof CodeMappingRow>;

/**
 * 单个概念的"剧情冲突"块——把代码结构和剧情物理绑死，避免硬贴剧情。
 *
 * 三段必须齐全：
 *  1. blocker：角色此刻被什么具体的物理/工程问题卡住（不是"需要循环 3 次"，
 *     而是"3 块样本散落在 3 个岩缝、机械臂一次只能进一个岩缝"）。
 *  2. whyThisCode：为什么顺序结构 / 暴力解决不行——把"循环次数变化、
 *     深度未知、分支决策时机"等绑进剧情物理。
 *  3. failureCost：失败代价是什么（漏一块样本会怎样？分支选错会怎样？）。
 *
 * 三段都做"替换测试"——把这个代码结构换成顺序展开或暴力解，
 * 剧情物理是否立刻崩。崩 = 知识点长在剧情里；不崩 = 硬贴。
 */
export const DramaticConflict = z.object({
  blocker: z
    .string()
    .min(10)
    .describe(
      "角色被什么具体的物理/工程问题卡住（具象到舞台可见的物体/数量/位置变化，不是叙述层抽象描述）",
    ),
  whyThisCode: z
    .string()
    .min(10)
    .describe(
      "为什么顺序结构 / 暴力解不行——必须把代码结构（循环/分支/递归）和剧情物理绑死",
    ),
  failureCost: z
    .string()
    .min(6)
    .describe(
      "若知识点未正确应用，剧情中会出现什么可见的失败后果（任务取消、样本损毁、角色被困等）",
    ),
});
export type DramaticConflict = z.infer<typeof DramaticConflict>;

/**
 * 单个概念。
 */
export const ConceptSchema = z.object({
  title: z
    .string()
    .min(2)
    .max(20)
    .describe("不超过 20 字的概念标题，精炼具象"),
  themeDimension: ThemeDimension,
  oneLineWrapper: z
    .string()
    .min(8)
    .describe("一句话包装：主体 + 动作 + 结果"),
  dramaticConflict: DramaticConflict.describe(
    "剧情冲突块：保证知识点'长在'剧情里而非'贴在'剧情上",
  ),
  codeMapping: z
    .array(CodeMappingRow)
    .min(3)
    .describe(
      "代码↔舞台映射；至少 3 行；每个执行阶段单独占一行；含递归/循环/带 break 的循环时必须覆盖正向+反向阶段（双向流）",
    ),
  visualKeyElements: z
    .array(z.string().min(2))
    .min(3)
    .max(5)
    .describe("3-5 个具象名词，如 控制台/传送带/电子屏"),
  diffFromOthers: z
    .string()
    .min(8)
    .describe("一句话说明本概念与其他 4 个概念的差异点"),
  productionDifficulty: ProductionDifficulty.describe(
    '只允许 "简单" 或 "中等"；如果你判断只能写到困难等级，请放弃这个概念，重新构思一个落在白名单内的方案',
  ),
  vocabularyCheck: z
    .string()
    .min(4)
    .describe(
      "可懂度自检：本概念里所有名词是否都来自推荐词汇白名单或小学三-六年级常识；如否，列出超纲词汇并替换",
    ),
});
export type Concept = z.infer<typeof ConceptSchema>;

/**
 * 五个概念的列表，恰好 5 项。题材维度需覆盖至少 3 种。
 */
export const ConceptListSchema = z.object({
  concepts: z
    .array(ConceptSchema)
    .length(5)
    .describe("恰好 5 个差异化的概念，覆盖至少 3 种题材维度"),
});
export type ConceptList = z.infer<typeof ConceptListSchema>;
