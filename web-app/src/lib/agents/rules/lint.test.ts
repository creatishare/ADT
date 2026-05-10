import { describe, expect, it } from "vitest";
import {
  HARDCORE_VOCAB_BLACKLIST,
  PRODUCTION_BLACKLIST_ACTIONS,
  PRODUCTION_BLACKLIST_SCENES,
  MAGIC_BLACKLIST,
  formatLintFeedback,
  lintText,
} from "./index";

describe("rules · blacklists", () => {
  it("hardcore vocabulary blacklist contains the documented real-failure offenders", () => {
    // 真实用户反馈案例（2026-05-08）：引力锚定桩 / 磁悬浮缓冲垫 / 声波钻探 / 轨道环
    expect(HARDCORE_VOCAB_BLACKLIST).toContain("引力锚");
    expect(HARDCORE_VOCAB_BLACKLIST).toContain("磁悬浮");
    expect(HARDCORE_VOCAB_BLACKLIST).toContain("声波钻探");
    expect(HARDCORE_VOCAB_BLACKLIST).toContain("量子");
    expect(HARDCORE_VOCAB_BLACKLIST).toContain("轨道环");
    expect(HARDCORE_VOCAB_BLACKLIST).toContain("缓冲垫");
  });

  it("production blacklist (actions) covers spring/folding/stacking complexity", () => {
    expect(PRODUCTION_BLACKLIST_ACTIONS).toContain("弹簧反弹");
    expect(PRODUCTION_BLACKLIST_ACTIONS).toContain("折叠");
    expect(PRODUCTION_BLACKLIST_ACTIONS).toContain("层叠压缩");
  });

  it("production blacklist (scenes) covers underground/underwater/zero-g", () => {
    expect(PRODUCTION_BLACKLIST_SCENES).toContain("地下");
    expect(PRODUCTION_BLACKLIST_SCENES).toContain("海底");
    expect(PRODUCTION_BLACKLIST_SCENES).toContain("无重力");
  });

  it("magic blacklist still includes the original offenders from VALIDATOR_PROMPT", () => {
    expect(MAGIC_BLACKLIST).toContain("咒语");
    expect(MAGIC_BLACKLIST).toContain("魔杖");
    expect(MAGIC_BLACKLIST).toContain("精灵");
  });
});

describe("rules · lintText", () => {
  it("returns empty array for clean text", () => {
    const text =
      "机械臂沿传送带抓取 5 块岩石样本，每完成一次抓取，电子屏数字加 1。";
    expect(lintText(text)).toEqual([]);
  });

  it("flags a single hardcore-vocab hit with category and context", () => {
    const text = "探险家用引力锚固定飞船，然后开始探索遗迹。";
    const hits = lintText(text);
    expect(hits.length).toBeGreaterThan(0);
    const first = hits[0];
    expect(first).toBeDefined();
    expect(first?.category).toBe("hardcore-vocab");
    expect(first?.word).toBe("引力锚");
    expect(first?.where).toContain("引力锚");
  });

  it("flags multiple categories at once and orders them deterministically", () => {
    const text =
      "在地下隧道里，磁悬浮平台触发弹簧反弹，召唤出守护神兽。";
    const hits = lintText(text);
    const categories = hits.map((h) => h.category);
    // 应同时命中 4 类
    expect(categories).toContain("hardcore-vocab"); // 磁悬浮
    expect(categories).toContain("production-action"); // 弹簧反弹
    expect(categories).toContain("production-scene"); // 地下
    expect(categories).toContain("magic"); // 守护神兽 / 召唤
    // 顺序：硬核词 → 动作 → 场景 → 魔法
    const firstIndex = (cat: string) =>
      categories.findIndex((c) => c === cat);
    expect(firstIndex("hardcore-vocab")).toBeLessThan(firstIndex("production-action"));
    expect(firstIndex("production-action")).toBeLessThan(firstIndex("production-scene"));
    expect(firstIndex("production-scene")).toBeLessThan(firstIndex("magic"));
  });

  it("deduplicates the same word/category pair (avoids feedback flooding)", () => {
    const text =
      "引力锚解锁第一层，引力锚解锁第二层，引力锚再解锁第三层。";
    const hits = lintText(text);
    const gravityAnchorHits = hits.filter((h) => h.word === "引力锚");
    expect(gravityAnchorHits).toHaveLength(1);
  });

  it("returns empty for null/empty input", () => {
    expect(lintText("")).toEqual([]);
  });
});

describe("rules · formatLintFeedback", () => {
  it("returns empty string when no hits", () => {
    expect(formatLintFeedback([])).toBe("");
  });

  it("groups hits by category and includes Chinese label headers", () => {
    const hits = lintText(
      "在地下用磁悬浮抓取宝物，触发弹簧反弹机关。",
    );
    const feedback = formatLintFeedback(hits);
    expect(feedback).toContain("硬核科技词汇黑名单");
    expect(feedback).toContain("制作复杂度黑名单（动作类）");
    expect(feedback).toContain("制作复杂度黑名单（场景类）");
    expect(feedback).toContain("磁悬浮");
    expect(feedback).toContain("弹簧反弹");
    expect(feedback).toContain("地下");
  });

  it("instructs the LLM to fully regenerate (not just diff)", () => {
    const hits = lintText("引力锚");
    const feedback = formatLintFeedback(hits);
    expect(feedback).toContain("整体重新输出");
  });

  it("suggests whitelist substitutes in the feedback body", () => {
    const hits = lintText("磁悬浮");
    const feedback = formatLintFeedback(hits);
    expect(feedback).toContain("机械臂");
    expect(feedback).toContain("传送带");
  });
});
