import {
  BLACKLISTS,
  BLACKLIST_LABEL,
  type BlacklistCategory,
} from "./blacklists";

/**
 * 一次黑名单命中。
 *
 * - `category`：哪一份黑名单
 * - `word`：被命中的具体词条
 * - `where`：命中位置的简短上下文（前后各 12 字）；用于反馈给 LLM 让它知道修改什么
 */
export interface LintHit {
  category: BlacklistCategory;
  word: string;
  where: string;
}

/**
 * 扫描一段文本是否命中任一黑名单。
 *
 * 实现策略：
 * - 简单包含匹配（substring）。粗粒度但 0 误差识别"明显违规"。
 * - 同一个词只报告一次（按 category+word 去重），避免反馈轰炸。
 * - 多个黑名单都命中时按"硬核词汇 → 制作动作 → 制作场景 → 魔法"顺序输出，
 *   方便 retry prompt 阅读。
 */
export function lintText(text: string): LintHit[] {
  if (!text) return [];

  const seen = new Set<string>();
  const hits: LintHit[] = [];

  const ordered: BlacklistCategory[] = [
    "hardcore-vocab",
    "production-action",
    "production-scene",
    "magic",
  ];

  for (const category of ordered) {
    const list = BLACKLISTS[category];
    for (const word of list) {
      const idx = text.indexOf(word);
      if (idx === -1) continue;
      const key = `${category}::${word}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        category,
        word,
        where: contextOf(text, idx, word.length),
      });
    }
  }

  return hits;
}

/**
 * 把 lint 命中列表序列化成给 LLM 的"再生成反馈段"。
 *
 * 设计要点：
 * - 用中文，与现有 prompt 风格一致。
 * - 明确告诉模型"这是机械检查命中"，不是建议而是必须修正。
 * - 每条 hit 给出类别 + 词 + 上下文 + 推荐替换方向（白名单提示）。
 */
export function formatLintFeedback(hits: readonly LintHit[]): string {
  if (hits.length === 0) return "";

  const grouped = new Map<BlacklistCategory, LintHit[]>();
  for (const h of hits) {
    if (!grouped.has(h.category)) grouped.set(h.category, []);
    grouped.get(h.category)!.push(h);
  }

  const sections: string[] = [];
  for (const [cat, items] of grouped) {
    const label = BLACKLIST_LABEL[cat];
    const lines = items.map(
      (h) => `  - 命中"${h.word}" → 上下文："${h.where}"`,
    );
    sections.push(`【${label}】\n${lines.join("\n")}`);
  }

  return [
    "⚠️ 你刚才的输出经过自动 lint 检查，命中以下硬性黑名单——必须修正后重新输出：",
    "",
    ...sections,
    "",
    '修正方向：用"机械臂 / 传送带 / 信号灯 / 闸门 / 电梯 / 计数器 / 平移 / 旋转 / 亮灭切换 / 数字弹出 / 地表工厂 / 实验室 / 沙盘模型台"等推荐词汇替换。',
    '整体重新输出完整内容，**不要**只回复"已修改"或差异说明。',
  ].join("\n");
}

/**
 * 抓取命中点前后各 ~12 字符作为上下文，方便 LLM 定位。
 */
function contextOf(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - 12);
  const end = Math.min(text.length, idx + len + 12);
  const head = start > 0 ? "…" : "";
  const tail = end < text.length ? "…" : "";
  return head + text.slice(start, end).replace(/\s+/g, " ") + tail;
}
