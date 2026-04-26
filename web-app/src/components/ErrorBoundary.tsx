"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Human-readable label shown in the fallback UI, e.g. "对话区". */
  label?: string;
  /** Optional custom fallback render; takes precedence over the default. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

const SESSION_STORAGE_KEY = "agent-designer-error-trail";
const MAX_TRAIL = 10;

function recordTrail(label: string, error: Error): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    const trail: Array<{ at: string; label: string; message: string; stack?: string }> = raw
      ? JSON.parse(raw)
      : [];
    trail.push({
      at: new Date().toISOString(),
      label,
      message: error.message,
      stack: error.stack,
    });
    const trimmed = trail.slice(-MAX_TRAIL);
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // sessionStorage may be disabled (private mode, quota) — never crash the boundary itself.
  }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const label = this.props.label ?? "ui";
    recordTrail(label, error);
    console.error(`[ErrorBoundary:${label}]`, error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div
        role="alert"
        className="h-full w-full flex flex-col items-center justify-center gap-3 p-6 text-center text-[var(--fg-secondary)]"
      >
        <p className="text-base font-medium text-[var(--fg-primary)]">
          {this.props.label ?? "界面"}加载失败
        </p>
        <p className="text-sm max-w-md break-words">{error.message}</p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-2 px-4 py-2 rounded-md bg-[var(--accent-soft)] text-[var(--fg-primary)] hover:opacity-90 transition-opacity text-sm"
        >
          重试此区域
        </button>
      </div>
    );
  }
}
