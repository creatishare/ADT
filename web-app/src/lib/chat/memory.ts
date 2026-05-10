import { z } from "zod";

export type RequestMessage = {
  role: "system" | "user" | "assistant";
  parts: Array<{
    type?: string;
    text?: string;
    toolName?: string;
    state?: string;
  }>;
};

export const MAX_RECENT_MESSAGES = 8;
export const MAX_MEMORY_ITEMS = 8;

export const MemorySummarySchema = z.object({
  userConstraints: z.array(z.string()).max(MAX_MEMORY_ITEMS).default([]),
  workflowState: z.array(z.string()).max(MAX_MEMORY_ITEMS).default([]),
  recentTools: z.array(z.string()).max(MAX_MEMORY_ITEMS).default([]),
});

export type MemorySummary = z.infer<typeof MemorySummarySchema>;

export function truncateText(text: string, maxLength = 180) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function getMessageText(message: RequestMessage) {
  return (message.parts ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

export function buildTranscript(messages: RequestMessage[]) {
  return messages
    .map((message) => {
      const text = truncateText(getMessageText(message), 300);
      if (!text) return null;
      return `${message.role === "user" ? "用户" : "助手"}：${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function normalizeMessages(input: unknown): RequestMessage[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const candidate = item as {
      role?: string;
      parts?: Array<{
        type?: string;
        text?: string;
        toolName?: string;
        state?: string;
      }>;
    };

    if (
      candidate.role !== "system" &&
      candidate.role !== "user" &&
      candidate.role !== "assistant"
    ) {
      return [];
    }

    return [
      {
        role: candidate.role,
        parts: Array.isArray(candidate.parts) ? candidate.parts : [],
      },
    ];
  });
}

/**
 * "Head anchor" message-history window.
 *
 * Background (bug 2026-05-09): the original `slice(-MAX_RECENT_MESSAGES)`
 * windowing strategy silently drops the kickoff user message—which contains
 * the full lesson document with all 4 groups' code & knowledge points—once
 * the conversation grows beyond the window. After 3-4 rounds of revisions
 * on group 1, the orchestrator can no longer see groups 3-4's source
 * material and starts asking the user to re-supply it.
 *
 * Strategy: always pin the FIRST user message (kickoff) at index 0 of the
 * outgoing window, and fill the remaining (maxRecent - 1) slots with the
 * most recent messages.
 *
 * Edge cases:
 * - Total length ≤ maxRecent → return a copy unchanged.
 * - No user-role message anywhere → fallback to plain slice(-maxRecent).
 * - Kickoff already in the recent slice → no duplication.
 * - maxRecent = 1 → drop the anchor (it can't fit) and keep the last 1.
 * - maxRecent ≤ 0 → empty.
 *
 * Input is not mutated.
 *
 * Note: only operates on `RequestMessage[]` (UI message shape). It does
 * NOT understand tool-call ↔ tool-result pairing inside the AI SDK's
 * model-message conversion. Since the kickoff message is always pure text
 * (the user's first prompt), prepending it cannot break tool pairing.
 */
/**
 * Generic over message shape: all we need is a `.role` field. Lets the
 * function operate on both `RequestMessage[]` (memory layer) and the raw
 * UIMessage array consumed by `convertToModelMessages` in route.ts.
 */
export function applyHeadAnchorWindow<
  T extends { role: "system" | "user" | "assistant" },
>(messages: readonly T[], maxRecent: number): T[] {
  if (maxRecent <= 0) return [];
  if (messages.length === 0) return [];
  if (messages.length <= maxRecent) return [...messages];

  const recent = messages.slice(-maxRecent);

  // Edge case: when the window is exactly 1, the anchor cannot fit alongside
  // any recent context. Skip the anchor.
  if (maxRecent === 1) return recent;

  // Find the first user-role message (the kickoff).
  const kickoffIdx = messages.findIndex((m) => m.role === "user");
  if (kickoffIdx === -1) {
    // No user message exists — degenerate case; preserve original behavior.
    return recent;
  }

  const kickoff = messages[kickoffIdx]!;

  // If the kickoff is already part of the recent slice, no anchoring needed.
  // We compare by reference (same object identity), which is safe because
  // `slice` reuses element references.
  if (recent.includes(kickoff)) return recent;

  // Anchor: kickoff first, then the most recent (maxRecent - 1) messages.
  return [kickoff, ...messages.slice(-(maxRecent - 1))];
}

export function buildLayeredMemoryContext(memory: MemorySummary) {
  const sections = [
    memory.userConstraints.length
      ? `## User Constraints\n${memory.userConstraints
          .map((line) => `- ${line}`)
          .join("\n")}`
      : null,
    memory.workflowState.length
      ? `## Workflow State\n${memory.workflowState
          .map((line) => `- ${line}`)
          .join("\n")}`
      : null,
    memory.recentTools.length
      ? `## Recent Tools\n${memory.recentTools
          .map((line) => `- ${line}`)
          .join("\n")}`
      : null,
  ].filter(Boolean);

  return sections.length
    ? `# Layered Memory
以下内容由 AI 从完整历史中提炼，请优先遵守用户约束，并严格依据流程状态继续推进。

${sections.join("\n\n")}`
    : "";
}