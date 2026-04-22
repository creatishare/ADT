"use client";

import { useMemo } from "react";
import { useArtifactStore } from "@/store/useArtifactStore";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import {
  formatTimestamp,
  getArtifactCategory,
  getArtifactMetrics,
  getArtifactStatus,
  getArtifactSummary,
  getArtifactTypeLabel,
  getParsedContent,
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
    ? getParsedContent(activeArtifact.content)
    : "";
  const metrics = getArtifactMetrics(activeContent);
  const category = activeArtifact ? getArtifactCategory(activeArtifact.title) : "";
  const status = activeArtifact
    ? getArtifactStatus(activeArtifact.title, activeContent)
    : "";
  const summary = activeArtifact ? getArtifactSummary(activeArtifact.title) : "";
  const validationReport =
    category === "验证报告" ? parseValidationReport(activeContent) : null;
  const promptArtifact =
    category === "视觉提示词" ? parsePromptArtifact(activeContent) : null;

  const renderContent = () => {
    if (!activeArtifact) return null;

    const content = getParsedContent(activeArtifact.content);

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
            className="max-h-full max-w-full rounded-lg object-contain shadow-lg border border-gray-200"
          />
        </div>
      );
    }

    if (activeArtifact.type === "code") {
      return (
        <pre
          data-testid={artifactTestIds.code}
          className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-950 p-4 text-sm text-gray-100"
        >
          <code>{content}</code>
        </pre>
      );
    }

    return (
      <div
        data-testid={artifactTestIds.content}
        className="prose prose-blue max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-blue-600"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  return (
    <div className={cn("flex h-full flex-col bg-white border-l border-gray-200", className)}>
      {/* Tabs */}
      <div
        className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto px-2"
        data-testid={artifactTestIds.tabs}
      >
        {sortedArtifacts.length === 0 && (
          <div
            className="px-4 py-3 text-sm font-medium text-gray-400"
            data-testid={artifactTestIds.emptyState}
          >
            暂未生成工件
          </div>
        )}
        {sortedArtifacts.map((artifact) => {
          const label = artifact.courseCode
            ? `${artifact.courseCode} ${artifact.title}`
            : artifact.title;
          return (
            <button
              key={artifact.id}
              onClick={() => setActiveArtifact(artifact.id)}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                activeArtifactId === artifact.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              )}
            >
              {artifact.type === "markdown"
                ? "📄 "
                : artifact.type === "image"
                ? "🖼️ "
                : "💻 "}
              {label}
            </button>
          );
        })}
      </div>

      {/* Render Area */}
      <div className="flex-1 overflow-y-auto p-8">
        {!activeArtifact ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-2 text-lg text-gray-400">工件查看区</div>
            <p className="max-w-sm text-sm text-gray-500">
              子智能体生成的概念方案、验证报告、设计文档和提示词会显示在这里。
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h2
                  data-testid={artifactTestIds.activeTitle}
                  className="text-xl font-semibold text-gray-900"
                >
                  {activeArtifact.courseCode
                    ? `${activeArtifact.courseCode} ${activeArtifact.title}`
                    : activeArtifact.title}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {getArtifactTypeLabel(activeArtifact.type)} ·{" "}
                  {formatTimestamp(activeArtifact.timestamp)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1.6fr_repeat(3,minmax(0,1fr))]">
              <div
                data-testid={artifactTestIds.summaryCard}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">
                    {category}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                    {status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-gray-600">{summary}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-400">有效行数</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">
                  {metrics.lines}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-400">章节数量</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">
                  {metrics.sections}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="text-xs text-gray-400">表格行数</div>
                <div className="mt-2 text-2xl font-semibold text-gray-900">
                  {metrics.tables}
                </div>
              </div>
            </div>

            {validationReport && (
              <div className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-xs text-amber-700">总体结论</div>
                  <div className="mt-2 text-lg font-semibold text-amber-900">
                    {validationReport.conclusion}
                  </div>
                  {validationReport.risks.length > 0 && (
                    <ul className="mt-3 space-y-2 text-sm text-amber-800">
                      {validationReport.risks.map((risk) => (
                        <li key={risk}>• {risk}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-500">修改建议清单</div>
                  {validationReport.suggestions.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-sm text-gray-700">
                      {validationReport.suggestions.map((item) => (
                        <li key={item}>• {item.replace(/^\d+\.\s*/, "")}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500">
                      暂未自动提取到明确的修改建议，请查看下方原文。
                    </p>
                  )}
                </div>
              </div>
            )}

            {promptArtifact && (
              <div className="grid gap-3 md:grid-cols-[1fr_1.2fr]">
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <div className="text-xs text-sky-700">中文说明</div>
                  <p className="mt-2 text-sm leading-6 text-sky-900">
                    {promptArtifact.chineseDescription}
                  </p>
                  {promptArtifact.specs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {promptArtifact.specs.map((spec) => (
                        <span
                          key={spec}
                          className="rounded-full bg-white px-2.5 py-1 text-xs text-sky-700 ring-1 ring-sky-200"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-500">英文 Prompt</div>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-gray-950 p-3 text-xs leading-6 text-gray-100">
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
