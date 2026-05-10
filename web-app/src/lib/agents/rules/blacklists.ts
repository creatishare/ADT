/**
 * 概念/方案级"机械可查"黑白名单。
 *
 * 设计取舍：
 * - 这些清单**不再嵌入** prompt 字符串，而是后处理 lint 阶段用代码扫描。
 * - prompt 仍保留对"会有外部 lint 检查"的元提示，但具体词条由本模块统一维护。
 * - 新增黑名单只改本文件，不再污染 prompts.ts，也不需要改 prompts.test.ts。
 *
 * 匹配策略：包含匹配（substring），简单可靠；少量误伤可在调用方上下文里通过
 * userGuidance 关闭（路径 D 之后再做精细化）。
 */

/**
 * 硬核科技词汇黑名单 —— 8-12 岁孩子无法在脑中建立画面的"科幻酷炫词"。
 * 命中即视为"儿童认知适配"维度不合格。
 */
export const HARDCORE_VOCAB_BLACKLIST = [
  // 力学类
  "引力锚",
  "引力锚定",
  "反重力",
  "失重",
  "磁悬浮",
  "电磁场",
  "磁场感应",
  "声波钻探",
  "超声波",
  "次声波",
  // 量子/能量类
  "量子",
  "相位",
  "力场",
  "能量场",
  "聚变",
  "反物质",
  "暗物质",
  "黑洞",
  "等离子",
  // 空间/几何类
  "轨道环",
  "轨道层叠",
  "轨道压缩",
  "折叠空间",
  "空间折叠",
  "维度折叠",
  // 缓冲/反弹类（涉及"下降-反弹"动力学时）
  "缓冲垫",
  "缓冲器",
] as const;

/**
 * 制作复杂度黑名单 · 动作类 —— 普通 2D 动画团队做不出或成本极高的动作。
 */
export const PRODUCTION_BLACKLIST_ACTIONS = [
  "弹簧反弹",
  "弹性形变",
  "软体变形",
  "软体",
  "折叠",
  "展开",
  "自变形",
  "层叠压缩",
  "嵌套压缩",
  "层级压扁",
  "物理碰撞",
  "流体",
  "烟雾",
  "粒子爆炸",
  "骨骼动画",
] as const;

/**
 * 制作复杂度黑名单 · 场景类 —— 美术不便制作或视角难处理的场景。
 */
export const PRODUCTION_BLACKLIST_SCENES = [
  "地下",
  "隧道",
  "矿洞",
  "地核",
  "海底",
  "无重力",
  "空间站内部",
  "剖面图",
  "透视图",
  "星系级",
] as const;

/**
 * 魔法元素黑名单 —— 与产品"科学具象化"原则直接冲突。
 */
export const MAGIC_BLACKLIST = [
  "咒语",
  "魔杖",
  "法术",
  "召唤",
  "精灵",
  "妖精",
  "巫师",
  "超自然能量",
  "水晶球",
  "瞬移",
  "变形术",
  "守护神兽",
] as const;

/**
 * 黑名单 → 命中后对应的扣分类别（与 VALIDATOR_PROMPT 评分维度一致）。
 */
export type BlacklistCategory =
  | "hardcore-vocab"
  | "production-action"
  | "production-scene"
  | "magic";

/**
 * 黑名单总览（按类别索引），方便 lint 模块和 prompt 拼接共用。
 */
export const BLACKLISTS: Readonly<Record<BlacklistCategory, readonly string[]>> = {
  "hardcore-vocab": HARDCORE_VOCAB_BLACKLIST,
  "production-action": PRODUCTION_BLACKLIST_ACTIONS,
  "production-scene": PRODUCTION_BLACKLIST_SCENES,
  magic: MAGIC_BLACKLIST,
};

/**
 * 类别 → 中文显示名（用于 lint 反馈给 LLM 的 retry prompt）。
 */
export const BLACKLIST_LABEL: Readonly<Record<BlacklistCategory, string>> = {
  "hardcore-vocab": "硬核科技词汇黑名单",
  "production-action": "制作复杂度黑名单（动作类）",
  "production-scene": "制作复杂度黑名单（场景类）",
  magic: "魔法元素黑名单",
};
