import { describe, expect, it } from "vitest";
import {
  DESIGNER_PROMPT,
  ORCHESTRATOR_SYSTEM_PROMPT,
  VALIDATOR_PROMPT,
  WRITER_PROMPT,
} from "./prompts";

describe("prompts: execution-phase coverage", () => {
  describe("DESIGNER_PROMPT", () => {
    it("includes the execution-phase checklist for two-way control flow", () => {
      expect(DESIGNER_PROMPT).toContain("执行阶段必查清单");
      expect(DESIGNER_PROMPT).toContain("递入");
      expect(DESIGNER_PROMPT).toContain("触底");
      expect(DESIGNER_PROMPT).toContain("归出");
    });

    it("warns explicitly against drawing only the descent phase of recursion", () => {
      expect(DESIGNER_PROMPT).toContain("严禁只画正向流");
    });

    it("upgrades the code-mapping table to three columns including 执行阶段", () => {
      expect(DESIGNER_PROMPT).toMatch(/\|\s*代码结构\s*\|\s*执行阶段\s*\|\s*舞台表现\s*\|/);
    });

    it("includes a counter-example for missing 归 phase", () => {
      expect(DESIGNER_PROMPT).toContain("只画递不画归");
    });

    it("includes a counter-example for missing loop exit", () => {
      expect(DESIGNER_PROMPT).toContain("循环无退出");
    });
  });

  describe("VALIDATOR_PROMPT", () => {
    it("hardens the code-stage consistency gate to ≥4", () => {
      expect(VALIDATOR_PROMPT).toContain("代码-舞台一致性 <4 分");
      expect(VALIDATOR_PROMPT).toMatch(/代码-舞台一致性[\s\S]{0,200}≥4（硬门槛）/);
    });

    it("lists code-stage consistency as a hard veto alongside non-magic", () => {
      expect(VALIDATOR_PROMPT).toContain("一票否决");
      expect(VALIDATOR_PROMPT).toContain("非魔法性 <4 分");
      expect(VALIDATOR_PROMPT).toContain("代码-舞台一致性 <4 分");
    });

    it("includes the execution-phase missing-piece checklist", () => {
      expect(VALIDATOR_PROMPT).toContain("执行阶段缺漏检查清单");
      expect(VALIDATOR_PROMPT).toContain("归出");
      expect(VALIDATOR_PROMPT).toContain("终止条件触发后的退出动作");
    });

    it("redefines 3-point case as 'forward flow only, missing reverse flow'", () => {
      expect(VALIDATOR_PROMPT).toContain("覆盖正向流但缺反向流");
    });
  });

  describe("WRITER_PROMPT", () => {
    it("upgrades the code-stage mapping table to four columns including 执行阶段", () => {
      expect(WRITER_PROMPT).toMatch(
        /\|\s*代码行\/结构\s*\|\s*执行阶段\s*\|\s*舞台表现\s*\|\s*触发时机\s*\|/,
      );
    });

    it("requires the action-flow section to split into forward + reverse for two-way constructs", () => {
      expect(WRITER_PROMPT).toContain("正向段");
      expect(WRITER_PROMPT).toContain("反向段");
    });

    it("provides a recursion exemplar covering 递入 / 触底 / 归出", () => {
      expect(WRITER_PROMPT).toContain("递入");
      expect(WRITER_PROMPT).toContain("触底");
      expect(WRITER_PROMPT).toContain("归出");
    });
  });
});

