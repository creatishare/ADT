"use client";

import { createElement } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Gamepad2,
  PenLine,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Pill } from "@/components/workspace/primitives/Pill";
import { ThinkingDots } from "@/components/workspace/primitives/ThinkingDots";

const TOOL_NAME_LABEL: Record<string, string> = {
  designStageFile: "关卡策划师",
  writeStageFile: "文档编写师",
  validateStageFile: "关卡验证师",
  generateVisualDesign: "视觉设计师",
};

const TOOL_NAME_ICON: Record<string, LucideIcon> = {
  designStageFile: Gamepad2,
  writeStageFile: PenLine,
  validateStageFile: ShieldCheck,
  generateVisualDesign: Sparkles,
};

export function getToolDisplayName(toolName: string): string {
  return TOOL_NAME_LABEL[toolName] ?? toolName;
}

export function getToolIcon(toolName: string): LucideIcon {
  return TOOL_NAME_ICON[toolName] ?? Workflow;
}

export type ToolCardStatus =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error"
  | "approval-requested"
  | string;

interface ToolCardArtifact {
  title: string;
  courseCode?: string;
}

interface ToolCardProps {
  toolName: string;
  toolCallId: string;
  status: ToolCardStatus;
  summary?: string;
  errorText?: string;
  artifact?: ToolCardArtifact | null;
  onArtifactJump?: () => void;
  onRetry?: () => void;
  retryDisabled?: boolean;
}

function StatusPill({ status }: { status: ToolCardStatus }) {
  if (status === "output-available") {
    return (
      <Pill tone="success" icon={<CheckCircle2 className="h-3 w-3" />}>
        已完成
      </Pill>
    );
  }
  if (status === "output-error") {
    return (
      <Pill tone="danger" icon={<AlertTriangle className="h-3 w-3" />}>
        执行失败
      </Pill>
    );
  }
  if (status === "approval-requested") {
    return <Pill tone="accent">等待确认</Pill>;
  }
  return (
    <Pill tone="accent" icon={<ThinkingDots tone="accent" />}>
      运行中
    </Pill>
  );
}

export function ToolCard({
  toolName,
  toolCallId,
  status,
  summary,
  errorText,
  artifact,
  onArtifactJump,
  onRetry,
  retryDisabled = false,
}: ToolCardProps) {
  const label = getToolDisplayName(toolName);
  const iconElement = createElement(getToolIcon(toolName), {
    className: "h-4 w-4",
    style: { color: "var(--fg-primary)" },
    strokeWidth: 1.75,
    "aria-hidden": "true",
  });

  return (
    <div
      className="flex flex-col rounded-2xl"
      style={{
        background: "var(--surface-card)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      }}
    >
      <div className="flex items-center gap-3 p-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--surface-elev)" }}
        >
          {iconElement}
        </div>
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[12px] font-semibold text-[var(--fg-primary)]">
            {label}
          </span>
          <span
            className="truncate font-mono text-[10px]"
            style={{ color: "var(--fg-faint)" }}
          >
            {toolName} · {toolCallId.slice(0, 8)}
          </span>
        </div>
        <StatusPill status={status} />
      </div>

      {summary ? (
        <div
          className="px-3 pb-3 text-[11px]"
          style={{ color: "var(--fg-muted)" }}
        >
          {summary}
        </div>
      ) : null}

      {status === "output-error" ? (
        <div
          className="mx-3 mb-3 rounded-xl px-3 py-2 text-xs"
          style={{
            background: "var(--danger-soft)",
            color: "var(--danger-ink)",
          }}
        >
          <div>工具执行失败：{errorText ?? "请稍后重试"}</div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={retryDisabled}
              className="mt-2 rounded-full px-3 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--danger)" }}
            >
              重新生成本轮回复
            </button>
          ) : null}
        </div>
      ) : null}

      {artifact && onArtifactJump ? (
        <button
          type="button"
          onClick={onArtifactJump}
          className="flex items-center justify-between gap-3 rounded-b-2xl px-3 py-2.5 text-left text-[11px] transition-colors hover:bg-[var(--surface-elev)]"
          style={{
            color: "var(--fg-secondary)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span className="flex min-w-0 items-center gap-2">
            {artifact.courseCode ? (
              <span
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: "var(--fg-faint)" }}
              >
                {artifact.courseCode}
              </span>
            ) : null}
            <span className="truncate font-medium text-[var(--fg-primary)]">
              {artifact.title}
            </span>
          </span>
          <span
            className="inline-flex items-center gap-1 font-medium"
            style={{ color: "var(--accent-ink)" }}
          >
            查看
            <ArrowUpRight className="h-3 w-3" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
