import { beforeEach, describe, expect, it } from "vitest";
import { useArtifactStore } from "./useArtifactStore";

const SID = "session-test";
const OTHER = "session-other";

describe("useArtifactStore (per-session)", () => {
  beforeEach(() => {
    useArtifactStore.setState({
      bySession: {},
      activeArtifactIdBySession: {},
    });
  });

  it("adds an artifact scoped to a session and focuses it", () => {
    useArtifactStore.getState().addArtifact(SID, {
      id: "artifact-1",
      title: "测试文档",
      type: "markdown",
      content: "# hello",
    });

    const state = useArtifactStore.getState();
    const list = state.bySession[SID];

    expect(list).toHaveLength(1);
    expect(state.activeArtifactIdBySession[SID]).toBe("artifact-1");
    expect(list[0]).toMatchObject({
      id: "artifact-1",
      title: "测试文档",
      type: "markdown",
      content: "# hello",
    });
    expect(typeof list[0].timestamp).toBe("number");
  });

  it("isolates artifacts between sessions", () => {
    const store = useArtifactStore.getState();
    store.addArtifact(SID, {
      id: "a",
      title: "A",
      type: "markdown",
      content: "one",
    });
    store.addArtifact(OTHER, {
      id: "b",
      title: "B",
      type: "markdown",
      content: "two",
    });

    const state = useArtifactStore.getState();
    expect(state.bySession[SID]).toHaveLength(1);
    expect(state.bySession[OTHER]).toHaveLength(1);
    expect(state.bySession[SID][0].id).toBe("a");
    expect(state.bySession[OTHER][0].id).toBe("b");
  });

  it("prevents duplicate artifacts with the same id within a session", () => {
    const store = useArtifactStore.getState();
    store.addArtifact(SID, {
      id: "artifact-1",
      title: "第一次",
      type: "markdown",
      content: "A",
    });
    store.addArtifact(SID, {
      id: "artifact-1",
      title: "第二次",
      type: "markdown",
      content: "B",
    });

    const list = useArtifactStore.getState().bySession[SID];
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("第一次");
    expect(list[0].content).toBe("A");
  });

  it("sets active artifact manually per session", () => {
    const store = useArtifactStore.getState();
    store.addArtifact(SID, {
      id: "artifact-1",
      title: "文档 1",
      type: "markdown",
      content: "A",
    });
    store.addArtifact(SID, {
      id: "artifact-2",
      title: "文档 2",
      type: "markdown",
      content: "B",
    });

    store.setActiveArtifact(SID, "artifact-1");
    expect(useArtifactStore.getState().activeArtifactIdBySession[SID]).toBe(
      "artifact-1"
    );
  });

  it("updates artifact content by id within session", () => {
    const store = useArtifactStore.getState();
    store.addArtifact(SID, {
      id: "artifact-1",
      title: "文档 1",
      type: "markdown",
      content: "旧内容",
    });

    store.updateArtifactContent(SID, "artifact-1", "新内容");
    expect(useArtifactStore.getState().bySession[SID][0].content).toBe("新内容");
  });

  it("deletes an artifact and advances active to next within session", () => {
    const store = useArtifactStore.getState();
    store.addArtifact(SID, {
      id: "a1",
      title: "A1",
      type: "markdown",
      content: "1",
    });
    store.addArtifact(SID, {
      id: "a2",
      title: "A2",
      type: "markdown",
      content: "2",
    });
    store.setActiveArtifact(SID, "a1");
    store.deleteArtifact(SID, "a1");

    const state = useArtifactStore.getState();
    expect(state.bySession[SID]).toHaveLength(1);
    expect(state.bySession[SID][0].id).toBe("a2");
    expect(state.activeArtifactIdBySession[SID]).toBe("a2");
  });

  it("clearSessionArtifacts removes only the targeted session", () => {
    const store = useArtifactStore.getState();
    store.addArtifact(SID, {
      id: "a",
      title: "A",
      type: "markdown",
      content: "one",
    });
    store.addArtifact(OTHER, {
      id: "b",
      title: "B",
      type: "markdown",
      content: "two",
    });

    store.clearSessionArtifacts(SID);
    const state = useArtifactStore.getState();
    expect(state.bySession[SID]).toBeUndefined();
    expect(state.bySession[OTHER]).toHaveLength(1);
  });

  it("getSessionArtifacts returns empty for null or unknown", () => {
    const store = useArtifactStore.getState();
    expect(store.getSessionArtifacts(null)).toEqual([]);
    expect(store.getSessionArtifacts("missing")).toEqual([]);
  });
});