describe("prompts: planning-mode branches", () => {
  describe("ORCHESTRATOR_SYSTEM_PROMPT", () => {
    it("describes a workflow-branch section keyed by planning mode", () => {
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("工作流分支");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("planningMode");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("standard");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("single-group");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("integration");
    });

    it("forbids cross-group hook segments in single-group mode", () => {
      // 这一节文案必须明确告知 single-group 模式跳过跨题组物理状态钩子段
      // （2026-05-13 起术语从"剧情衔接"改为"冲突起点 / 冲突解除后的舞台变化"）
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
        /single-group[\s\S]*?冲突起点|冲突起点[\s\S]*?single-group/,
      );
    });

    it("skips validateStageFile and document-iteration in single-group mode", () => {
      // 单题组模式必须明确跳过验证（第 4 步）和迭代（第 6 步）
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
        /single-group[\s\S]*?(?:不要|跳过|不调用)[\s\S]{0,80}validateStageFile/,
      );
      // 必须明确不走 integrate_document
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
        /single-group[\s\S]*?(?:不要|跳过|不调用)[\s\S]{0,80}integrate_document/,
      );
    });

    it("routes single-group directly to writeStageFile after concept selection", () => {
      // 单题组挑选满意后必须直接 writeStageFile，不走验证/迭代
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
        /single-group[\s\S]*?(?:满意|确认)[\s\S]*?writeStageFile/,
      );
    });

    it("instructs integration mode to call adapt_concepts and skip 5-concept generation", () => {
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("adapt_concepts");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(/integration[\s\S]*?跳过/);
    });

    it("requires preserving gameplay essence in integration mode", () => {
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("玩法本质");
    });
  });

  describe("DESIGNER_PROMPT (adapt_concepts mode)", () => {
    it("documents adapt_concepts as a third running mode", () => {
      expect(DESIGNER_PROMPT).toContain("adapt_concepts");
    });

    it("forbids changing the code-to-stage mapping essence in adapt_concepts mode", () => {
      // 必须出现"保持玩法本质不变"或"代码 ↔ 舞台映射不变"等约束
      expect(DESIGNER_PROMPT).toMatch(/玩法本质[\s\S]{0,200}不变|不变[\s\S]{0,200}玩法本质/);
    });

    it("allows lightweight adaptation only on packaging / naming / visual", () => {
      expect(DESIGNER_PROMPT).toContain("轻量");
    });

    it("requires generating a 1-2 sentence storyline bridge across groups", () => {
      // adapt_concepts 段落必须要求剧情衔接
      expect(DESIGNER_PROMPT).toMatch(/adapt_concepts[\s\S]*?剧情/);
    });
  });

  describe("VALIDATOR_PROMPT (mode awareness)", () => {
    it("recognizes [mode:single-group] and skips storyline-coherence dimension", () => {
      expect(VALIDATOR_PROMPT).toContain("[mode:single-group]");
      // 必须说明此情况下剧情连贯性维度跳过 / N/A
      expect(VALIDATOR_PROMPT).toMatch(/single-group[\s\S]*?剧情连贯性[\s\S]{0,80}(N\/A|跳过)/);
    });

    it("recognizes [mode:integration] and appends a gameplay-preservation checklist", () => {
      expect(VALIDATOR_PROMPT).toContain("[mode:integration]");
      // 出现"玩法本质核查清单"或同义结构
      expect(VALIDATOR_PROMPT).toMatch(/玩法本质核查/);
    });
  });

  describe("WRITER_PROMPT (mode awareness)", () => {
    it("drops storyline bridge fields when [mode:single-group] is present", () => {
      expect(WRITER_PROMPT).toContain("[mode:single-group]");
      expect(WRITER_PROMPT).toMatch(/single-group[\s\S]*?(剧情衔接|前置剧情)/);
    });

    it("adds a user-original shell comparison table when [mode:integration]", () => {
      expect(WRITER_PROMPT).toContain("[mode:integration]");
      expect(WRITER_PROMPT).toContain("用户原始壳子对照表");
    });
  });
});

// ----------------------------------------------------------------------------
// 第三批：词汇可懂度 + 代码输出可视化 + 制作可行性
// 真实失败案例（用户反馈 2026-05-08）：
//   - 引力锚定桩 / 磁悬浮缓冲垫 / 声波钻探 / 折叠梯太空舱 / 轨道环层叠压缩
//   原因：硬核科技词汇 + 复杂物理动画 + 不便制作的场景
//   附加：cout 输出未在舞台呈现（如递归打印 n 时舞台无对应数字）
// ----------------------------------------------------------------------------

