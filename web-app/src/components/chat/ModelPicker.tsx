"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useModelStore } from "@/store/useModelStore";
import {
  AVAILABLE_MODELS,
  isKnownModelId,
  type ModelId,
} from "@/lib/llm/providers";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/workspace/primitives/StatusDot";

const pickerTestIds = {
  root: "model-picker",
  select: "model-picker-select",
  trigger: "model-picker-trigger",
};

export function ModelPicker({ className }: { className?: string }) {
  const modelId = useModelStore((s) => s.modelId);
  const setModelId = useModelStore((s) => s.setModelId);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const activeMeta =
    AVAILABLE_MODELS.find((m) => m.id === modelId) ?? AVAILABLE_MODELS[0];

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function handleSelect(id: ModelId) {
    setModelId(id);
    setOpen(false);
  }

  return (
    <div
      ref={wrapperRef}
      data-testid={pickerTestIds.root}
      className={cn("relative inline-flex items-center", className)}
    >
      <button
        type="button"
        data-testid={pickerTestIds.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors"
        style={{
          background: "var(--surface-elev)",
          color: "var(--fg-primary)",
          boxShadow: "inset 0 0 0 1px var(--border)",
        }}
      >
        <StatusDot tone="success" />
        <span className="font-mono text-[11px] font-medium">
          {activeMeta.label}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            open ? "rotate-180" : "rotate-0"
          )}
          style={{ color: "var(--fg-muted)" }}
        />
      </button>

      {/* Hidden mirror <select> kept for E2E (Playwright `selectOption`) and a11y fallback */}
      <select
        data-testid={pickerTestIds.select}
        value={modelId}
        onChange={(e) => {
          const next = e.target.value;
          if (isKnownModelId(next)) {
            setModelId(next as ModelId);
          }
        }}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      >
        {AVAILABLE_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} — {m.hint}
          </option>
        ))}
      </select>

      {open ? (
        <div
          role="listbox"
          aria-label="选择大模型"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] overflow-hidden rounded-2xl"
          style={{
            background: "var(--surface-card)",
            boxShadow:
              "inset 0 0 0 1px var(--border), 0 12px 32px rgba(0,0,0,0.12)",
          }}
        >
          <div
            className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: "var(--fg-faint)" }}
          >
            选择大模型
          </div>
          <ul className="max-h-[320px] overflow-y-auto pb-1">
            {AVAILABLE_MODELS.map((m) => {
              const isActive = m.id === modelId;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-testid={`model-picker-option-${m.id}`}
                    onClick={() => handleSelect(m.id as ModelId)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
                    )}
                    style={{
                      background: isActive
                        ? "var(--accent-soft)"
                        : "transparent",
                    }}
                  >
                    <StatusDot tone={isActive ? "accent" : "muted"} />
                    <span className="flex flex-1 flex-col leading-tight">
                      <span className="font-mono text-[12px] font-medium text-[var(--fg-primary)]">
                        {m.label}
                      </span>
                      <span className="text-[11px] text-[var(--fg-muted)]">
                        {m.hint}
                      </span>
                    </span>
                    {isActive ? (
                      <Check
                        className="h-3.5 w-3.5"
                        style={{ color: "var(--accent-ink)" }}
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
