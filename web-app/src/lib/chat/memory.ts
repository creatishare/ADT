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