describe("prompts: vocabulary readability + cout visualization + producibility", () => {
  describe("DESIGNER_PROMPT", () => {
    it("declares a hard-sci-fi vocabulary blacklist that mentions known offenders", () => {
      expect(DESIGNER_PROMPT).toContain("硬核科技词汇黑名单");
      // 用户反馈中明确出现过的词必须被点名
      expect(DESIGNER_PROMPT).toContain("引力锚");
      expect(DESIGNER_PROMPT).toContain("磁悬浮");
      expect(DESIGNER_PROMPT).toContain("声波");
      expect(DESIGNER_PROMPT).toContain("量子");
    });

    it("provides a child-friendly vocabulary whitelist for substitution", () => {
      expect(DESIGNER_PROMPT).toContain("推荐词汇白名单");
      // 至少包含几个孩子日常能接触的具象词
      expect(DESIGNER_PROMPT).toContain("机械臂");
      expect(DESIGNER_PROMPT).toContain("传送带");
      expect(DESIGNER_PROMPT).toContain("信号灯");
    });

    it("adds a cout/print row to the execution-phase checklist requiring stage output", () => {
      expect(DESIGNER_PROMPT).toMatch(/cout|printf|输出语句/);
      // 必须明确"输出值需要在舞台同步可视化"
      expect(DESIGNER_PROMPT).toMatch(/输出.{0,50}舞台.{0,30}(可视化|呈现|显示)/);
    });

    it("introduces a producibility principle (low animation/scene complexity)", () => {
      expect(DESIGNER_PROMPT).toContain("制作可行性");
    });

    it("blacklists complex animation/scene patterns that previously failed", () => {
      expect(DESIGNER_PROMPT).toContain("制作复杂度黑名单");
      // 用户反馈里明确不好做的模式
      expect(DESIGNER_PROMPT).toContain("弹簧");
      expect(DESIGNER_PROMPT).toContain("折叠");
      expect(DESIGNER_PROMPT).toContain("层叠");
      expect(DESIGNER_PROMPT).toContain("地下");
    });

    it("requires every concept to self-rate production difficulty and forbid '困难'", () => {
      expect(DESIGNER_PROMPT).toContain("制作难度自评");
      // 必须出现"禁止"或"不允许"输出"困难"等级的概念
      expect(DESIGNER_PROMPT).toMatch(/(困难|高难)[\s\S]{0,40}(禁止|不允许|不可)/);
    });

    it("includes a counter-example using a hard-sci-fi term from real feedback", () => {
      // 至少给出 1 个反例引用真实失败案例（引力锚 / 磁悬浮 / 折叠等）
      expect(DESIGNER_PROMPT).toMatch(/(引力锚|磁悬浮|折叠).{0,200}(坏例|❌)|(?:坏例|❌).{0,200}(引力锚|磁悬浮|折叠)/);
    });
  });

  describe("VALIDATOR_PROMPT", () => {
    it("imports the hard-sci-fi vocabulary blacklist with concrete offenders", () => {
      expect(VALIDATOR_PROMPT).toContain("硬核科技词汇黑名单");
      expect(VALIDATOR_PROMPT).toContain("引力锚");
      expect(VALIDATOR_PROMPT).toContain("磁悬浮");
    });

    it("imports the production-complexity blacklist", () => {
      expect(VALIDATOR_PROMPT).toContain("制作复杂度黑名单");
      expect(VALIDATOR_PROMPT).toContain("弹簧");
      expect(VALIDATOR_PROMPT).toContain("折叠");
    });

    it("appends a cout/output coverage row to the execution-phase checklist", () => {
      expect(VALIDATOR_PROMPT).toMatch(/cout|输出语句/);
    });

    it("adds 儿童认知适配 <3 as a third hard veto rule", () => {
      // 出现明确的一票否决条目
      expect(VALIDATOR_PROMPT).toMatch(/儿童认知适配\s*<\s*3/);
    });

    it("explicitly maps blacklist hits to scoring deductions", () => {
      // 黑名单命中需要触发扣分（不是软建议）
      expect(VALIDATOR_PROMPT).toMatch(/黑名单[\s\S]{0,200}(扣|≤2|≤3|不通过)/);
    });
  });
});

