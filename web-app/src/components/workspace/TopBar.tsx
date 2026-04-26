"use client";

import { Columns2, FileText, MessageSquare } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { ModelPicker } from "@/components/chat/ModelPicker";
import { cn } from "@/lib/utils";

type ViewMode = "split" | "chat" | "artifacts";

interface TopBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  artifactCount: number;
}

interface NavTab {
  id: ViewMode;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const NAV_TABS: NavTab[] = [
  { id: "chat", label: "对话", Icon: MessageSquare },
  { id: "split", label: "分屏", Icon: Columns2 },
  { id: "artifacts", label: "设计文档", Icon: FileText },
];

function BrandStar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2 L12 22" />
      <path d="M2 12 L22 12" />
      <path d="M5 5 L19 19" />
      <path d="M19 5 L5 19" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TopBar({ viewMode, onViewModeChange, artifactCount }: TopBarProps) {
  return (
    <header
      className="mx-3 mt-3 flex shrink-0 items-center gap-3 rounded-2xl bg-[var(--surface-tile)] px-4 py-2.5 md:mx-4 md:mt-4 md:gap-4 md:px-5 md:py-3"
      style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
      data-testid="workspace-top-bar"
    >
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-2.5 md:gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--surface-inverse)" }}
        >
          <BrandStar className="h-[18px] w-[18px] text-[var(--accent)]" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold tracking-tight text-[var(--fg-primary)]">
            Agent Designer
          </span>
          <span className="hidden font-mono text-[10px] text-[var(--fg-muted)] sm:block">
            v2 · 多智能体关卡工作台
          </span>
        </div>
      </div>

      {/* Center nav — 3 tabs (chat / split / artifacts) */}
      <nav className="flex min-w-0 flex-1 justify-center">
        <div
          className="inline-flex items-center gap-0.5 rounded-full p-0.5"
          style={{ background: "var(--surface-ground)" }}
          role="tablist"
          aria-label="工作区视图切换"
        >
          {NAV_TABS.map((tab) => {
            const isActive = viewMode === tab.id;
            const isArtifacts = tab.id === "artifacts";
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onViewModeChange(tab.id)}
                title={tab.label}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                  isActive
                    ? "text-[var(--fg-inverse)]"
                    : "text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
                )}
                style={{
                  background: isActive ? "var(--surface-inverse)" : "transparent",
                }}
              >
                <tab.Icon width={14} height={14} strokeWidth={1.75} />
                <span>{tab.label}</span>
                {isArtifacts && artifactCount > 0 ? (
                  <span
                    className="ml-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-tight"
                    style={{
                      background: isActive ? "var(--accent)" : "var(--accent-soft)",
                      color: isActive ? "var(--fg-inverse)" : "var(--accent-ink)",
                    }}
                  >
                    {artifactCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Right tools */}
      <div className="flex shrink-0 items-center gap-2">
        <ModelPicker />
      </div>
    </header>
  );
}
