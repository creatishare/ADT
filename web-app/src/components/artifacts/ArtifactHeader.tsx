"use client";

import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Download,
  MoreHorizontal,
  Tag,
} from "lucide-react";
import { Pill, type PillTone } from "@/components/workspace/primitives/Pill";

interface ArtifactHeaderProps {
  courseCode?: string;
  category: string;
  status: string;
  title: string;
  typeLabel: string;
  timestamp: string;
  onCopy?: () => void;
  onDownload?: () => void;
  testId?: string;
  titleTestId?: string;
}

function getStatusTone(status: string): PillTone {
  switch (status) {
    case "已通过":
    case "已选定":
    case "可用于出图":
      return "success";
    case "待修改":
      return "danger";
    case "待筛选":
      return "accent";
    default:
      return "neutral";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "已通过":
    case "已选定":
    case "可用于出图":
      return <Check className="h-3 w-3" />;
    case "待修改":
      return <AlertCircle className="h-3 w-3" />;
    default:
      return null;
  }
}

export function ArtifactHeader({
  courseCode,
  category,
  status,
  title,
  typeLabel,
  timestamp,
  onCopy,
  onDownload,
  testId,
  titleTestId,
}: ArtifactHeaderProps) {
  const statusTone = getStatusTone(status);
  const statusIcon = getStatusIcon(status);
  return (
    <div
      data-testid={testId}
      className="flex flex-wrap items-start justify-between gap-3"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {courseCode ? (
            <>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.12em]"
                style={{ color: "var(--fg-faint)" }}
              >
                {courseCode}
              </span>
              <span
                className="inline-block h-3 w-px"
                style={{ background: "var(--border-strong)" }}
                aria-hidden="true"
              />
            </>
          ) : null}
          {category ? (
            <Pill tone="neutral" icon={<Tag className="h-3 w-3" />}>
              {category}
            </Pill>
          ) : null}
          {status ? (
            <Pill tone={statusTone} icon={statusIcon}>
              {status}
            </Pill>
          ) : null}
        </div>
        <h1
          data-testid={titleTestId}
          className="text-[22px] font-semibold leading-tight tracking-tight text-[var(--fg-primary)]"
        >
          {title}
        </h1>
        <div
          className="mt-1.5 flex items-center gap-1.5 text-[11px]"
          style={{ color: "var(--fg-muted)" }}
        >
          <Clock className="h-3 w-3" />
          <span className="font-mono">{timestamp}</span>
          <span style={{ color: "var(--fg-faint)" }}>·</span>
          <span>{typeLabel}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-elev)]"
            style={{ color: "var(--fg-secondary)" }}
            title="复制内容"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {onDownload ? (
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-elev)]"
            style={{ color: "var(--fg-secondary)" }}
            title="下载"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-elev)]"
          style={{ color: "var(--fg-secondary)" }}
          title="更多操作"
          aria-label="更多操作"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
