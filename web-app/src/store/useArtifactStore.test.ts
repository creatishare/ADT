
import { beforeEach, describe, expect, it } from "vitest";
import { useArtifactStore } from "./useArtifactStore";

describe("useArtifactStore", () => {
  beforeEach(() => {
    useArtifactStore.setState({
      artifacts: [],
      activeArtifactId: null,
    });
  });

  it("adds an artifact and focuses it", () => {
    useArtifactStore.getState().addArtifact({
      id: "artifact-1",
      title: "测试文档",
      type: "markdown",
      content: "# hello",
    });

    const state = useArtifactStore.getState();

    expect(state.artifacts).toHaveLength(1);
    expect(state.activeArtifactId).toBe("artifact-1");
    expect(state.artifacts[0]).toMatchObject({
      id: "artifact-1",
      title: "测试文档",
      type: "markdown",
      content: "# hello",
    });
    expect(typeof state.artifacts[0].timestamp).toBe("number");
  });

  it("prevents duplicate artifacts with the same id", () => {
    const store = useArtifactStore.getState();

    store.addArtifact({
      id: "artifact-1",
      title: "第一次",
      type: "markdown",
      content: "A",
    });

    store.addArtifact({
      id: "artifact-1",
      title: "第二次",
      type: "markdown",
      content: "B",
    });

    const state = useArtifactStore.getState();

    expect(state.artifacts).toHaveLength(1);
    expect(state.artifacts[0].title).toBe("第一次");
    expect(state.artifacts[0].content).toBe("A");
  });

  it("sets active artifact manually", () => {
    const store = useArtifactStore.getState();

    store.addArtifact({
      id: "artifact-1",
      title: "文档 1",
      type: "markdown",
      content: "A",
    });

    store.addArtifact({
      id: "artifact-2",
      title: "文档 2",
      type: "markdown",
      content: "B",
    });

    store.setActiveArtifact("artifact-1");

    expect(useArtifactStore.getState().activeArtifactId).toBe("artifact-1");
  });

  it("updates artifact content by id", () => {
    const store = useArtifactStore.getState();

    store.addArtifact({
      id: "artifact-1",
      title: "文档 1",
      type: "markdown",
      content: "旧内容",
    });

    store.updateArtifactContent("artifact-1", "新内容");

    expect(useArtifactStore.getState().artifacts[0].content).toBe("新内容");
  });
});