"use client";

import type { PlanningMode } from "@/lib/setup/buildInitialPrompt";

interface ModeOption {
  value: PlanningMode;
  label: string;
  hint: string;
}

const OPTIONS: ReadonlyArray<ModeOption> = [
  {
    value: "standard",
    label: "标准",
    hint: "对课节内所有题组按 7 步法循环策划",
  },
  {
    value: "single-group",
    label: "单题组",
    hint: "只策划用户选定的一个题组，跳过题组循环和剧情衔接",
  },
  {
    value: "integration",
    label: "整合",
    hint: "用户已自带壳子方案，做轻量适配并串联剧情",
  },
];

interface ModeSelectorProps {
  value: PlanningMode;
  onChange: (mode: PlanningMode) => void;
}

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  const activeHint = OPTIONS.find((o) => o.value === value)?.hint ?? "";

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
          STEP 00
        </span>
        <span className="text-[12px] font-semibold text-[var(--fg-primary)]">
          策划模式
        </span>
      </div>
      <div
        className="flex rounded-xl p-1"
        style={{
          background: "var(--surface-card)",
          boxShadow: "inset 0 0 0 1px var(--border)",
        }}
        role="tablist"
        aria-label="策划模式"
        data-testid="mode-selector"
      >
        {OPTIONS.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`mode-option-${opt.value}`}
              onClick={() => {
                if (!isActive) onChange(opt.value);
              }}
              className="flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors"
              style={{
                background: isActive ? "var(--surface-inverse)" : "transparent",
                color: isActive ? "var(--fg-inverse)" : "var(--fg-muted)",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <p
        className="text-[11px] leading-5"
        style={{ color: "var(--fg-muted)" }}
        data-testid="mode-hint"
      >
        {activeHint}
      </p>
    </div>
  );
}
