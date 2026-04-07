import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export type DashboardShellProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DashboardShell({
  title,
  subtitle,
  eyebrow = "ENVER · Control Center",
  controls,
  children,
  className,
}: DashboardShellProps) {
  return (
    <div
      className={cn(
        "enver-page-shell",
        className,
      )}
    >
      <div className="mx-auto max-w-[1600px] px-3 py-6 md:px-8">
        <header className="flex flex-col gap-4 border-b border-[var(--enver-border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--enver-muted)]">
              {eyebrow}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--enver-text)] md:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="max-w-2xl text-sm text-[var(--enver-text-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          {controls ? (
            <div className="flex flex-wrap items-center gap-2">{controls}</div>
          ) : null}
        </header>
        <div className="mt-6 space-y-6">{children}</div>
      </div>
    </div>
  );
}
