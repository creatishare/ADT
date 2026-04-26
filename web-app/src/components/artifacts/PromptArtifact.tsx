"use client";

import { Palette } from "lucide-react";
import type { PromptArtifact as PromptArtifactData } from "@/lib/chat/artifactParser";
import { SectionLabel } from "@/components/workspace/primitives/SectionLabel";

interface PromptArtifactProps {
  prompt: PromptArtifactData;
  testId?: string;
}

export function PromptArtifact({ prompt, testId }: PromptArtifactProps) {
  return (
    <div data-testid={testId} className="flex flex-col gap-4">
      {/* Hero strip */}
      <div
        className="flex items-start gap-3 rounded-2xl px-4 py-3"
        style={{
          background: "var(--success-soft)",
          boxShadow:
            "inset 0 0 0 1px color-mix(in oklch, var(--success) 25%, transparent)",
        }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--surface-card)" }}
        >
          <Palette
            className="h-4 w-4"
            style={{ color: "var(--success-ink)" }}
            strokeWidth={1.75}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="text-[12px] leading-6"
            style={{ color: "var(--success-ink)" }}
          >
            {prompt.chineseDescription}
          </p>
          {prompt.specs.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {prompt.specs.map((spec) => (
                <span
                  key={spec}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: "var(--surface-card)",
                    color: "var(--success-ink)",
                    boxShadow: "inset 0 0 0 1px var(--border)",
                  }}
                >
                  {spec}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* English prompt */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: "var(--surface-card)",
          boxShadow: "inset 0 0 0 1px var(--border)",
        }}
      >
        <SectionLabel className="mb-3">英文 Prompt</SectionLabel>
        <pre
          className="overflow-x-auto whitespace-pre-wrap rounded-xl p-3 font-mono text-[12px] leading-6"
          style={{
            background: "var(--surface-inverse)",
            color: "var(--fg-inverse)",
          }}
        >
          <code>{prompt.englishPrompt}</code>
        </pre>
      </div>
    </div>
  );
}
