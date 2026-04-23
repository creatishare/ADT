"use client";

import { MessageSquareWarning, ArrowRight } from "lucide-react";

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
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface-card)] px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)]">
          <MessageSquareWarning className="h-4 w-4 text-[var(--accent-ink)]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[var(--fg-primary)]">
            {label}
          </div>
          {hint && (
            <div className="truncate text-[11px] text-[var(--fg-muted)]">{hint}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onReject && (
          <button
            type="button"
            onClick={onReject}
            disabled={disabled}
            className="rounded-full bg-[var(--surface-ground)] px-3.5 py-1.5 text-[11px] font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {rejectLabel}
          </button>
        )}
        {onApprove && (
          <button
            type="button"
            onClick={onApprove}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-inverse)] px-3.5 py-1.5 text-[11px] font-semibold text-[var(--fg-inverse)] transition-colors hover:bg-[var(--fg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {approveLabel}
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
