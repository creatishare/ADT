"use client";

import { useMemo } from "react";
import { useArtifactStore, type Artifact } from "@/store/useArtifactStore";
import { useConversationStore } from "@/store/useConversationStore";
import { cn } from "@/lib/utils";

const EMPTY_ARTIFACTS: readonly Artifact[] = Object.freeze([]);
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Image as ImageIcon, Code2, FolderOpen } from "lucide-react";
import {
  formatTimestamp,
  getArtifactCategory,
  getArtifactStatus,
  getArtifactTypeLabel,
  getParsedContent,
  normalizeMarkdown,
  parsePromptArtifact,
  parseValidationReport,
} from "@/lib/chat/artifactParser";
import { ArtifactHeader } from "./ArtifactHeader";
import { ConceptArtifact } from "./ConceptArtifact";
import { PromptArtifact } from "./PromptArtifact";
import { ValidationArtifact } from "./ValidationArtifact";

const artifactTestIds = {
  emptyState: "artifact-empty-state",
  tabs: "artifact-tabs",
  activeTitle: "artifact-active-title",
  summaryCard: "artifact-summary-card",
  content: "artifact-content",
  image: "artifact-image",
  code: "artifact-code",
};

export function ArtifactArea({ className }: { className?: string }) {
  const activeSessionId = useConversationStore((s) => s.activeSessionId);
  const artifacts = useArtifactStore((s) =>
    activeSessionId
      ? s.bySession[activeSessionId] ?? (EMPTY_ARTIFACTS as Artifact[])
      : (EMPTY_ARTIFACTS as Artifact[])
  );
  const activeArtifactId = useArtifactStore((s) =>
    activeSessionId
      ? s.activeArtifactIdBySession[activeSessionId] ?? null
      : null
  );
  const setActiveArtifact = useArtifactStore((s) => s.setActiveArtifact);
  const sortedArtifacts = useMemo(
    () => [...artifacts].sort((a, b) => b.timestamp - a.timestamp),
    [artifacts]
  );
  const activeArtifact =
    sortedArtifacts.find((a) => a.id === activeArtifactId) ?? sortedArtifacts[0];

  const activeContent = activeArtifact
    ? normalizeMarkdown(getParsedContent(activeArtifact.content))
    : "";
  const category = activeArtifact ? getArtifactCategory(activeArtifact.title) : "";

  const conceptSelected =
    !!activeArtifact &&
    getArtifactCategory(activeArtifact.title) === "概念方案" &&
    !!activeArtifact.courseCode &&
    artifacts.some(
      (a) =>
        a.id !== activeArtifact.id &&
        a.courseCode === activeArtifact.courseCode &&
        getArtifactCategory(a.title) !== "概念方案"
    );

  const status = activeArtifact
    ? getArtifactStatus(activeArtifact.title, activeContent, { conceptSelected })
    : "";

  const validationReport =
    category === "验证报告" ? parseValidationReport(activeContent) : null;
  const promptArtifact =
    category === "视觉提示词" ? parsePromptArtifact(activeContent) : null;

  const handleCopy = () => {
    if (!activeContent) return;
    void navigator.clipboard?.writeText(activeContent);
  };

  const handleDownload = () => {
    if (!activeArtifact || !activeContent) return;
    const ext =
      activeArtifact.type === "code"
        ? "txt"
        : activeArtifact.type === "image"
          ? "txt"
          : "md";
    const filename = `${activeArtifact.courseCode ?? "artifact"}-${activeArtifact.title}.${ext}`;
    const blob = new Blob([activeContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderBody = () => {
    if (!activeArtifact) return null;
    const content = normalizeMarkdown(getParsedContent(activeArtifact.content));

    if (activeArtifact.type === "image") {
      return (
        <div
          className="flex h-full w-full items-center justify-center p-4"
          data-testid={artifactTestIds.content}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content}
            alt={activeArtifact.title}
            data-testid={artifactTestIds.image}
            className="max-h-full max-w-full rounded-xl object-contain shadow-[0_6px_24px_rgba(0,0,0,0.08)]"
          />
        </div>
      );
    }

    if (activeArtifact.type === "code") {
      return (
        <pre
          data-testid={artifactTestIds.code}
          className="overflow-x-auto rounded-2xl p-4 font-mono text-[12px] leading-6"
          style={{
            background: "var(--surface-inverse)",
            color: "var(--fg-inverse)",
          }}
        >
          <code>{content}</code>
        </pre>
      );
    }

    if (validationReport) {
      return (
        <ValidationArtifact
          report={validationReport}
          rawContent={content}
          testId={artifactTestIds.content}
        />
      );
    }

    if (promptArtifact) {
      return (
        <PromptArtifact
          prompt={promptArtifact}
          testId={artifactTestIds.content}
        />
      );
    }

    if (category === "概念方案") {
      return (
        <ConceptArtifact
          content={content}
          intro="基于课节知识点与世界观，自动生成的概念候选。请评估各方向的契合度并选择推进方案。"
          testId={artifactTestIds.content}
        />
      );
    }

    return (
      <div
        data-testid={artifactTestIds.content}
        className={cn(
          "prose max-w-none prose-headings:font-semibold",
          "prose-headings:text-[var(--fg-primary)] prose-p:text-[var(--fg-secondary)] prose-li:text-[var(--fg-secondary)] prose-strong:text-[var(--fg-primary)]",
          "prose-a:text-[var(--accent-ink)] prose-a:no-underline hover:prose-a:underline",
          "prose-table:my-4 prose-table:w-full prose-table:border-collapse prose-table:overflow-hidden prose-table:rounded-xl",
          "prose-thead:bg-[var(--surface-elev)]",
          "prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-sm prose-th:font-semibold prose-th:text-[var(--fg-primary)]",
          "prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-td:text-[var(--fg-secondary)] prose-td:align-top",
          "prose-pre:bg-[var(--surface-inverse)] prose-pre:text-[var(--fg-inverse)] prose-pre:rounded-xl",
          "prose-code:rounded prose-code:bg-[var(--accent-soft)] prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-medium prose-code:text-[var(--accent-ink)] prose-code:before:content-none prose-code:after:content-none"
        )}
      >
        <div className="overflow-x-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl",
        className
      )}
      style={{
        background: "var(--surface-tile)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      }}
    >
      {/* Tabs */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto px-4 pt-4 pb-3"
        data-testid={artifactTestIds.tabs}
      >
        {sortedArtifacts.length === 0 ? (
          <div
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium"
            style={{
              background: "var(--surface-elev)",
              color: "var(--fg-muted)",
              boxShadow: "inset 0 0 0 1px var(--border)",
            }}
            data-testid={artifactTestIds.emptyState}
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
            暂未生成工件
          </div>
        ) : null}
        {sortedArtifacts.map((artifact) => {
          const isActive = activeArtifactId === artifact.id;
          const Icon =
            artifact.type === "markdown"
              ? FileText
              : artifact.type === "image"
                ? ImageIcon
                : Code2;
          return (
            <button
              key={artifact.id}
              onClick={() =>
                activeSessionId &&
                setActiveArtifact(activeSessionId, artifact.id)
              }
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
              )}
              style={{
                background: isActive
                  ? "var(--surface-inverse)"
                  : "var(--surface-elev)",
                color: isActive
                  ? "var(--fg-inverse)"
                  : "var(--fg-secondary)",
                boxShadow: isActive
                  ? "none"
                  : "inset 0 0 0 1px var(--border)",
              }}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {artifact.courseCode ? (
                <span
                  className="font-mono text-[10px]"
                  style={{ opacity: 0.7 }}
                >
                  {artifact.courseCode}
                </span>
              ) : null}
              <span className="truncate">{artifact.title}</span>
            </button>
          );
        })}
      </div>

      {/* Render Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2 md:px-8">
        {!activeArtifact ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: "var(--surface-elev)",
                boxShadow: "inset 0 0 0 1px var(--border)",
              }}
            >
              <FolderOpen
                className="h-5 w-5"
                style={{ color: "var(--fg-muted)" }}
                aria-hidden="true"
              />
            </div>
            <div className="mb-1 text-[16px] font-semibold text-[var(--fg-primary)]">
              设计文档
            </div>
            <p
              className="max-w-sm text-[12px]"
              style={{ color: "var(--fg-muted)" }}
            >
              子智能体生成的概念方案、验证报告、设计文档和提示词会显示在这里。
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <ArtifactHeader
              testId={artifactTestIds.summaryCard}
              titleTestId={artifactTestIds.activeTitle}
              courseCode={activeArtifact.courseCode}
              category={category}
              status={status}
              title={activeArtifact.title}
              typeLabel={getArtifactTypeLabel(activeArtifact.type)}
              timestamp={formatTimestamp(activeArtifact.timestamp)}
              onCopy={handleCopy}
              onDownload={handleDownload}
            />
            {renderBody()}
          </div>
        )}
      </div>
    </div>
  );
}
