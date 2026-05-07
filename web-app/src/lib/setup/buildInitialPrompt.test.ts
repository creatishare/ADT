import { describe, expect, it } from "vitest";
import { buildInitialPrompt } from "./buildInitialPrompt";
import type { ParsedGroup } from "./parseLessonGroups";

const worldDoc = { name: "world.md", content: "世界观正文" };
const lessonDoc = {
  name: "lesson.md",
  content: `## 题组1：A
A 内容

## 题组2：B
B 内容
`,
};
const parsedGroups: ParsedGroup[] = [
  { index: 1, title: "A", rawSection: "## 题组1：A\nA 内容\n" },
  { index: 2, title: "B", rawSection: "## 题组2：B\nB 内容\n" },
];

describe("buildInitialPrompt", () => {
  describe("standard mode", () => {
    it("includes both docs and instructs the 7-step workflow", () => {
      const prompt = buildInitialPrompt({
        mode: "standard",
        worldDoc,
        lessonDoc,
        parsedGroups,
      });
      expect(prompt).toContain(worldDoc.name);
      expect(prompt).toContain(worldDoc.content);
      expect(prompt).toContain(lessonDoc.name);
      expect(prompt).toContain(lessonDoc.content);
      expect(prompt).toContain("7步法");
      expect(prompt).not.toContain("仅策划");
      expect(prompt).not.toContain("adapt_concepts");
    });
  });

  describe("single-group mode", () => {
    it("highlights the selected group and tells orchestrator to skip looping", () => {
      const prompt = buildInitialPrompt({
        mode: "single-group",
        worldDoc,
        lessonDoc,
        parsedGroups,
        selectedGroupIndex: 2,
      });
      expect(prompt).toContain(worldDoc.content);
      expect(prompt).toContain(lessonDoc.content);
      expect(prompt).toContain("题组 2");
      expect(prompt).toContain("B");
      // raw section of selected group should be included as a dedicated block
      expect(prompt).toContain("目标题组");
      expect(prompt).toContain("仅策划");
      // must instruct to skip storyline-bridge segments
      expect(prompt).toContain("剧情衔接");
      // must pass mode tag for downstream tools
      expect(prompt).toContain("[mode:single-group]");
    });

    it("instructs orchestrator to skip validateStageFile and integrate_document", () => {
      const prompt = buildInitialPrompt({
        mode: "single-group",
        worldDoc,
        lessonDoc,
        parsedGroups,
        selectedGroupIndex: 2,
      });
      // 必须明确不调验证、不走 integrate_document
      expect(prompt).toMatch(/(?:不要|跳过|不调用)[\s\S]{0,80}validateStageFile/);
      expect(prompt).toMatch(/(?:不要|跳过|不调用)[\s\S]{0,80}integrate_document/);
      // 直接进 writeStageFile
      expect(prompt).toMatch(/(?:满意|确认)[\s\S]{0,200}writeStageFile/);
    });

    it("falls back gracefully when selectedGroupIndex is unset", () => {
      const prompt = buildInitialPrompt({
        mode: "single-group",
        worldDoc,
        lessonDoc,
        parsedGroups,
        selectedGroupIndex: null,
      });
      // still asks user to specify which group
      expect(prompt).toContain("仅策划");
      expect(prompt).toContain("[mode:single-group]");
    });
  });

  describe("integration mode", () => {
    const shellDoc = {
      name: "shell.md",
      content: "## 题组1壳子\n用户已经想好的玩法包装。",
    };

    it("embeds shell doc and instructs adapt_concepts mode", () => {
      const prompt = buildInitialPrompt({
        mode: "integration",
        worldDoc,
        lessonDoc,
        parsedGroups,
        shellDoc,
      });
      expect(prompt).toContain(worldDoc.content);
      expect(prompt).toContain(lessonDoc.content);
      expect(prompt).toContain(shellDoc.content);
      expect(prompt).toContain("壳子");
      expect(prompt).toContain("adapt_concepts");
      // must instruct to preserve gameplay essence
      expect(prompt).toContain("玩法本质");
      // must pass mode tag for downstream tools
      expect(prompt).toContain("[mode:integration]");
      // must instruct to skip 5-concept generation
      expect(prompt).toMatch(/跳过.*概念/);
    });
  });

  it("throws when integration mode is missing shellDoc", () => {
    expect(() =>
      buildInitialPrompt({
        mode: "integration",
        worldDoc,
        lessonDoc,
        parsedGroups,
      })
    ).toThrow();
  });
});
