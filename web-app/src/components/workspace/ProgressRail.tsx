"use client";

import { Check } from "lucide-react";
import type { OrchestratorState } from "@/lib/chat/artifactParser";
import { cn } from "@/lib/utils";

interface ProgressRailProps {
  state: OrchestratorState;
}

interface Step {
  n: number;
  label: string;
}

const STEPS: Step[] = [
  { n: 1, label: "解析输入" },
  { n: 2, label: "概念候选" },
  { n: 3, label: "用户筛选" },
  { n: 4, label: "验证修订" },
  { n: 5, label: "文档编写" },
  { n: 6, label: "视觉提示" },
  { n: 7, label: "整合归档" },
];

type StepState = "done" | "active" | "future";

function getStepState(step: Step, current: number | null): StepState {
  if (current === null) return "future";
  if (step.n < current) return "done";
  if (step.n === current) return "active";
  return "future";
}

export function ProgressRail({ state }: ProgressRailProps) {
  const { currentStep, currentLesson, currentGroup, totalGroups, processedGroups } =
    state;

  const groupProgressLabel =
    totalGroups !== null && totalGroups > 0
      ? `题组 ${Math.min(processedGroups.length + (currentGroup ? 1 : 0), totalGroups)}/${totalGroups}`
      : null;

  return (
    <div
      className="flex flex-col gap-2 px-5 py-3"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-tile)",
      }}
    >
      {/* Top row: lesson name + group progress */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {currentLesson ? (
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.12em]"
              style={{ color: "var(--fg-faint)" }}
            >
              当前
            </span>
            <span className="truncate text-[12px] font-semibold text-[var(--fg-primary)]">
              {currentLesson}
            </span>
          </div>
        ) : null}
        <div className="flex flex-1 justify-end gap-3 text-[11px]">
          {groupProgressLabel ? (
            <span
              className="font-mono"
              style={{ color: "var(--fg-muted)" }}
            >
              {groupProgressLabel}
              {currentGroup ? (
                <>
                  <span className="mx-1.5" style={{ color: "var(--fg-faint)" }}>→</span>
                  <span style={{ color: "var(--fg-secondary)" }}>{currentGroup}</span>
                </>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>

      {/* 7-step rail */}
      <div className="flex items-center gap-1">
        {STEPS.map((step) => {
          const status = getStepState(step, currentStep);
          return (
            <div
              key={step.n}
              className="flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5"
              style={{
                background:
                  status === "active" ? "var(--accent-soft)" : "transparent",
              }}
              aria-current={status === "active" ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold"
                )}
                style={{
                  background:
                    status === "done"
                      ? "var(--success)"
                      : status === "active"
                        ? "var(--accent)"
                        : "var(--surface-ground)",
                  color:
                    status === "future"
                      ? "var(--fg-faint)"
                      : "var(--fg-inverse)",
                }}
              >
                {status === "done" ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                ) : (
                  step.n
                )}
              </span>
              <span
                className="truncate text-[11px] font-medium"
                style={{
                  color:
                    status === "active"
                      ? "var(--accent-ink)"
                      : status === "done"
                        ? "var(--fg-secondary)"
                        : "var(--fg-faint)",
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
