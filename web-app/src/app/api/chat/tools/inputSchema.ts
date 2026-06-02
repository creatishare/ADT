import { z } from "zod";

/**
 * 子 Agent 工具入参的「容错文本」类型。
 *
 * Orchestrator 调用 validateStageFile / writeStageFile 等重型工具时，必须把
 * **累积的整篇文档**（初步策划文档 / 定稿方案）连同世界观、知识点原样塞进
 * 工具调用的参数 JSON。在长输入下，部分供应商偶尔会：
 *   - 漏传某个字段；
 *   - 传入 null / 数字 / 对象等非字符串值；
 *   - 把超长字段截断。
 *
 * 此时严格的 `z.string()` 会在 AI SDK 工具运行时层（execute 执行之前）抛出
 *   "Invalid input for tool X: Type validation failed"
 * 整个工具调用直接失败，对用户表现为一句不可诊断的「工具执行失败」。
 *
 * `tolerantText` 永不抛错：
 *   - 字符串原样通过；
 *   - 数字 / 布尔强制转为字符串；
 *   - null / 数组 / 对象一律折叠为 `undefined`（视为缺省）。
 *
 * 由此把「字段缺省 / 类型不符」的兜底责任从 schema 层下移到 execute：
 * execute 可据此回填服务端兜底内容（如会话头锚源材料），或在关键内容确实
 * 缺失时抛出清晰、可重试的中文错误，而不是让 SDK 抛出晦涩的校验异常。
 */
export function tolerantText(description: string) {
  return z
    .preprocess((value) => {
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
      return undefined;
    }, z.string().optional())
    .describe(description);
}
