import type { Concept, ConceptList } from "./conceptSchema";

/**
 * 把结构化的 ConceptList 序列化成 markdown 字符串，供前端 ReactMarkdown 渲染。
 *
 * 设计取舍：
 * - 保持 artifact 契约 `{ title, type: 'markdown', content: string }` 不变，
 *   不动前端。
 * - 输出格式与 DESIGNER_PROMPT 旧 markdown 模板**视觉上等价**，渲染层无感知。
 */
export function serializeConceptList(list: ConceptList): string {
  return list.concepts.map((c, i) => serializeConcept(c, i + 1)).join("\n\n");
}

export function serializeConcept(c: Concept, n: number): string {
  const mappingRows = c.codeMapping
    .map((row) => `  | ${row.structure} | ${row.phase} | ${row.stageEffect} |`)
    .join("\n");
  const elements = c.visualKeyElements.join(" / ");
  const dc = c.dramaticConflict;

  return [
    `## 概念 ${n}：${c.title}`,
    "",
    `- **题材维度**：${c.themeDimension}`,
    `- **一句话包装**：${c.oneLineWrapper}`,
    `- **剧情冲突 (Why this code is the ONLY way)**：`,
    `  - **角色被什么卡住**：${dc.blocker}`,
    `  - **为什么必须用这个知识点**：${dc.whyThisCode}`,
    `  - **失败代价**：${dc.failureCost}`,
    `- **代码映射表**：`,
    `  | 代码结构 | 执行阶段 | 舞台表现 |`,
    `  |---------|---------|---------|`,
    mappingRows,
    `- **视觉关键元素**：${elements}`,
    `- **与其他概念的差异点**：${c.diffFromOthers}`,
    `- **制作难度自评**：${c.productionDifficulty}`,
    `- **可懂度自检**：${c.vocabularyCheck}`,
  ].join("\n");
}

/**
 * 把整个概念对象拼成单串字符串，供 lint 模块整体扫描黑名单。
 *
 * 之所以单独开一个函数：lint 既要扫所有文本字段（title / oneLineWrapper /
 * 视觉关键元素 / diffFromOthers / 映射表中的 stageEffect 等），又要避免把
 * Zod schema 描述里的英文字段名也扫进去（那些是元数据不是用户内容）。
 */
export function flattenConceptForLint(c: Concept): string {
  return [
    c.title,
    c.oneLineWrapper,
    c.dramaticConflict.blocker,
    c.dramaticConflict.whyThisCode,
    c.dramaticConflict.failureCost,
    c.diffFromOthers,
    c.vocabularyCheck,
    c.visualKeyElements.join(" "),
    c.codeMapping.map((r) => `${r.structure} ${r.stageEffect}`).join(" "),
  ].join("\n");
}

export function flattenConceptListForLint(list: ConceptList): string {
  return list.concepts.map(flattenConceptForLint).join("\n\n");
}
