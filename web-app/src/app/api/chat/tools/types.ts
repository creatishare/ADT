export type ArtifactPayload = {
  title: string;
  type: "markdown" | "image" | "code";
  content: string;
};

export type ToolOutput = {
  content: string;
  artifact: ArtifactPayload;
};
