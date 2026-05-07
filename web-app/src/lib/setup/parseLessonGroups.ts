/**
 * 课节文档题组解析层。
 *
 * 业务背景：单题组模式与整合模式都需要从用户上传的 Markdown 文档中提取
 * "题组"列表（标题 + 编号 + 原文片段）。本模块提供纯正则实现，零依赖。
 */

export interface ParsedGroup {
  /** 阿拉伯数字形式的题组编号（中文数字也会被转为阿拉伯数字）。 */
  index: number;
  /** 题组小节标题（去掉"题组N"前缀后的剩余部分，可能为空字符串）。 */
  title: string;
  /** 该题组的原文片段（含标题行，到下一题组标题前为止）。 */
  rawSection: string;
}

/** 中文数字 → 阿拉伯数字（仅支持 1-10，足够覆盖一节课的题组数）。 */
const CHINESE_NUMERAL_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

/**
 * 命中"题组"标题的正则。
 *
 * - `^#{1,4}` 一到四级 markdown 标题
 * - 支持阿拉伯数字与单字符中文数字
 * - 标题与编号之间可有可无的分隔符（: ：· -）
 */
const GROUP_HEADING_RE =
  /^(#{1,4})\s*题组\s*(\d+|[一二三四五六七八九十])\s*[:：·\-]?\s*(.*)$/;

/**
 * 移除 markdown 围栏代码块（```...```），避免代码块里的"## 题组99"被误判。
 * 用占位符替换以保留行号一致性，便于上层调试时对照原文。
 */
function stripFencedCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, (match) => {
    // 用同样多的换行符替换，保持行号映射稳定
    return match.replace(/[^\n]/g, " ");
  });
}

interface HeadingMatch {
  lineIndex: number;
  index: number;
  title: string;
}

function parseHeadingLine(line: string): Omit<HeadingMatch, "lineIndex"> | null {
  const m = line.match(GROUP_HEADING_RE);
  if (!m) return null;
  const numToken = m[2];
  const titleToken = m[3];
  if (numToken == null || titleToken == null) return null;
  const arabic = /^\d+$/.test(numToken)
    ? Number.parseInt(numToken, 10)
    : (CHINESE_NUMERAL_MAP[numToken] ?? 0);
  if (arabic <= 0) return null;
  return { index: arabic, title: titleToken.trim() };
}

function findHeadings(stripped: string): HeadingMatch[] {
  const matches: HeadingMatch[] = [];
  stripped.split("\n").forEach((line, lineIndex) => {
    const parsed = parseHeadingLine(line);
    if (parsed) {
      matches.push({ lineIndex, ...parsed });
    }
  });
  return matches;
}

export function parseLessonGroups(content: string): ParsedGroup[] {
  if (!content) return [];
  const stripped = stripFencedCodeBlocks(content);
  const headings = findHeadings(stripped);
  if (headings.length === 0) return [];

  const originalLines = content.split("\n");
  return headings.map((heading, i) => {
    const next = headings[i + 1];
    const end = next ? next.lineIndex : originalLines.length;
    const rawSection = originalLines.slice(heading.lineIndex, end).join("\n");
    return {
      index: heading.index,
      title: heading.title,
      rawSection,
    };
  });
}
