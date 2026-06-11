import { describe, expect, it } from "vitest";
import {
  ConceptListSchema,
  ConceptSchema,
  ProductionDifficulty,
  flattenConceptForLint,
  serializeConcept,
  serializeConceptList,
  type ConceptList,
} from "./index";

const validConcept = {
  title: "火星探测车采集样本",
  themeDimension: "航天探索" as const,
  oneLineWrapper: "火星探测车在标记点循环采集 N 块岩石样本",
  dramaticConflict: {
    blocker:
      "N 块陨石样本散落在 N 个独立岩缝中，机械臂一次只能进一个岩缝",
    whyThisCode:
      "样本份数 N 由当天风暴评估在运行时给出，无法在出发前展开成固定行数；只能用循环按 N 迭代",
    failureCost: "漏抓任一块样本会让返航批次失败、整车任务取消",
  },
  codeMapping: [
    { structure: "for 循环", phase: "进入" as const, stageEffect: "机械臂启动到位" },
    {
      structure: "for 循环",
      phase: "迭代" as const,
      stageEffect: "机械臂抓取一块岩石放入储存舱",
    },
    {
      structure: "for 循环",
      phase: "退出" as const,
      stageEffect: "储存舱关闭，电子屏显示总数",
    },
  ],
  visualKeyElements: ["机械臂", "传送带", "电子屏"],
  diffFromOthers: "强调机械重复动作，与农业种植场景形成题材差异",
  productionDifficulty: "简单" as const,
  vocabularyCheck:
    "本概念使用机械臂/传送带/电子屏，全部来自推荐词汇白名单",
};

const validList: ConceptList = {
  concepts: [
    validConcept,
    { ...validConcept, title: "工厂传送带打包箱子", themeDimension: "机械工程" },
    { ...validConcept, title: "温室浇花机定时浇水", themeDimension: "农业种植" },
    { ...validConcept, title: "考古队拓印石碑", themeDimension: "考古探险" },
    { ...validConcept, title: "实验室试管循环加热", themeDimension: "科学实验" },
  ],
};

describe("ConceptSchema", () => {
  it("accepts a well-formed concept", () => {
    const r = ConceptSchema.safeParse(validConcept);
    expect(r.success).toBe(true);
  });

  it('rejects productionDifficulty="困难" (the schema enum has no such variant)', () => {
    const r = ProductionDifficulty.safeParse("困难");
    expect(r.success).toBe(false);
  });

  it("requires at least 3 codeMapping rows (drives recursion 三阶段 / loop 三阶段)", () => {
    const broken = {
      ...validConcept,
      codeMapping: [validConcept.codeMapping[0]], // only 1 row
    };
    const r = ConceptSchema.safeParse(broken);
    expect(r.success).toBe(false);
  });

  it("requires 3-5 visualKeyElements", () => {
    const tooFew = { ...validConcept, visualKeyElements: ["a", "b"] };
    expect(ConceptSchema.safeParse(tooFew).success).toBe(false);

    const tooMany = {
      ...validConcept,
      visualKeyElements: ["a", "b", "c", "d", "e", "f"],
    };
    expect(ConceptSchema.safeParse(tooMany).success).toBe(false);
  });

  it("rejects unknown executionPhase like '未知阶段'", () => {
    const broken = {
      ...validConcept,
      codeMapping: [
        { structure: "for 循环", phase: "未知阶段", stageEffect: "..." },
        ...validConcept.codeMapping,
      ],
    };
    const r = ConceptSchema.safeParse(broken);
    expect(r.success).toBe(false);
  });

  it("rejects unknown themeDimension", () => {
    const broken = { ...validConcept, themeDimension: "异世界冒险" };
    const r = ConceptSchema.safeParse(broken);
    expect(r.success).toBe(false);
  });

  it("rejects title longer than 20 characters", () => {
    const broken = { ...validConcept, title: "一二三四五六七八九十一二三四五六七八九十一" };
    expect(ConceptSchema.safeParse(broken).success).toBe(false);
  });

  it("requires a dramaticConflict block (blocker / whyThisCode / failureCost)", () => {
    // 三段都缺
    const missingAll = { ...validConcept };
    // @ts-expect-error: 故意删字段做反向测试
    delete missingAll.dramaticConflict;
    expect(ConceptSchema.safeParse(missingAll).success).toBe(false);

    // 缺 blocker
    const missingBlocker = {
      ...validConcept,
      dramaticConflict: {
        whyThisCode: validConcept.dramaticConflict.whyThisCode,
        failureCost: validConcept.dramaticConflict.failureCost,
      },
    };
    expect(ConceptSchema.safeParse(missingBlocker).success).toBe(false);

    // 缺 whyThisCode
    const missingWhy = {
      ...validConcept,
      dramaticConflict: {
        blocker: validConcept.dramaticConflict.blocker,
        failureCost: validConcept.dramaticConflict.failureCost,
      },
    };
    expect(ConceptSchema.safeParse(missingWhy).success).toBe(false);

    // 缺 failureCost
    const missingCost = {
      ...validConcept,
      dramaticConflict: {
        blocker: validConcept.dramaticConflict.blocker,
        whyThisCode: validConcept.dramaticConflict.whyThisCode,
      },
    };
    expect(ConceptSchema.safeParse(missingCost).success).toBe(false);
  });

  it("enforces minimum length on dramaticConflict fields (no one-liner placeholders)", () => {
    const tooShort = {
      ...validConcept,
      dramaticConflict: {
        blocker: "短",
        whyThisCode: "短",
        failureCost: "短",
      },
    };
    expect(ConceptSchema.safeParse(tooShort).success).toBe(false);
  });
});

