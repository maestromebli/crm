import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type EnverBadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const toneClass: Record<EnverBadgeTone, string> = {
  neutral:
    "border-[var(--enver-border)] bg-[var(--enver-surface)] text-[var(--enver-text-muted)]",
  accent:
    "border-[var(--enver-accent)]/35 bg-[var(--enver-accent-soft)] text-[var(--enver-accent-hover)]",
  success:
    "border-[var(--enver-success)]/30 bg-[var(--enver-success-soft)] text-[var(--enver-success)]",
  warning:
    "border-[var(--enver-warning)]/35 bg-[var(--enver-warning-soft)] text-[var(--enver-warning)]",
  danger:
    "border-[var(--enver-danger)]/35 bg-[var(--enver-danger-soft)] text-[var(--enver-danger)]",
};

export type EnverBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: EnverBadgeTone;
};

export function EnverBadge({
  className,
  tone = "neutral",
  ...rest
}: EnverBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        toneClass[tone],
        className,
      )}
      {...rest}
    />
  );
}
