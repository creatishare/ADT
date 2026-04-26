"use client";

import type { RefObject } from "react";
import { FileCheck2, Upload, X } from "lucide-react";

interface UploadedDoc {
  name: string;
  content: string;
}

interface UploadCardProps {
  step: string;
  title: string;
  description: string;
  doc: UploadedDoc | null;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

function formatSize(content: string): string {
  const chars = content.length;
  if (chars >= 1000) return `${(chars / 1000).toFixed(1)}k`;
  return `${chars}`;
}

export function UploadCard({
  step,
  title,
  description,
  doc,
  onUpload,
  onClear,
  inputRef,
}: UploadCardProps) {
  return (
    <div
      className="flex flex-col gap-2 rounded-2xl p-3"
      style={{
        background: "var(--surface-elev)",
        boxShadow: "inset 0 0 0 1px var(--border)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--fg-faint)" }}
        >
          {step}
        </span>
        <span className="text-[12px] font-semibold text-[var(--fg-primary)]">
          {title}
        </span>
      </div>
      <p
        className="text-[11px] leading-5"
        style={{ color: "var(--fg-muted)" }}
      >
        {description}
      </p>

      <input
        type="file"
        accept=".md,.txt,.json,.csv"
        className="hidden"
        ref={inputRef}
        onChange={onUpload}
      />

      {doc ? (
        <div
          className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{
            background: "var(--surface-card)",
            boxShadow: "inset 0 0 0 1px var(--border)",
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <FileCheck2
              className="h-4 w-4 shrink-0"
              style={{ color: "var(--success)" }}
            />
            <span className="truncate text-[12px] font-medium text-[var(--fg-primary)]">
              {doc.name}
            </span>
            <span
              className="shrink-0 font-mono text-[10px]"
              style={{ color: "var(--fg-faint)" }}
            >
              {formatSize(doc.content)} chars
            </span>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="ml-2 shrink-0 rounded-full p-1 transition-colors hover:bg-[var(--surface-elev)]"
            style={{ color: "var(--fg-muted)" }}
            title="移除"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-5 text-[12px] transition-colors hover:bg-[var(--surface-card)]"
          style={{
            background: "transparent",
            color: "var(--fg-muted)",
            border: "1px dashed var(--border-strong)",
          }}
        >
          <Upload className="h-4 w-4" />
          点击上传 .md / .txt
        </button>
      )}
    </div>
  );
}