describe("ConceptListSchema", () => {
  it("accepts exactly 5 concepts", () => {
    expect(ConceptListSchema.safeParse(validList).success).toBe(true);
  });

  it("rejects 4 or 6 concepts (must be exactly 5)", () => {
    const four = { concepts: validList.concepts.slice(0, 4) };
    expect(ConceptListSchema.safeParse(four).success).toBe(false);

    const six = {
      concepts: [...validList.concepts, validList.concepts[0]],
    };
    expect(ConceptListSchema.safeParse(six).success).toBe(false);
  });
});

describe("serializeConcept / serializeConceptList", () => {
  it("renders a single concept to markdown with the canonical 3-column mapping table", () => {
    const md = serializeConcept(validConcept, 1);
    expect(md).toContain("## 概念 1：火星探测车采集样本");
    expect(md).toContain("| 代码结构 | 执行阶段 | 舞台表现 |");
    expect(md).toContain("| for 循环 | 进入 | 机械臂启动到位 |");
    expect(md).toContain("**制作难度自评**：简单");
  });

  it("renders the dramaticConflict block with all three sub-points", () => {
    const md = serializeConcept(validConcept, 1);
    expect(md).toContain("**剧情冲突 (Why this code is the ONLY way)**");
    expect(md).toContain("**角色被什么卡住**");
    expect(md).toContain("**为什么必须用这个知识点**");
    expect(md).toContain("**失败代价**");
    expect(md).toContain(validConcept.dramaticConflict.blocker);
    expect(md).toContain(validConcept.dramaticConflict.whyThisCode);
    expect(md).toContain(validConcept.dramaticConflict.failureCost);
  });

  it("renders 5 concepts joined by blank-line separators", () => {
    const md = serializeConceptList(validList);
    expect(md).toContain("## 概念 1：");
    expect(md).toContain("## 概念 5：");
  });
});

describe("flattenConceptForLint", () => {
  it("includes user-facing text fields, not schema metadata", () => {
    const flat = flattenConceptForLint(validConcept);
    expect(flat).toContain("机械臂");
    expect(flat).toContain("电子屏");
    // 不包含 schema 字段名
    expect(flat).not.toContain("themeDimension");
    expect(flat).not.toContain("codeMapping");
  });

  it("includes dramaticConflict text so blacklist words there are caught", () => {
    const flat = flattenConceptForLint(validConcept);
    expect(flat).toContain(validConcept.dramaticConflict.blocker);
    expect(flat).toContain(validConcept.dramaticConflict.whyThisCode);
    expect(flat).toContain(validConcept.dramaticConflict.failureCost);
    // 不要把 schema 字段名扫进去
    expect(flat).not.toContain("dramaticConflict");
    expect(flat).not.toContain("whyThisCode");
  });
});
