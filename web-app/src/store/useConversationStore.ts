import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UIMessage } from "ai";

const STORAGE_KEY = "agent-designer-conversations";
const STORE_VERSION = 1;
const MAX_SESSIONS = 50;
const MAX_BYTES_PER_SESSION = 2 * 1024 * 1024;
const TRIM_STEP = 5;
const FALLBACK_KEEP_LAST = 10;

export interface DocsSnapshot {
  worldDocName?: string;
  lessonDocName?: string;
}

export interface ConversationSession {
  id: string;
  name: string;
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
  docsSnapshot?: DocsSnapshot;
}

interface ConversationStore {
  sessions: Record<string, ConversationSession>;
  orderedIds: string[];
  activeSessionId: string | null;
  createSession: (opts?: { docsSnapshot?: DocsSnapshot; name?: string }) => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  setMessages: (id: string, messages: UIMessage[]) => void;
  getActiveMessages: () => UIMessage[];
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultSessionName(createdAt: number): string {
  const d = new Date(createdAt);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `新策划 ${mm}-${dd} ${hh}:${mi}`;
}

function deriveNameFromMessages(messages: UIMessage[]): string | null {
  for (const m of messages) {
    if (m.role !== "user") continue;
    const text = m.parts
      .filter((p): p is Extract<UIMessage["parts"][number], { type: "text" }> =>
        p.type === "text"
      )
      .map((p) => p.text)
      .join(" ")
      .trim();
    if (!text) continue;
    const firstLine = text.split("\n")[0].trim();
    return firstLine.slice(0, 30);
  }
  return null;
}

function estimateBytes(messages: UIMessage[]): number {
  try {
    return JSON.stringify(messages).length;
  } catch {
    return 0;
  }
}

function trimMessages(messages: UIMessage[]): UIMessage[] {
  if (messages.length === 0) return messages;
  let current = messages;
  while (current.length > FALLBACK_KEEP_LAST && estimateBytes(current) > MAX_BYTES_PER_SESSION) {
    current = current.slice(TRIM_STEP);
  }
  if (estimateBytes(current) > MAX_BYTES_PER_SESSION) {
    return current.slice(-FALLBACK_KEEP_LAST);
  }
  return current;
}

function pruneOldSessions(
  sessions: Record<string, ConversationSession>,
  orderedIds: string[],
  activeSessionId: string | null
): { sessions: Record<string, ConversationSession>; orderedIds: string[] } {
  if (orderedIds.length <= MAX_SESSIONS) {
    return { sessions, orderedIds };
  }
  const keepIds = new Set<string>();
  if (activeSessionId && sessions[activeSessionId]) keepIds.add(activeSessionId);
  const remaining = [...orderedIds].sort((a, b) => {
    const sa = sessions[a]?.updatedAt ?? 0;
    const sb = sessions[b]?.updatedAt ?? 0;
    return sb - sa;
  });
  for (const id of remaining) {
    if (keepIds.size >= MAX_SESSIONS) break;
    keepIds.add(id);
  }
  const nextSessions: Record<string, ConversationSession> = {};
  const nextOrdered: string[] = [];
  for (const id of orderedIds) {
    if (keepIds.has(id) && sessions[id]) {
      nextSessions[id] = sessions[id];
      nextOrdered.push(id);
    }
  }
  return { sessions: nextSessions, orderedIds: nextOrdered };
}

function isStreamingToolPart(part: UIMessage["parts"][number]): boolean {
  const p = part as { type?: string; state?: string };
  if (!p.type) return false;
  const isTool = p.type === "dynamic-tool" || p.type.startsWith("tool-");
  if (!isTool) return false;
  const state = p.state;
  return state !== "output-available" && state !== "output-error";
}

function dropZombieMessages(messages: UIMessage[]): UIMessage[] {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  if (last.role !== "assistant") return messages;
  const hasStuckTool = last.parts.some(isStreamingToolPart);
  if (hasStuckTool) {
    return messages.slice(0, -1);
  }
  return messages;
}

export const useConversationStore = create<ConversationStore>()(
  persist(
    (set, get) => ({
      sessions: {},
      orderedIds: [],
      activeSessionId: null,

      createSession: (opts) => {
        const id = generateId();
        const now = Date.now();
        const session: ConversationSession = {
          id,
          name: opts?.name ?? defaultSessionName(now),
          messages: [],
          createdAt: now,
          updatedAt: now,
          docsSnapshot: opts?.docsSnapshot,
        };
        set((state) => {
          const nextSessions = { ...state.sessions, [id]: session };
          const nextOrdered = [id, ...state.orderedIds.filter((x) => x !== id)];
          const pruned = pruneOldSessions(nextSessions, nextOrdered, id);
          return {
            sessions: pruned.sessions,
            orderedIds: pruned.orderedIds,
            activeSessionId: id,
          };
        });
        return id;
      },

      switchSession: (id) => {
        const { sessions } = get();
        if (!sessions[id]) return;
        set({ activeSessionId: id });
      },

      deleteSession: (id) => {
        set((state) => {
          if (!state.sessions[id]) return state;
          const nextSessions = { ...state.sessions };
          delete nextSessions[id];
          const nextOrdered = state.orderedIds.filter((x) => x !== id);
          const nextActive =
            state.activeSessionId === id
              ? nextOrdered[0] ?? null
              : state.activeSessionId;
          return {
            sessions: nextSessions,
            orderedIds: nextOrdered,
            activeSessionId: nextActive,
          };
        });
      },

      renameSession: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          return {
            sessions: {
              ...state.sessions,
              [id]: { ...session, name: trimmed.slice(0, 80), updatedAt: Date.now() },
            },
          };
        });
      },

      setMessages: (id, messages) => {
        set((state) => {
          const session = state.sessions[id];
          if (!session) return state;
          const trimmed = trimMessages(messages);
          const autoName =
            session.name.startsWith("新策划 ") && messages.length > 0
              ? deriveNameFromMessages(messages) ?? session.name
              : session.name;
          const nextSession: ConversationSession = {
            ...session,
            messages: trimmed,
            name: autoName,
            updatedAt: Date.now(),
          };
          const nextOrdered = [id, ...state.orderedIds.filter((x) => x !== id)];
          return {
            sessions: { ...state.sessions, [id]: nextSession },
            orderedIds: nextOrdered,
          };
        });
      },

      getActiveMessages: () => {
        const { sessions, activeSessionId } = get();
        if (!activeSessionId) return [];
        return sessions[activeSessionId]?.messages ?? [];
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const active = state.activeSessionId;
        if (!active) return;
        const session = state.sessions[active];
        if (!session) return;
        const cleaned = dropZombieMessages(session.messages);
        if (cleaned !== session.messages) {
          state.sessions = {
            ...state.sessions,
            [active]: { ...session, messages: cleaned },
          };
        }
      },
    }
  )
);
