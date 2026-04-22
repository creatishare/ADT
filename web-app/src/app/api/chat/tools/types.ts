export type ArtifactPayload = {
  title: string;
  type: "markdown" | "image" | "code";
  content: string;
  courseCode?: string;
};

export type ToolOutput = {
  content: string;
  artifact: ArtifactPayload;
};