// ----------------------------------------------------------------------------
// Kickoff 头锚消息说明（2026-05-09 修复 · 长会话不丢源材料）
// 配合 src/lib/chat/memory.ts 的 applyHeadAnchorWindow 工作。
// ----------------------------------------------------------------------------

describe("prompts: kickoff head-anchor instructions", () => {
  it("ORCHESTRATOR_SYSTEM_PROMPT documents the head-anchor mechanism", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("Kickoff 头锚消息");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("第一条用户消息");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("applyHeadAnchorWindow");
  });

  it("ORCHESTRATOR_SYSTEM_PROMPT instructs the LLM to extract topicInfo from the anchor", () => {
    // 必须明确写"从头锚里精确摘取 topicInfo"，否则 LLM 会凭印象
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
      /头锚[\s\S]{0,80}(精确摘取|摘取|读取)[\s\S]{0,80}topicInfo/,
    );
  });

  it("ORCHESTRATOR_SYSTEM_PROMPT forbids fabricating missing source material", () => {
    // 头锚里找不到题组源材料时，必须告知用户而非编造
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
      /(找不到|缺失|没有)[\s\S]{0,80}(明确告诉|告知|停下来)/,
    );
  });
});

// ----------------------------------------------------------------------------
// 第四批：结构化 accumulatedGuidance 与作用域隔离（2026-05-11）
// 真实失败案例：扁平 string[] 形态把"用户在题组1挑了航天题材"当作长期偏好
//   传给题组2/3/4 的 designStageFile.generate_concepts，导致跨题组题材趋同。
// ----------------------------------------------------------------------------

describe("prompts: dramatic-conflict field (knowledge embedded in story)", () => {
  describe("DESIGNER_PROMPT (generate_concepts)", () => {
    it("introduces a dramatic-conflict block with three required sub-points", () => {
      expect(DESIGNER_PROMPT).toContain("剧情冲突");
      expect(DESIGNER_PROMPT).toContain("Why this code is the ONLY way");
      expect(DESIGNER_PROMPT).toContain("角色被什么卡住");
      expect(DESIGNER_PROMPT).toContain("为什么必须用这个知识点");
      expect(DESIGNER_PROMPT).toContain("失败代价");
    });

    it("requires a 'replacement test' that proves the code structure is load-bearing", () => {
      // 替换测试是这条优化的判定核心：把代码换成顺序写法/暴力解，剧情必须立刻崩
      expect(DESIGNER_PROMPT).toContain("替换测试");
      // 必须出现"换成顺序结构/平铺/暴力解 → 剧情崩"这条因果链
      expect(DESIGNER_PROMPT).toMatch(
        /顺序|平铺|暴力解[\s\S]{0,80}(崩|不行|失败|报错)/,
      );
    });

    it("avoids using lint-blacklisted words ('展开') in the prompt so LLM does not echo them", () => {
      // 防止 LLM 把 prompt 里的"展开"原样输出后被 lint 误判为复杂动作
      // （PRODUCTION_BLACKLIST_ACTIONS 包含"展开"）
      expect(DESIGNER_PROMPT).not.toMatch(/顺序展开/);
    });

    it("requires failure cost to be visible on stage, not narrative-only", () => {
      // 失败代价必须在舞台上看得见，不是"扣分"等叙述层惩罚
      expect(DESIGNER_PROMPT).toMatch(/失败代价[\s\S]{0,300}(舞台|可见|看得见)/);
    });

    it("includes a counter-example for the 'story-shell' anti-pattern (replacement test fails)", () => {
      // 必须有一个"知识点可拿掉"的反例，且其改法把循环次数和剧情物理绑死
      expect(DESIGNER_PROMPT).toContain("剧情壳");
      expect(DESIGNER_PROMPT).toContain("知识点可拿掉");
      expect(DESIGNER_PROMPT).toMatch(/替换测试|顺序展开/);
    });
  });
});

