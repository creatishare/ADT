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

    it("forbids storyline bridge segments in single-group mode", () => {
      // 这一节文案必须明确告知 single-group 模式跳过剧情衔接
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toMatch(
        /single-group[\s\S]*?剧情衔接|剧情衔接[\s\S]*?single-group/,
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
