import { beforeEach, describe, expect, it } from "vitest";
import { useSetupStore } from "./useSetupStore";

describe("useSetupStore", () => {
  beforeEach(() => {
    useSetupStore.setState({
      isCollapsed: false,
      worldDoc: null,
      lessonDoc: null,
      initialPrompt: null,
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
});