// ----------------------------------------------------------------------------
// 第五批：冲突链骨架 (Mission + per-group physical-state hooks)
// 第 1 步把"剧情冲突"做成了概念级一等公民；第 2 步把"剧情衔接"换成
// 整课节级"主任务 + 冲突链"骨架，并把跨题组过渡句胶水换成基于舞台物理
// 状态钩子的三段结构：冲突起点 / 为什么必须用本知识点 / 冲突解除后的舞台变化。
// ----------------------------------------------------------------------------

describe("prompts: conflict-chain skeleton (Mission + cross-group physical hooks)", () => {
  describe("DESIGNER_PROMPT (integrate_document)", () => {
    it("requires a top-level Mission section with goal + on-stage failure cost", () => {
      expect(DESIGNER_PROMPT).toContain("主任务 (Mission)");
      expect(DESIGNER_PROMPT).toContain("失败代价");
      // 失败代价必须是剧情物理层，不是"任务扣分"等叙述层惩罚
      expect(DESIGNER_PROMPT).toMatch(/失败代价[\s\S]{0,200}(舞台可见|物理|物体|位置|灯光)/);
    });

    it("requires a Conflict Chain table linking all groups (4 columns)", () => {
      expect(DESIGNER_PROMPT).toContain("冲突链 (Conflict Chain)");
      // 四列：题组 / 子障碍 / 为什么必须用本知识点 / 通关后舞台留给下一题组的钩子
      expect(DESIGNER_PROMPT).toMatch(
        /子障碍[\s\S]{0,200}为什么必须用本知识点[\s\S]{0,200}通关后舞台留给下一题组的钩子/,
      );
    });

    it("replaces 前置/后置剧情衔接 with three physical-state-hook fields", () => {
      expect(DESIGNER_PROMPT).toContain("冲突起点");
      expect(DESIGNER_PROMPT).toContain("冲突解除后的舞台变化");
      // "冲突起点"必须明示物体/数量/位置/灯光等物理状态描述
      expect(DESIGNER_PROMPT).toMatch(/冲突起点[\s\S]{0,400}(物体|数量|位置|灯光)/);
      // 必须明确禁止叙述层过渡句
      expect(DESIGNER_PROMPT).toMatch(/禁止[\s\S]{0,80}(叙述层|过渡句)/);
    });

    it("requires self-check: 冲突解除后的舞台变化 must dovetail with next group's 冲突起点", () => {
      expect(DESIGNER_PROMPT).toContain("首尾咬合");
    });
  });

  describe("DESIGNER_PROMPT (adapt_concepts)", () => {
    it("upgrades the 'storyline bridge' constraint to require Mission + Conflict Chain skeleton", () => {
      expect(DESIGNER_PROMPT).toMatch(/adapt_concepts[\s\S]*?主任务[\s\S]{0,200}冲突链/);
    });
  });

  describe("WRITER_PROMPT", () => {
    it("adds a 为什么必须用本知识点 column to the overview table", () => {
      // 在 courseCode 之后的表头必须出现新列
      expect(WRITER_PROMPT).toMatch(
        /\|\s*题组\s*\|\s*courseCode[\s\S]{0,300}\|\s*为什么必须用本知识点（一句话）\s*\|/,
      );
    });

    it("replaces 前置/后置剧情衔接 with the 3 new physical-state-hook fields", () => {
      // 模板里必须出现新字段
      expect(WRITER_PROMPT).toContain("冲突起点");
      expect(WRITER_PROMPT).toContain("为什么必须用本知识点");
      expect(WRITER_PROMPT).toContain("冲突解除后的舞台变化");
    });

    it("explicitly deprecates the old 前置剧情衔接 / 后置剧情衔接 fields", () => {
      // 在主体里要给出明确"废弃 / 不要再用"的提示，防止 LLM 退化使用旧字段
      expect(WRITER_PROMPT).toMatch(/前置剧情衔接[\s\S]{0,80}(废弃|不要|禁止)/);
    });

    it("requires dovetail between adjacent groups via the new hook field", () => {
      expect(WRITER_PROMPT).toMatch(/冲突解除后的舞台变化[\s\S]{0,300}首尾必须咬合/);
    });
  });

  describe("ORCHESTRATOR_SYSTEM_PROMPT", () => {
    it("aligns single-group note with the new vocabulary (冲突起点 / 冲突解除后的舞台变化)", () => {
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
        /single-group[\s\S]*?冲突起点[\s\S]*?冲突解除后的舞台变化/,
      );
    });

    it("preserves 为什么必须用本知识点 even in single-group mode", () => {
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
        /single-group[\s\S]*?保留[\s\S]{0,200}为什么必须用本知识点/,
      );
    });
  });
});

