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
        "relative inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 shadow-sm transition-colors hover:border-gray-300",
        className
      )}
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
      <div className="flex flex-col leading-tight">
        <span className="font-medium text-gray-900">{activeMeta.label}</span>
        <span className="text-[10px] text-gray-400">{activeMeta.hint}</span>
      </div>
      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
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
