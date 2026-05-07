import { describe, expect, it } from "vitest";
import { parseLessonGroups } from "./parseLessonGroups";

describe("parseLessonGroups", () => {
  it("returns an empty array for empty content", () => {
    expect(parseLessonGroups("")).toEqual([]);
  });

  it("returns an empty array when no group headings exist", () => {
    const md = "# 这是一个普通文档\n\n没有题组小节。";
    expect(parseLessonGroups(md)).toEqual([]);
  });

  it("parses a single arabic-numbered group with H2 heading", () => {
    const md = `# 课节标题

## 题组1：循环入门
这里是题组 1 的内容。
有两行说明。
`;
    const groups = parseLessonGroups(md);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.index).toBe(1);
    expect(groups[0]!.title).toBe("循环入门");
    expect(groups[0]!.rawSection).toContain("题组 1 的内容");
    // raw section should contain the heading line itself
    expect(groups[0]!.rawSection).toContain("题组1");
  });

  it("parses multiple groups with mixed punctuation between number and title", () => {
    const md = `# 课节

## 题组 1 · 顺序结构
A 的内容

### 题组2: 分支
B 的内容

## 题组3 - 循环
C 的内容
`;
    const groups = parseLessonGroups(md);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.index)).toEqual([1, 2, 3]);
    expect(groups[0]!.title).toBe("顺序结构");
    expect(groups[1]!.title).toBe("分支");
    expect(groups[2]!.title).toBe("循环");
  });

  it("supports chinese numerals", () => {
    const md = `## 题组一：起步
内容一

## 题组二·进阶
内容二
`;
    const groups = parseLessonGroups(md);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.index).toBe(1);
    expect(groups[1]!.index).toBe(2);
    expect(groups[0]!.title).toBe("起步");
    expect(groups[1]!.title).toBe("进阶");
  });

  it("ignores group-like text inside fenced code blocks", () => {
    const md = `## 题组1：第一题
\`\`\`cpp
// ## 题组99：这是一个注释，不应被解析
int x = 0;
\`\`\`
真正的内容。

## 题组2：第二题
内容。
`;
    const groups = parseLessonGroups(md);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.index)).toEqual([1, 2]);
  });

  it("captures all content up to the next group heading as rawSection", () => {
    const md = `## 题组1：A
A 的第一行
A 的第二行

## 题组2：B
B 的内容
`;
    const groups = parseLessonGroups(md);
    expect(groups[0]!.rawSection).toContain("A 的第一行");
    expect(groups[0]!.rawSection).toContain("A 的第二行");
    expect(groups[0]!.rawSection).not.toContain("B 的内容");
    expect(groups[1]!.rawSection).toContain("B 的内容");
  });

  it("handles the last group section running to end of document", () => {
    const md = `## 题组1：唯一
唯一题组的全部内容
最后一行
`;
    const groups = parseLessonGroups(md);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.rawSection).toContain("最后一行");
  });

  it("returns empty array when title is missing entirely", () => {
    const md = `这是一段没有任何 markdown 标题的纯文本。`;
    expect(parseLessonGroups(md)).toEqual([]);
  });

  it("falls back to empty title when heading has only the number", () => {
    const md = `## 题组1
内容。
`;
    const groups = parseLessonGroups(md);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.title).toBe("");
  });
});