// ----------------------------------------------------------------------------
// 第六批：VALIDATOR_PROMPT 加第 5 维度"知识点必要性"（2026-05-14）
// 第 1 + 2 步把"知识点长在剧情里"做成了 DESIGNER / WRITER 的输出要求，
// 但只是"鼓励"——没有硬门槛卡死硬贴剧情。第 3 步在 VALIDATOR 加新维度 +
// 替换测试判定细则 + 硬门槛 ≥4，让整套优化闭环。
// ----------------------------------------------------------------------------

describe("prompts: VALIDATOR_PROMPT — knowledge-point necessity dimension", () => {
  it("declares a 5-dimension rubric with 知识点必要性 as the 5th dimension", () => {
    expect(VALIDATOR_PROMPT).toContain("5 维");
    expect(VALIDATOR_PROMPT).toContain("满分 25");
    expect(VALIDATOR_PROMPT).toContain("知识点必要性");
  });

  it("treats 知识点必要性 as a hard gate ≥4 (one-vote veto on <4)", () => {
    // 评分表里这一维必须显式标硬门槛
    expect(VALIDATOR_PROMPT).toMatch(
      /知识点必要性[\s\S]{0,400}≥\s*4（硬门槛）/,
    );
    // 一票否决清单必须新增"知识点必要性 <4 分"
    expect(VALIDATOR_PROMPT).toMatch(/一票否决[\s\S]{0,800}知识点必要性\s*<\s*4\s*分/);
  });

  it("bumps total to 25 and pass threshold to 18 in standard mode", () => {
    expect(VALIDATOR_PROMPT).toMatch(/总分\s*≥\s*\*?\*?\s*18\/25/);
    // 输出格式块里的"总分：XX/25"也必须同步
    expect(VALIDATOR_PROMPT).toContain("总分：XX/25");
  });

  it("provides a concrete 替换测试 procedure with 5/3/0-point rubric", () => {
    expect(VALIDATOR_PROMPT).toContain("替换测试判定细则");
    // 5/3/0 三档要全部出现
    expect(VALIDATOR_PROMPT).toMatch(/替换后舞台物理立刻崩[\s\S]{0,80}\*\*5\s*分\*\*/);
    expect(VALIDATOR_PROMPT).toMatch(/替换后剧情说得通但代码冗余[\s\S]{0,80}\*\*3\s*分\*\*/);
    expect(VALIDATOR_PROMPT).toMatch(/替换后剧情完全不受影响[\s\S]{0,80}\*\*0\s*分\*\*/);
  });

  it("requires the document-level 必要性 score to be the MIN across all groups (no averaging)", () => {
    // 防止 LLM 用"平均一下"蒙混过关
    expect(VALIDATOR_PROMPT).toMatch(/最小值|min[\s\S]{0,40}平均/);
  });

  it("adds 必要性 column to the per-group 逐题组审核 table", () => {
    expect(VALIDATOR_PROMPT).toMatch(
      /题组\s*\|\s*非魔法\s*\|\s*一致性\s*\|\s*必要性\s*\|/,
    );
  });

  it("requires 修改建议清单 for 必要性 issues to give a physical-setting fix (not vague 'strengthen conflict')", () => {
    expect(VALIDATOR_PROMPT).toMatch(/知识点必要性[\s\S]{0,300}(物理设定|物理改动|让.+通不过)/);
  });

  it("provides at least one positive + one negative replacement-test example", () => {
    // 正例：递归→单层 for 不能演归出
    expect(VALIDATOR_PROMPT).toMatch(/递归[\s\S]{0,400}归出[\s\S]{0,200}必要性\s*5\s*分/);
    // 反例：3 次 Hello 平铺剧情不变
    expect(VALIDATOR_PROMPT).toMatch(/Hello[\s\S]{0,200}必要性\s*0\s*分/);
  });
});

