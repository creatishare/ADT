"use client";

import { useMemo } from "react";
import { useArtifactStore } from "@/store/useArtifactStore";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Image as ImageIcon, Code2, FolderOpen } from "lucide-react";
import {
  formatTimestamp,
  getArtifactCategory,
  getArtifactMetrics,
  getArtifactStatus,
  getArtifactSummary,
  getArtifactTypeLabel,
  getParsedContent,
  normalizeMarkdown,
  parsePromptArtifact,
  parseValidationReport,
} from "@/lib/chat/artifactParser";

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
  const { artifacts, activeArtifactId, setActiveArtifact } = useArtifactStore();
  const sortedArtifacts = useMemo(
    () => [...artifacts].sort((a, b) => b.timestamp - a.timestamp),
    [artifacts]
  );
  const activeArtifact =
    sortedArtifacts.find((a) => a.id === activeArtifactId) ?? sortedArtifacts[0];

  const activeContent = activeArtifact
    ? normalizeMarkdown(getParsedContent(activeArtifact.content))
    : "";
  const metrics = getArtifactMetrics(activeContent);
  const category = activeArtifact ? getArtifactCategory(activeArtifact.title) : "";

  // A concept artifact is considered "selected" once any downstream artifact
  // (validation / design doc / prompt) with the same courseCode has been produced.
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

  const statusPillClass =
    status === "待修改"
      ? "bg-[var(--danger-soft)] text-[var(--danger)]"
      : status === "待筛选"
      ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
      : status === "已通过" || status === "已选定" || status === "可用于出图"
      ? "bg-[var(--success-soft)] text-[var(--success-ink)]"
      : "bg-[var(--surface-ground)] text-[var(--fg-secondary)]";
  const summary = activeArtifact ? getArtifactSummary(activeArtifact.title) : "";
  const validationReport =
    category === "验证报告" ? parseValidationReport(activeContent) : null;
  const promptArtifact =
    category === "视觉提示词" ? parsePromptArtifact(activeContent) : null;

  const renderContent = () => {
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
          className="overflow-x-auto rounded-xl bg-[var(--surface-inverse)] p-4 text-sm text-[var(--fg-inverse)]"
        >
          <code>{content}</code>
        </pre>
      );
    }

    return (
      <div
        data-testid={artifactTestIds.content}
        className={cn(
          "prose max-w-none prose-headings:font-semibold",
          "prose-headings:text-[var(--fg-primary)] prose-p:text-[var(--fg-secondary)] prose-li:text-[var(--fg-secondary)] prose-strong:text-[var(--fg-primary)]",
          "prose-a:text-[var(--accent-ink)] prose-a:no-underline hover:prose-a:underline",
          // Table styling — warm linen tokens
          "prose-table:my-4 prose-table:w-full prose-table:border-collapse prose-table:overflow-hidden prose-table:rounded-xl",
          "prose-thead:bg-[var(--surface-ground)]",
          "prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-sm prose-th:font-semibold prose-th:text-[var(--fg-primary)]",
          "prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-td:text-[var(--fg-secondary)] prose-td:align-top",
          // Code/pre tweaks
          "prose-pre:bg-[var(--surface-inverse)] prose-pre:text-[var(--fg-inverse)] prose-pre:rounded-xl",
          "prose-code:rounded prose-code:bg-[var(--accent-soft)] prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-medium prose-code:text-[var(--accent-ink)] prose-code:before:content-none prose-code:after:content-none"
        )}
      >
        <div className="overflow-x-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-2xl bg-[var(--surface-tile)] overflow-hidden",
        className
      )}
    >
      {/* Tabs */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto px-4 pt-4 pb-3"
        data-testid={artifactTestIds.tabs}
      >
        {sortedArtifacts.length === 0 && (
          <div
            className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-ground)] px-3.5 py-1.5 text-xs font-medium text-[var(--fg-muted)]"
            data-testid={artifactTestIds.emptyState}
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
            暂未生成工件
          </div>
        )}
        {sortedArtifacts.map((artifact) => {
          const label = artifact.courseCode
            ? `${artifact.courseCode} ${artifact.title}`
            : artifact.title;
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
              onClick={() => setActiveArtifact(artifact.id)}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-[var(--surface-inverse)] text-[var(--fg-inverse)]"
                  : "bg-[var(--surface-ground)] text-[var(--fg-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)]"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Render Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2 md:px-8">
        {!activeArtifact ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-ground)]">
              <FolderOpen
                className="h-5 w-5 text-[var(--fg-muted)]"
                aria-hidden="true"
              />
            </div>
            <div className="mb-1 text-base font-semibold text-[var(--fg-primary)]">
              工件查看区
            </div>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              子智能体生成的概念方案、验证报告、设计文档和提示词会显示在这里。
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4 pb-3">
              <div>
                <h2
                  data-testid={artifactTestIds.activeTitle}
                  className="text-xl font-semibold tracking-tight text-[var(--fg-primary)]"
                >
                  {activeArtifact.courseCode
                    ? `${activeArtifact.courseCode} ${activeArtifact.title}`
                    : activeArtifact.title}
                </h2>
                <p className="mt-1 text-xs text-[var(--fg-muted)]">
                  {getArtifactTypeLabel(activeArtifact.type)} ·{" "}
                  {formatTimestamp(activeArtifact.timestamp)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1.6fr_repeat(3,minmax(0,1fr))]">
              <div
                data-testid={artifactTestIds.summaryCard}
                className="rounded-2xl bg-[var(--surface-inverse)] p-4 text-[var(--fg-inverse)]"
              >
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 font-medium text-[var(--accent-ink)]">
                    {category}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 font-medium",
                      statusPillClass
                    )}
                  >
                    {status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--fg-inverse)]/80">
                  {summary}
                </p>
              </div>
              <div className="rounded-2xl bg-[var(--surface-ground)] p-4">
                <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">
                  有效行数
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--fg-primary)]">
                  {metrics.lines}
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--surface-ground)] p-4">
                <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">
                  章节数量
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--fg-primary)]">
                  {metrics.sections}
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--surface-ground)] p-4">
                <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">
                  表格行数
                </div>
                <div className="mt-2 text-2xl font-semibold text-[var(--fg-primary)]">
                  {metrics.tables}
                </div>
              </div>
            </div>

            {validationReport && (
              <div className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
                <div className="rounded-2xl bg-[var(--accent-soft)] p-4">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--accent-ink)]/70">
                    总体结论
                  </div>
                  <div className="mt-2 text-lg font-semibold text-[var(--accent-ink)]">
                    {validationReport.conclusion}
                  </div>
                  {validationReport.risks.length > 0 && (
                    <ul className="mt-3 space-y-2 text-sm text-[var(--accent-ink)]/90">
                      {validationReport.risks.map((risk) => (
                        <li key={risk}>• {risk}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-2xl bg-[var(--surface-ground)] p-4">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">
                    修改建议清单
                  </div>
                  {validationReport.suggestions.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-sm text-[var(--fg-secondary)]">
                      {validationReport.suggestions.map((item) => (
                        <li key={item}>• {item.replace(/^\d+\.\s*/, "")}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-[var(--fg-muted)]">
                      暂未自动提取到明确的修改建议，请查看下方原文。
                    </p>
                  )}
                </div>
              </div>
            )}

            {promptArtifact && (
              <div className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
                <div className="rounded-2xl bg-[var(--success-soft)] p-4">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--success-ink)]/70">
                    中文说明
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--success-ink)]">
                    {promptArtifact.chineseDescription}
                  </p>
                  {promptArtifact.specs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {promptArtifact.specs.map((spec) => (
                        <span
                          key={spec}
                          className="rounded-full bg-[var(--surface-card)] px-2.5 py-1 text-xs font-medium text-[var(--success-ink)]"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl bg-[var(--surface-ground)] p-4">
                  <div className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">
                    英文 Prompt
                  </div>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-[var(--surface-inverse)] p-3 text-xs leading-6 text-[var(--fg-inverse)]">
                    <code>{promptArtifact.englishPrompt}</code>
                  </pre>
                </div>
              </div>
            )}

            {renderContent()}
          </div>
        )}
      </div>
    </div>
  );
}
