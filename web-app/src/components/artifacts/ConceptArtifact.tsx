"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConceptArtifactProps {
  content: string;
  intro?: string;
  testId?: string;
}

export function ConceptArtifact({
  content,
  intro,
  testId,
}: ConceptArtifactProps) {
  return (
    <div data-testid={testId} className="flex flex-col gap-4">
      {intro ? (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3"
          style={{
            background: "var(--accent-soft)",
            boxShadow:
              "inset 0 0 0 1px color-mix(in oklch, var(--accent) 25%, transparent)",
          }}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--surface-card)" }}
          >
            <Lightbulb
              className="h-4 w-4"
              style={{ color: "var(--accent-ink)" }}
              strokeWidth={1.75}
            />
          </div>
          <p
            className="text-[12px] leading-6"
            style={{ color: "var(--accent-ink)" }}
          >
            {intro}
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          "prose max-w-none prose-headings:font-semibold",
          "prose-headings:text-[var(--fg-primary)] prose-p:text-[var(--fg-secondary)] prose-li:text-[var(--fg-secondary)] prose-strong:text-[var(--fg-primary)]",
          "prose-a:text-[var(--accent-ink)] prose-a:no-underline hover:prose-a:underline",
          "prose-h2:mt-6 prose-h2:text-[16px] prose-h3:text-[14px]",
          "prose-table:my-4 prose-table:w-full prose-table:border-collapse prose-table:overflow-hidden prose-table:rounded-xl",
          "prose-thead:bg-[var(--surface-elev)]",
          "prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-sm prose-th:font-semibold prose-th:text-[var(--fg-primary)]",
          "prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-td:text-[var(--fg-secondary)] prose-td:align-top",
          "prose-pre:bg-[var(--surface-inverse)] prose-pre:text-[var(--fg-inverse)] prose-pre:rounded-xl",
          "prose-code:rounded prose-code:bg-[var(--accent-soft)] prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-medium prose-code:text-[var(--accent-ink)] prose-code:before:content-none prose-code:after:content-none"
        )}
      >
        <div className="overflow-x-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
