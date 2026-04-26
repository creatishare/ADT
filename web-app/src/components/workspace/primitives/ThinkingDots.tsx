import { cn } from "@/lib/utils";
import type { StatusDotTone } from "./StatusDot";

interface ThinkingDotsProps {
  tone?: StatusDotTone;
  className?: string;
}

const TONE_TO_BG: Record<StatusDotTone, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  danger: "var(--danger)",
  muted: "var(--fg-muted)",
};

export function ThinkingDots({ tone = "accent", className }: ThinkingDotsProps) {
  const bg = TONE_TO_BG[tone];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex items-center gap-1", className)}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="thinking-dot inline-block h-1 w-1 rounded-full"
          style={{ background: bg, animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}