describe("prompts: VALIDATOR_PROMPT — mode awareness updates for the 5th dimension", () => {
  it("[mode:single-group] skips 剧情连贯性 but KEEPS 知识点必要性 hard gate", () => {
    // 剧情连贯性 N/A 保持不变
    expect(VALIDATOR_PROMPT).toMatch(
      /single-group[\s\S]*?剧情连贯性[\s\S]{0,200}(N\/A|跳过)/,
    );
    // 但 必要性 ≥4 硬门槛必须明示保留
    expect(VALIDATOR_PROMPT).toMatch(
      /single-group[\s\S]*?知识点必要性[\s\S]{0,200}(保留|≥\s*4)/,
    );
  });

  it("[mode:single-group] uses ≥14/20 threshold (4 dims × 5 = 20)", () => {
    expect(VALIDATOR_PROMPT).toMatch(/single-group[\s\S]*?总分\s*≥\s*\*?\*?\s*14\/20/);
  });

  it("[mode:integration] explicitly mentions the 5-dimension standard", () => {
    expect(VALIDATOR_PROMPT).toMatch(/integration[\s\S]*?五维标准/);
  });
});

describe("prompts: structured accumulatedGuidance & scope isolation", () => {
  describe("ORCHESTRATOR_SYSTEM_PROMPT", () => {
    it("documents accumulatedGuidance as a structured object (not string[])", () => {
      // State Block 示例必须出现结构化字段名
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("logicVisualPatterns");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("wordingStyle");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("avoidances");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("perGroupTheme");
    });

    it("ties perGroupTheme keys to courseCode", () => {
      // perGroupTheme 的 key 必须是 courseCode 而不是"题组N"字串
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
        /perGroupTheme[\s\S]{0,200}courseCode/,
      );
    });

    it("classifies the 4 user-signal buckets explicitly", () => {
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("桶 1");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("桶 2");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("桶 3");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("桶 4");
    });

    it("forbids treating single-group theme choice as a cross-group preference", () => {
      // 关键反向去重规则：单题组题材不可外溢
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
        /(严禁|不要|绝不)[\s\S]{0,200}(单题组|题材选择)[\s\S]{0,200}(跨题组|长期偏好)/,
      );
    });

    it("requires per-group theme to remain scoped only to its courseCode", () => {
      // perGroupTheme 段在调用下一题组时不应外泄
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
        /当前题组题材[\s\S]{0,300}(不要|严禁|绝不)[\s\S]{0,80}(其它题组|下一题组|塞进)/,
      );
    });

    it("requires segmented userGuidance serialization with named section headers", () => {
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("## 跨题组逻辑↔舞台映射偏好");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("## 用词与排版偏好");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("## 用户明确禁忌");
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("## 当前题组题材");
    });

    it("instructs cross-group tool calls to omit the per-group theme section", () => {
      // integrate_document / adapt_concepts 调用必须省略题材段
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
        /(integrate_document|adapt_concepts)[\s\S]{0,200}(省略|不输出)[\s\S]{0,80}当前题组题材/,
      );
    });
  });

  describe("DESIGNER_PROMPT", () => {
    it("consumes the logicVisualPatterns section by name", () => {
      expect(DESIGNER_PROMPT).toContain("## 跨题组逻辑↔舞台映射偏好");
    });

    it("treats ✗ patterns as avoid and ✓ patterns as prefer", () => {
      // Order-agnostic: either "✓ ... 优先/采用" or "优先/采用 ... ✓" is acceptable
      expect(DESIGNER_PROMPT).toMatch(
        /(?:✓[\s\S]{0,80}(?:优先|采用)|(?:优先|采用)[\s\S]{0,80}✓)/,
      );
      expect(DESIGNER_PROMPT).toMatch(
        /(?:✗[\s\S]{0,80}(?:避免|不要)|(?:避免|不要)[\s\S]{0,80}✗)/,
      );
    });

    it("forbids inferring forbidden/used themes from session impression", () => {
      // 没有显式题材段时，不允许"凭历史印象"主动回避或主动复用题材。
      // Order-agnostic on "禁止" + "历史/印象" co-occurrence within a window.
      expect(DESIGNER_PROMPT).toMatch(
        /(?:(?:禁止|不要|绝不)[\s\S]{0,200}(?:历史|印象)|(?:历史|印象)[\s\S]{0,200}(?:禁止|不要|绝不))/,
      );
    });
  });

  describe("VALIDATOR_PROMPT", () => {
    it("treats ✗ logic-pattern hits as a concrete scoring deduction", () => {
      expect(VALIDATOR_PROMPT).toContain("## 跨题组逻辑↔舞台映射偏好");
      // ✗ 命中必须降代码-舞台一致性维度
      expect(VALIDATOR_PROMPT).toMatch(/✗[\s\S]{0,200}(代码-舞台一致性|≤3)/);
    });
  });

  describe("WRITER_PROMPT", () => {
    it("rewrites mapping rows to follow ✓ patterns when provided", () => {
      expect(WRITER_PROMPT).toContain("## 跨题组逻辑↔舞台映射偏好");
      expect(WRITER_PROMPT).toMatch(/✓[\s\S]{0,80}(优先|采用|覆写)/);
    });
  });
});

