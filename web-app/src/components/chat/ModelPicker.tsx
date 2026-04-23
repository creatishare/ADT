"use client";

import { useModelStore } from "@/store/useModelStore";
import {
  AVAILABLE_MODELS,
  isKnownModelId,
  type ModelId,
} from "@/lib/llm/providers";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

const pickerTestIds = {
  root: "model-picker",
  select: "model-picker-select",
};

export function ModelPicker({ className }: { className?: string }) {
  const modelId = useModelStore((s) => s.modelId);
  const setModelId = useModelStore((s) => s.setModelId);

  const activeMeta =
    AVAILABLE_MODELS.find((m) => m.id === modelId) ?? AVAILABLE_MODELS[0];

  return (
    <div
      data-testid={pickerTestIds.root}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-full bg-[var(--surface-ground)] px-3 py-1.5 text-xs text-[var(--fg-primary)] transition-colors hover:bg-[var(--accent-soft)]",
        className
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--success)]" />
      <span className="font-mono text-[11px] font-medium text-[var(--fg-primary)]">
        {activeMeta.label}
      </span>
      <ChevronDown className="h-3 w-3 text-[var(--fg-muted)]" />
      <select
        data-testid={pickerTestIds.select}
        value={modelId}
        onChange={(e) => {
          const next = e.target.value;
          if (isKnownModelId(next)) {
            setModelId(next as ModelId);
          }
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="选择大模型"
      >
        {AVAILABLE_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} — {m.hint}
          </option>
        ))}
      </select>
    </div>
  );
}
