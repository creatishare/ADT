import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PillTone = "neutral" | "accent" | "success" | "danger" | "inverse";

interface PillProps {
  tone?: PillTone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

interface ToneStyle {
  bg: string;
  fg: string;
  border: string;
}

const TONE_TO_STYLE: Record<PillTone, ToneStyle> = {
  neutral: {
    bg: "var(--surface-elev)",
    fg: "var(--fg-secondary)",
    border: "var(--border)",
  },
  accent: {
    bg: "var(--accent-soft)",
    fg: "var(--accent-ink)",
    border: "color-mix(in oklch, var(--accent) 25%, transparent)",
  },
  success: {
    bg: "var(--success-soft)",
    fg: "var(--success-ink)",
    border: "color-mix(in oklch, var(--success) 25%, transparent)",
  },
  danger: {
    bg: "var(--danger-soft)",
    fg: "var(--danger-ink)",
    border: "color-mix(in oklch, var(--danger) 25%, transparent)",
  },
  inverse: {
    bg: "var(--surface-inverse)",
    fg: "var(--fg-inverse)",
    border: "var(--surface-inverse)",
  },
};

export function Pill({ tone = "neutral", icon, className, children }: PillProps) {
  const style = TONE_TO_STYLE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
        className
      )}
      style={{
        background: style.bg,
        color: style.fg,
        boxShadow: `inset 0 0 0 1px ${style.border}`,
      }}
    >
      {icon ? <span className="flex shrink-0 items-center">{icon}</span> : null}
      {children}
    </span>
  );
}
