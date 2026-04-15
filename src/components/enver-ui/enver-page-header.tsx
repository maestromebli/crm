import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type EnverPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Primary action — “Next step” pattern */
  action?: ReactNode;
  className?: string;
};

/**
 * Page title region: large heading, optional eyebrow, one dominant action slot.
 */
export function EnverPageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: EnverPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b border-[var(--enver-border)] pb-4 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="enver-status-chip w-fit">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--enver-text)] md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--enver-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </header>
  );
}
