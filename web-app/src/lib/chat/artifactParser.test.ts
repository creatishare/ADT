import { describe, expect, it } from "vitest";
import { normalizeMarkdown } from "./artifactParser";

describe("normalizeMarkdown — code-fence stripping", () => {
  it("strips a single internal ```markdown fence around a table", () => {
    const input = [
      "## 1. 关卡设计总览表",
      "",
      "```markdown",
      "| 题组 | courseCode | 核心知识点 |",
      "|------|-----------|-----------|",
      "| 题组1 | L16-1-发展-题组1 | for 循环 |",
      "```",
      "",
      "## 2. 单个关卡的详细设计方案",
    ].join("\n");

    const out = normalizeMarkdown(input);
    expect(out).not.toMatch(/```markdown/);
    expect(out).toContain("| 题组 | courseCode | 核心知识点 |");
    expect(out).toContain("## 1. 关卡设计总览表");
    expect(out).toContain("## 2. 单个关卡的详细设计方案");
  });

  it("strips multiple internal ```markdown fences in one document", () => {
    const input = [
      "## A",
      "```markdown",
      "**bold**",
      "```",
      "## B",
      "```md",
      "### inner",
      "```",
      "## C",
    ].join("\n");

    const out = normalizeMarkdown(input);
    expect(out).not.toMatch(/```(?:markdown|md)\b/);
    expect(out).toContain("**bold**");
    expect(out).toContain("### inner");
  });

  it("preserves generic ```bash / ```cpp code blocks (intentional code)", () => {
    const input = [
      "看下面这段代码：",
      "",
      "```bash",
      "dreamina generate --prompt \"...\"",
      "```",
      "",
      "或 C++：",
      "",
      "```cpp",
      "for(int i=0;i<3;i++) {}",
      "```",
    ].join("\n");

    const out = normalizeMarkdown(input);
    expect(out).toContain("```bash");
    expect(out).toContain("```cpp");
    expect(out).toContain("dreamina generate");
    expect(out).toContain("for(int i=0;i<3;i++)");
  });

  it("strips a single outer fence wrapping the entire document (legacy)", () => {
    const input = "```markdown\n# Title\n\nbody\n```";
    const out = normalizeMarkdown(input);
    expect(out.trimEnd()).toBe("# Title\n\nbody");
  });

  it("still normalizes em-dash separator rows after fence stripping", () => {
    const input = [
      "```markdown",
      "| A | B |",
      "|———|———|",
      "| 1 | 2 |",
      "```",
    ].join("\n");

    const out = normalizeMarkdown(input);
    expect(out).not.toMatch(/```/);
    expect(out).toMatch(/\|\s*-+\s*\|\s*-+\s*\|/);
  });
});
