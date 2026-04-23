"use client";

import { Sparkles } from "lucide-react";
import { ModelPicker } from "@/components/chat/ModelPicker";
import { cn } from "@/lib/utils";

type ViewMode = "split" | "chat" | "artifacts";

interface TopBarProps {
  viewMode: ViewMode;
  onTabClick: (tab: "chat" | "artifacts") => void;
  artifactCount: number;
}

export function TopBar({ viewMode, onTabClick, artifactCount }: TopBarProps) {
  const isChatActive = viewMode === "chat";
  const isArtifactsActive = viewMode === "artifacts";

  return (
    <header
      className="shrink-0 flex items-center gap-3 rounded-2xl bg-[var(--surface-tile)] px-4 py-2.5 mx-3 mt-3 md:mx-4 md:mt-4 md:gap-4 md:px-5 md:py-3"
      data-testid="workspace-top-bar"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 shrink-0 md:gap-3">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-inverse)]">
          <Sparkles
            className="h-[18px] w-[18px] text-[var(--accent)]"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface-tile)]"
          />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold tracking-tight text-[var(--fg-primary)]">
            Agent Designer
          </span>
          <span className="hidden text-[10px] text-[var(--fg-muted)] sm:block">
            C++ 关卡多智能体工作台
          </span>
        </div>
      </div>

      {/* Center nav pill — focuses a pane on desktop, tab-switches on mobile */}
      <nav className="flex-1 flex justify-center min-w-0">
        <div
          className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-ground)] p-1"
          role="tablist"
          aria-label="工作区视图切换"
        >
          <button
            type="button"
            role="tab"
            aria-selected={isChatActive}
            onClick={() => onTabClick("chat")}
            title={isChatActive ? "点击返回分屏视图" : "聚焦对话区"}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              isChatActive
                ? "bg-[var(--surface-inverse)] text-[var(--fg-inverse)]"
                : "text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--accent-soft)]/50"
            )}
          >
            对话
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isArtifactsActive}
            onClick={() => onTabClick("artifacts")}
            title={isArtifactsActive ? "点击返回分屏视图" : "聚焦设计文档"}
            className={cn(
              "relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              isArtifactsActive
                ? "bg-[var(--surface-inverse)] text-[var(--fg-inverse)]"
                : "text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--accent-soft)]/50"
            )}
          >
            设计文档
            {artifactCount > 0 && (
              <span
                className={cn(
                  "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-tight",
                  isArtifactsActive
                    ? "bg-[var(--accent)] text-[var(--fg-inverse)]"
                    : "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                )}
              >
                {artifactCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Right tools */}
      <div className="flex items-center gap-2 shrink-0">
        <ModelPicker />
      </div>
    </header>
  );
}
