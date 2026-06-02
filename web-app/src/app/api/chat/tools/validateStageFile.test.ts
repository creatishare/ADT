import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { tolerantText } from "./inputSchema";

const runSubAgentText = vi.fn();

vi.mock("./shared", async () => {
  const actual = await vi.importActual<typeof import("./shared")>("./shared");
  return {
    ...actual,
    runSubAgentText: (...args: unknown[]) => runSubAgentText(...args),
  };
});

vi.mock("@/lib/agents/prompts", () => ({
  VALIDATOR_PROMPT: "VALIDATOR",
  WRITER_PROMPT: "WRITER",
}));

// Imported after mocks so the tools pick up the mocked deps.
import { createValidateStageFileTool } from "./validateStageFile";
import { createWriteStageFileTool } from "./writeStageFile";

type ExecutableTool = {
  execute: (input: Record<string, unknown>) => Promise<{ content: string }>;
};

const fakeModel = {} as never;

/** Read the `prompt` field of the first runSubAgentText call (typed, non-null). */
function firstPrompt(): string {
  const call = runSubAgentText.mock.calls[0];
  return (call?.[0] as { prompt: string }).prompt;
}

beforeEach(() => {
  runSubAgentText.mockReset();
  runSubAgentText.mockResolvedValue("OK报告");
});

describe("tolerantText schema", () => {
  const schema = z.object({ field: tolerantText("desc") });

  it("passes strings through", () => {
    const r = schema.safeParse({ field: "hello" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.field).toBe("hello");
  });

  it("treats a missing field as undefined instead of failing", () => {
    const r = schema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.field).toBeUndefined();
  });

  it("coerces numbers and booleans to strings", () => {
    expect(schema.safeParse({ field: 42 }).success).toBe(true);
    expect(schema.safeParse({ field: true }).success).toBe(true);
  });

  it("does NOT throw on null / object / array (collapses to undefined)", () => {
    for (const bad of [null, { a: 1 }, [1, 2, 3]]) {
      const r = schema.safeParse({ field: bad });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.field).toBeUndefined();
    }
  });
});

describe("validateStageFile execute", () => {
  it("throws a retry-able [missing_document] error when documentContent is absent", async () => {
    const tool = createValidateStageFileTool(fakeModel, "deepseek-v4-flash") as unknown as ExecutableTool;
    await expect(
      tool.execute({ worldview: "w", topicInfo: "t" })
    ).rejects.toThrow(/\[missing_document\]/);
    expect(runSubAgentText).not.toHaveBeenCalled();
  });

  it("builds a prompt with the document and runs the sub-agent on valid input", async () => {
    const tool = createValidateStageFileTool(fakeModel, "deepseek-v4-flash") as unknown as ExecutableTool;
    const out = await tool.execute({
      documentContent: "策划文档正文",
      worldview: "太空世界观",
      topicInfo: "for 循环",
    });
    expect(out.content).toBe("OK报告");
    expect(runSubAgentText).toHaveBeenCalledTimes(1);
    const prompt = firstPrompt();
    expect(prompt).toContain("策划文档正文");
    expect(prompt).toContain("太空世界观");
    expect(prompt).toContain("for 循环");
  });

  it("falls back to head-anchor source material when worldview AND topicInfo are missing", async () => {
    const tool = createValidateStageFileTool(
      fakeModel,
      "deepseek-v4-flash",
      "",
      "头锚源材料：完整知识点文档"
    ) as unknown as ExecutableTool;
    await tool.execute({ documentContent: "待审文档" });
    const prompt = firstPrompt();
    expect(prompt).toContain("自会话头锚回填");
    expect(prompt).toContain("头锚源材料：完整知识点文档");
  });
});

describe("writeStageFile execute", () => {
  it("throws [missing_document] when validatedDocument is absent", async () => {
    const tool = createWriteStageFileTool(fakeModel, "deepseek-v4-flash") as unknown as ExecutableTool;
    await expect(tool.execute({ worldview: "w" })).rejects.toThrow(
      /\[missing_document\]/
    );
    expect(runSubAgentText).not.toHaveBeenCalled();
  });

  it("uses head-anchor source material as worldview fallback", async () => {
    const tool = createWriteStageFileTool(
      fakeModel,
      "deepseek-v4-flash",
      "",
      "头锚世界观回填"
    ) as unknown as ExecutableTool;
    await tool.execute({ validatedDocument: "定稿文档" });
    const prompt = firstPrompt();
    expect(prompt).toContain("定稿文档");
    expect(prompt).toContain("头锚世界观回填");
  });
});
