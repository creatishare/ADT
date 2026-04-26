import { cn } from "@/lib/utils";

export type StatusDotTone = "accent" | "success" | "danger" | "muted";

interface StatusDotProps {
  tone?: StatusDotTone;
  className?: string;
}

const TONE_TO_BG: Record<StatusDotTone, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  danger: "var(--danger)",
  muted: "var(--fg-faint)",
};

export function StatusDot({ tone = "muted", className }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", className)}
      style={{ background: TONE_TO_BG[tone] }}
    />
  );
}
