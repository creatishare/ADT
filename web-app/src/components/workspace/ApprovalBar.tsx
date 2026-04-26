"use client";

import { ArrowRight, Hand } from "lucide-react";

interface ApprovalBarProps {
  label: string;
  hint?: string;
  onApprove?: () => void;
  onReject?: () => void;
  approveLabel?: string;
  rejectLabel?: string;
  disabled?: boolean;
}

export function ApprovalBar({
  label,
  hint,
  onApprove,
  onReject,
  approveLabel = "确认继续",
  rejectLabel = "换一个方案",
  disabled = false,
}: ApprovalBarProps) {
  return (
    <div
      data-testid="approval-bar"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
      style={{
        background: "var(--accent-soft)",
        boxShadow:
          "inset 0 0 0 1px color-mix(in oklch, var(--accent) 25%, transparent)",
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "var(--surface-card)",
            boxShadow: "inset 0 0 0 1px var(--border)",
          }}
        >
          <Hand
            className="h-4 w-4"
            style={{ color: "var(--accent-ink)" }}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0">
          <div
            className="truncate text-[13px] font-semibold"
            style={{ color: "var(--accent-ink)" }}
          >
            {label}
          </div>
          {hint ? (
            <div
              className="truncate text-[11px]"
              style={{ color: "var(--accent-ink)", opacity: 0.7 }}
            >
              {hint}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onReject ? (
          <button
            type="button"
            onClick={onReject}
            disabled={disabled}
            className="rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--surface-card)",
              color: "var(--fg-secondary)",
              boxShadow: "inset 0 0 0 1px var(--border)",
            }}
          >
            {rejectLabel}
          </button>
        ) : null}
        {onApprove ? (
          <button
            type="button"
            onClick={onApprove}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--surface-inverse)",
              color: "var(--fg-inverse)",
            }}
          >
            {approveLabel}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
