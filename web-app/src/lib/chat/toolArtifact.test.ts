import { describe, expect, it } from "vitest";
import { getToolArtifact } from "./toolArtifact";

describe("getToolArtifact", () => {
  it("returns artifact when result shape is valid", () => {
    const result = getToolArtifact({
      artifact: {
        title: "验证报告",
        type: "markdown",
        content: "# report",
      },
    });

    expect(result).toEqual({
      title: "验证报告",
      type: "markdown",
      content: "# report",
    });
  });

  it("returns null when artifact field is missing", () => {
    expect(getToolArtifact({ content: "hello" })).toBeNull();
  });

  it("returns null when artifact type is invalid", () => {
    expect(
      getToolArtifact({
        artifact: {
          title: "错误数据",
          type: "pdf",
          content: "xxx",
        },
      })
    ).toBeNull();
  });

  it("returns null when title or content is not a string", () => {
    expect(
      getToolArtifact({
        artifact: {
          title: 123,
          type: "markdown",
          content: "# report",
        },
      })
    ).toBeNull();

    expect(
      getToolArtifact({
        artifact: {
          title: "验证报告",
          type: "markdown",
          content: null,
        },
      })
    ).toBeNull();
  });
});