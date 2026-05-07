/**
 * 三种策划模式对应的初始 prompt 模板（纯函数，便于单测）。
 *
 * - standard: 默认 7 步法，对课节内所有题组循环。
 * - single-group: 仅策划用户选定的一个题组，跳过题组循环和剧情衔接。
 * - integration: 用户已自带壳子方案，调 designStageFile 的 adapt_concepts 模式
 *   做轻量适配并串联剧情，跳过 5 概念生成与人工挑选。
 */

import type { ParsedGroup } from "./parseLessonGroups";

export type PlanningMode = "standard" | "single-group" | "integration";

export interface UploadedDoc {
  name: string;
  content: string;
}

export interface BuildInitialPromptInput {
  mode: PlanningMode;
  worldDoc: UploadedDoc;
  lessonDoc: UploadedDoc;
  parsedGroups: ParsedGroup[];
  selectedGroupIndex?: number | null;
  shellDoc?: UploadedDoc | null;
}

const FENCE = "```";

function block(label: string, body: string): string {
  return `## ${label}

${FENCE}
${body}
${FENCE}
`;
}

function commonDocs(input: BuildInitialPromptInput): string {
  const world = block(
    `阶段世界观文档（文件名：${input.worldDoc.name}）`,
    input.worldDoc.content,
  );
  const lesson = block(
    `课节知识点整理文档（文件名：${input.lessonDoc.name}）`,
    input.lessonDoc.content,
  );
  return `${world}\n${lesson}`;
}

function buildStandardPrompt(input: BuildInitialPromptInput): string {
  return `请根据以下资料开始关卡设计流程。

${commonDocs(input)}
请按照7步法工作流，从第一个题组开始，依次生成各题组的核心包装概念。请先针对第一个题组生成5个候选概念供我筛选。`;
}

function buildSingleGroupPrompt(input: BuildInitialPromptInput): string {
  const { parsedGroups, selectedGroupIndex } = input;
  const selected =
    selectedGroupIndex != null
      ? parsedGroups.find((g) => g.index === selectedGroupIndex)
      : undefined;

  const targetBlock = selected
    ? block(
        `目标题组（仅策划这一个）— 题组 ${selected.index}：${selected.title || "（未识别到标题）"}`,
        selected.rawSection,
      )
    : `## 目标题组（仅策划这一个）

⚠️ 用户尚未在 UI 中明确选择题组。请在第一轮回复中先询问用户："请告诉我要策划的题组编号"，并在用户给出后再继续。
`;

  const indexHint =
    selectedGroupIndex != null
      ? `题组 ${selectedGroupIndex}${selected?.title ? `（${selected.title}）` : ""}`
      : "用户指定的题组";

  return `请根据以下资料开始关卡设计流程。

${commonDocs(input)}
${targetBlock}
**模式说明（单题组精简流程，必须严格遵守）：**
- 本次仅策划【${indexHint}】这一个题组，**请跳过题组间循环**。State Block 中 \`pendingGroups\` 始终为空数组，\`totalGroups=1\`。
- 工作流四步：(1) designStageFile mode='generate_concepts' 生成 5 个概念 → (2) 人工挑选并满意确认 → (3) **直接** writeStageFile → (4) generateVisualDesign。
- **明确跳过**以下步骤：**不要调用 validateStageFile**（不走全局验证）；**不要调用 designStageFile mode='integrate_document'**（无须再造一份初步策划文档）；**不要进入第六步迭代**。
- 第二步人工挑选时，问句改为："请挑选 1 个概念（输入编号 1-5）。挑完后**回复'满意'即可直接进入文档化**；若需微调请直接说明调整点，我会在写文档时一并应用。"用户回复"满意"或等价确认后，立刻进入第三步。
- 第三步 writeStageFile 的 \`validatedDocument\` 入参由你拼接：把"挑选概念的完整摘要 + 该题组的代码与知识点片段"组成一段简短 markdown 作为输入。
- writeStageFile 输出关卡设计介绍文档时，**不要包含"前置/后置剧情衔接"段落**。
- 调用 writeStageFile / generateVisualDesign 时，必须在 \`userGuidance\` 中追加 \`[mode:single-group]\` 标记。

请按上述约束启动第 1 步：针对该题组生成 5 个核心包装概念。`;
}

function buildIntegrationPrompt(input: BuildInitialPromptInput): string {
  if (!input.shellDoc) {
    throw new Error("integration mode requires shellDoc");
  }
  const shellBlock = block(
    `用户已有壳子方案文档（文件名：${input.shellDoc.name}）`,
    input.shellDoc.content,
  );

  return `请根据以下资料开始关卡设计流程。

${commonDocs(input)}
${shellBlock}
**模式说明（必须严格遵守）：**
- 用户已为各题组想好壳子方案。**请直接调用 designStageFile 且 \`mode='adapt_concepts'\`**，将上方壳子方案文档全文作为 \`selectedConcepts\` 入参传入。
- 必须**保持代码-舞台映射的玩法本质不变**（动作类型、阶段覆盖、双向流要求都不可改），仅在题材包装/命名/视觉描述上做轻量适配，使其贴合阶段世界观。
- 用 1-2 句衔接把所有题组串成一条主线（剧情衔接）。
- **跳过 5 概念生成与人工挑选环节**，整合完成后直接进入第 4 步全局验证。
- 每次调用 designStageFile / validateStageFile / writeStageFile / generateVisualDesign 等子 Agent 工具时，必须在 \`userGuidance\` 参数中追加 \`[mode:integration]\` 标记。

请按上述约束启动 \`adapt_concepts\` 模式下的整合流程。`;
}

export function buildInitialPrompt(input: BuildInitialPromptInput): string {
  switch (input.mode) {
    case "standard":
      return buildStandardPrompt(input);
    case "single-group":
      return buildSingleGroupPrompt(input);
    case "integration":
      return buildIntegrationPrompt(input);
    default: {
      const _exhaustive: never = input.mode;
      throw new Error(`unknown planning mode: ${_exhaustive as string}`);
    }
  }
}