// ----------------------------------------------------------------------------
// 第六批：题材 × 机制双轴差异化（2026-06-11 反同质化）
// 只约束题材会产生"换皮不换骨"的同质概念——5 个概念题材不同但玩法全是
// "抓取 N 个物品进容器"。机制轴把差异化下探到玩法骨架层，并由服务端
// findDuplicateMechanisms 在 lint+retry 闭环里硬校验。
// ----------------------------------------------------------------------------

describe("prompts: theme × mechanism dual-axis differentiation", () => {
  describe("DESIGNER_PROMPT (generate_concepts)", () => {
    it("requires pairwise-distinct stage mechanisms across the 5 concepts", () => {
      expect(DESIGNER_PROMPT).toContain("舞台机制");
      expect(DESIGNER_PROMPT).toMatch(/舞台机制[\s\S]{0,120}两两不同/);
    });

    it("lists all 8 mechanism candidates aligned with the StageMechanism enum", () => {
      for (const m of [
        "计数收集",
        "信号切换",
        "路径移动",
        "层级升降",
        "开关闸门",
        "分类配对",
        "显示反馈",
        "搭建堆叠",
      ]) {
        expect(DESIGNER_PROMPT).toContain(m);
      }
    });

    it("frames theme as skin and mechanism as skeleton (anti-reskin rule)", () => {
      // "题材是皮，机制是骨"——换皮不换机制属于同质化
      expect(DESIGNER_PROMPT).toMatch(/题材[\s\S]{0,30}皮[\s\S]{0,60}机制[\s\S]{0,30}骨/);
    });

    it("warns that examples are illustrative, not theme recommendations (anti-anchoring)", () => {
      // few-shot 示例锚定效应：必须显式声明示例不是题材推荐
      expect(DESIGNER_PROMPT).toMatch(/不是[\s\S]{0,10}(题材|推荐)|不要把你的 5 个概念都写成示例同款/);
    });

    it("includes good examples from at least two non-collection mechanisms", () => {
      // 好例不能全是"计数收集"——信号切换 / 层级升降至少各有一个
      expect(DESIGNER_PROMPT).toMatch(/好例[\s\S]{0,40}信号切换/);
      expect(DESIGNER_PROMPT).toMatch(/好例[\s\S]{0,40}层级升降/);
    });
  });
});
