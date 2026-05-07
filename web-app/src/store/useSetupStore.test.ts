import { beforeEach, describe, expect, it } from "vitest";
import { useSetupStore } from "./useSetupStore";

describe("useSetupStore", () => {
  beforeEach(() => {
    useSetupStore.setState({
      isCollapsed: false,
      worldDoc: null,
      lessonDoc: null,
      initialPrompt: null,
      planningMode: "standard",
      parsedGroups: [],
      selectedGroupIndex: null,
      shellDoc: null,
    });
  });

  it("toggles collapse state", () => {
    const store = useSetupStore.getState();

    expect(store.isCollapsed).toBe(false);

    store.toggleCollapse();
    expect(useSetupStore.getState().isCollapsed).toBe(true);

    store.toggleCollapse();
    expect(useSetupStore.getState().isCollapsed).toBe(false);
  });

  it("sets world doc", () => {
    const store = useSetupStore.getState();

    store.setWorldDoc({ name: "world.md", content: "世界观内容" });

    const state = useSetupStore.getState();
    expect(state.worldDoc).toMatchObject({
      name: "world.md",
      content: "世界观内容",
    });
    expect(state.lessonDoc).toBeNull();
  });

  it("sets lesson doc", () => {
    const store = useSetupStore.getState();

    store.setLessonDoc({ name: "lesson.md", content: "知识点内容" });

    const state = useSetupStore.getState();
    expect(state.lessonDoc).toMatchObject({
      name: "lesson.md",
      content: "知识点内容",
    });
    expect(state.worldDoc).toBeNull();
  });

  it("clears all docs", () => {
    const store = useSetupStore.getState();

    store.setWorldDoc({ name: "world.md", content: "世界观" });
    store.setLessonDoc({ name: "lesson.md", content: "知识点" });
    store.clearDocs();

    const state = useSetupStore.getState();
    expect(state.worldDoc).toBeNull();
    expect(state.lessonDoc).toBeNull();
  });

  it("sets and clears initial prompt", () => {
    const store = useSetupStore.getState();

    store.setInitialPrompt("请开始策划");
    expect(useSetupStore.getState().initialPrompt).toBe("请开始策划");

    store.clearInitialPrompt();
    expect(useSetupStore.getState().initialPrompt).toBeNull();
  });

  describe("planning mode", () => {
    it("defaults to standard mode", () => {
      expect(useSetupStore.getState().planningMode).toBe("standard");
    });

    it("changes planning mode", () => {
      const store = useSetupStore.getState();
      store.setPlanningMode("single-group");
      expect(useSetupStore.getState().planningMode).toBe("single-group");

      store.setPlanningMode("integration");
      expect(useSetupStore.getState().planningMode).toBe("integration");

      store.setPlanningMode("standard");
      expect(useSetupStore.getState().planningMode).toBe("standard");
    });
  });

  describe("parsed groups", () => {
    it("defaults to empty array", () => {
      expect(useSetupStore.getState().parsedGroups).toEqual([]);
    });

    it("stores parsed groups", () => {
      const store = useSetupStore.getState();
      store.setParsedGroups([
        { index: 1, title: "A", rawSection: "## 题组1：A\n内容" },
        { index: 2, title: "B", rawSection: "## 题组2：B\n内容" },
      ]);
      expect(useSetupStore.getState().parsedGroups).toHaveLength(2);
      expect(useSetupStore.getState().parsedGroups[0]!.title).toBe("A");
    });
  });

  describe("selected group index", () => {
    it("defaults to null", () => {
      expect(useSetupStore.getState().selectedGroupIndex).toBeNull();
    });

    it("sets and clears selected group index", () => {
      const store = useSetupStore.getState();
      store.setSelectedGroupIndex(2);
      expect(useSetupStore.getState().selectedGroupIndex).toBe(2);

      store.setSelectedGroupIndex(null);
      expect(useSetupStore.getState().selectedGroupIndex).toBeNull();
    });
  });

  describe("shell doc", () => {
    it("defaults to null", () => {
      expect(useSetupStore.getState().shellDoc).toBeNull();
    });

    it("sets and clears shell doc", () => {
      const store = useSetupStore.getState();
      store.setShellDoc({ name: "shell.md", content: "壳子方案" });
      expect(useSetupStore.getState().shellDoc).toMatchObject({
        name: "shell.md",
        content: "壳子方案",
      });

      store.setShellDoc(null);
      expect(useSetupStore.getState().shellDoc).toBeNull();
    });
  });

  describe("clearDocs", () => {
    it("clears all three docs and resets group selection", () => {
      const store = useSetupStore.getState();
      store.setWorldDoc({ name: "world.md", content: "世界观" });
      store.setLessonDoc({ name: "lesson.md", content: "知识点" });
      store.setShellDoc({ name: "shell.md", content: "壳子" });
      store.setParsedGroups([
        { index: 1, title: "A", rawSection: "x" },
      ]);
      store.setSelectedGroupIndex(1);

      store.clearDocs();

      const state = useSetupStore.getState();
      expect(state.worldDoc).toBeNull();
      expect(state.lessonDoc).toBeNull();
      expect(state.shellDoc).toBeNull();
      expect(state.parsedGroups).toEqual([]);
      expect(state.selectedGroupIndex).toBeNull();
    });
  });
});
