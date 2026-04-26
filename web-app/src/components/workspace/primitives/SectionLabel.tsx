import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionLabelProps {
  className?: string;
  children: ReactNode;
}

export function SectionLabel({ className, children }: SectionLabelProps) {
  return (
    <div
      className={cn(
        "px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
        className
      )}
      style={{ color: "var(--fg-faint)" }}
    >
      {children}
    </div>
  );
}
