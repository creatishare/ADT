import { beforeEach, describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { useConversationStore } from "./useConversationStore";

function textMessage(role: UIMessage["role"], id: string, text: string): UIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  } as UIMessage;
}

describe("useConversationStore", () => {
  beforeEach(() => {
    useConversationStore.setState({
      sessions: {},
      orderedIds: [],
      activeSessionId: null,
    });
  });

  it("creates a session and activates it", () => {
    const id = useConversationStore.getState().createSession();
    const state = useConversationStore.getState();

    expect(state.activeSessionId).toBe(id);
    expect(state.orderedIds[0]).toBe(id);
    expect(state.sessions[id]).toBeDefined();
    expect(state.sessions[id]!.messages).toEqual([]);
  });

  it("stores docsSnapshot on creation", () => {
    const id = useConversationStore.getState().createSession({
      docsSnapshot: {
        worldDocName: "world.md",
        lessonDocName: "lesson.md",
      },
    });
    const s = useConversationStore.getState().sessions[id];
    expect(s!.docsSnapshot).toEqual({
      worldDocName: "world.md",
      lessonDocName: "lesson.md",
    });
  });

  it("switches active session", () => {
    const a = useConversationStore.getState().createSession();
    const b = useConversationStore.getState().createSession();
    useConversationStore.getState().switchSession(a);
    expect(useConversationStore.getState().activeSessionId).toBe(a);

    useConversationStore.getState().switchSession("nonexistent");
    expect(useConversationStore.getState().activeSessionId).toBe(a);

    useConversationStore.getState().switchSession(b);
    expect(useConversationStore.getState().activeSessionId).toBe(b);
  });

  it("deletes a session and falls back to the next one", () => {
    const a = useConversationStore.getState().createSession();
    const b = useConversationStore.getState().createSession();
    useConversationStore.getState().switchSession(a);
    useConversationStore.getState().deleteSession(a);

    const state = useConversationStore.getState();
    expect(state.sessions[a]).toBeUndefined();
    expect(state.orderedIds).not.toContain(a);
    expect(state.activeSessionId).toBe(b);
  });

  it("renames a session", () => {
    const id = useConversationStore.getState().createSession();
    useConversationStore.getState().renameSession(id, "  我的策划  ");
    expect(useConversationStore.getState().sessions[id]!.name).toBe("我的策划");
  });

  it("ignores empty rename", () => {
    const id = useConversationStore.getState().createSession();
    const before = useConversationStore.getState().sessions[id]!.name;
    useConversationStore.getState().renameSession(id, "   ");
    expect(useConversationStore.getState().sessions[id]!.name).toBe(before);
  });

  it("setMessages auto-derives name from first user message", () => {
    const id = useConversationStore.getState().createSession();
    const msgs = [textMessage("user", "m1", "请设计一个关于循环的关卡")];
    useConversationStore.getState().setMessages(id, msgs);
    const name = useConversationStore.getState().sessions[id]!.name;
    expect(name).toBe("请设计一个关于循环的关卡");
  });

  it("setMessages promotes session to head of orderedIds", () => {
    const a = useConversationStore.getState().createSession();
    const b = useConversationStore.getState().createSession();
    expect(useConversationStore.getState().orderedIds[0]).toBe(b);

    useConversationStore
      .getState()
      .setMessages(a, [textMessage("user", "m", "hi")]);
    expect(useConversationStore.getState().orderedIds[0]).toBe(a);
  });

  it("trims messages when session exceeds the byte cap", () => {
    const id = useConversationStore.getState().createSession();
    const big = "x".repeat(200 * 1024);
    const msgs: UIMessage[] = Array.from({ length: 30 }, (_, i) =>
      textMessage(i % 2 === 0 ? "user" : "assistant", `m-${i}`, big)
    );

    useConversationStore.getState().setMessages(id, msgs);
    const stored = useConversationStore.getState().sessions[id]!.messages;
    expect(stored.length).toBeLessThan(msgs.length);
    expect(stored[stored.length - 1]!.id).toBe("m-29");
  });

  it("prunes oldest sessions when exceeding MAX_SESSIONS", () => {
    const ids: string[] = [];
    for (let i = 0; i < 52; i++) {
      ids.push(useConversationStore.getState().createSession());
    }
    const state = useConversationStore.getState();
    expect(state.orderedIds.length).toBeLessThanOrEqual(50);
    expect(state.sessions[state.activeSessionId!]).toBeDefined();
  });

  it("getActiveMessages returns [] when no active session", () => {
    expect(useConversationStore.getState().getActiveMessages()).toEqual([]);
  });

  describe("setMessages id deduplication", () => {
    it("removes duplicate-id messages (keeping the last occurrence) before persisting", () => {
      const id = useConversationStore.getState().createSession();
      const msgs: UIMessage[] = [
        textMessage("user", "dup-1", "first version"),
        textMessage("assistant", "uniq-1", "ack"),
        textMessage("user", "dup-1", "second version (later, kept)"),
        textMessage("assistant", "uniq-2", "more"),
      ];

      useConversationStore.getState().setMessages(id, msgs);

      const stored = useConversationStore.getState().sessions[id]!.messages;
      expect(stored.length).toBe(3);
      // The duplicate id "dup-1" should appear only once
      const dupCount = stored.filter((m) => m.id === "dup-1").length;
      expect(dupCount).toBe(1);
      // And the kept occurrence should be the LATER one (newest content)
      const dup = stored.find((m) => m.id === "dup-1")!;
      const dupText = dup.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
      expect(dupText).toContain("second version");
      // Relative order of remaining messages must be preserved
      expect(stored.map((m) => m.id)).toEqual(["uniq-1", "dup-1", "uniq-2"]);
    });

    it("is a no-op when all message ids are unique", () => {
      const id = useConversationStore.getState().createSession();
      const msgs: UIMessage[] = [
        textMessage("user", "a", "x"),
        textMessage("assistant", "b", "y"),
        textMessage("user", "c", "z"),
      ];
      useConversationStore.getState().setMessages(id, msgs);
      const stored = useConversationStore.getState().sessions[id]!.messages;
      expect(stored.map((m) => m.id)).toEqual(["a", "b", "c"]);
    });
  });
});
