import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MetricTileProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
  /** Легкий акцент при наведенні (для оглядових плиток). */
  interactive?: boolean;
};

export function MetricTile({
  label,
  value,
  hint,
  className,
  interactive = true,
}: MetricTileProps) {
  return (
    <article
      className={cn(
        "rounded-xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-3 shadow-[var(--enver-shadow)] transition duration-200",
        interactive &&
          "hover:border-[var(--enver-border-strong)] hover:shadow-md",
        className,
      )}
    >
      <p className="text-xs text-[var(--enver-text-muted)]">{label}</p>
      <div className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-[var(--enver-text)]">
        {value}
      </div>
      {hint != null && hint !== "" ? (
        <p className="mt-1 text-[11px] leading-snug text-[var(--enver-muted)]">{hint}</p>
      ) : null}
    </article>
  );
}
