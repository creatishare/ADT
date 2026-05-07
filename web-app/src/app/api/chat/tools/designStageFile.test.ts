import { describe, expect, it } from "vitest";
import { designStageFileInputSchema } from "./designStageFile";

const baseInput = {
  topicInfo: "题组 1：for 循环",
  worldview: "宇宙基地",
};

describe("designStageFile inputSchema", () => {
  it("accepts the original 'generate_concepts' mode", () => {
    const r = designStageFileInputSchema.safeParse({
      ...baseInput,
      mode: "generate_concepts",
    });
    expect(r.success).toBe(true);
  });

  it("accepts the original 'integrate_document' mode", () => {
    const r = designStageFileInputSchema.safeParse({
      ...baseInput,
      mode: "integrate_document",
      selectedConcepts: "选中的 4 个概念",
    });
    expect(r.success).toBe(true);
  });

  it("accepts the new 'adapt_concepts' mode", () => {
    const r = designStageFileInputSchema.safeParse({
      ...baseInput,
      mode: "adapt_concepts",
      selectedConcepts: "用户上传的壳子方案文档全文",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown mode value", () => {
    const r = designStageFileInputSchema.safeParse({
      ...baseInput,
      mode: "totally-made-up",
    });
    expect(r.success).toBe(false);
  });

  it("requires topicInfo and worldview", () => {
    const missingTopic = designStageFileInputSchema.safeParse({
      worldview: "x",
      mode: "generate_concepts",
    });
    expect(missingTopic.success).toBe(false);

    const missingWorld = designStageFileInputSchema.safeParse({
      topicInfo: "x",
      mode: "generate_concepts",
    });
    expect(missingWorld.success).toBe(false);
  });

  it("allows optional userGuidance and courseCode", () => {
    const r = designStageFileInputSchema.safeParse({
      ...baseInput,
      mode: "adapt_concepts",
      selectedConcepts: "壳子",
      userGuidance: "[mode:integration] 保持玩法本质",
      courseCode: "L3-1-高-题组1",
    });
    expect(r.success).toBe(true);
  });
});
