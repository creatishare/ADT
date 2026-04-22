export type ToolArtifact = {
  title: string;
  type: "markdown" | "image" | "code";
  content: string;
  courseCode?: string;
};

function isToolArtifact(value: unknown): value is ToolArtifact {
  if (!value || typeof value !== "object") return false;

  const artifact = value as Record<string, unknown>;

  return (
    typeof artifact.title === "string" &&
    typeof artifact.content === "string" &&
    (artifact.type === "markdown" ||
      artifact.type === "image" ||
      artifact.type === "code")
  );
}

export function getToolArtifact(result: unknown): ToolArtifact | null {
  if (!result || typeof result !== "object" || !("artifact" in result)) {
    return null;
  }

  const artifact = (result as { artifact?: unknown }).artifact;

  if (!isToolArtifact(artifact)) {
    return null;
  }

  return artifact;
}