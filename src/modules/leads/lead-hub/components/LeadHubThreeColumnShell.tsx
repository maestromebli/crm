"use client";

import type { ReactNode } from "react";
import { cn } from "../../../../lib/utils";

type Props = {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  className?: string;
};

/**
 * Фіксовані колонки 280 / flex / 320 — преміум CRM layout (desktop).
 */
export function LeadHubThreeColumnShell({
  left,
  center,
  right,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-0 lg:flex-row lg:items-stretch",
        className,
      )}
    >
      <aside
        className="hidden w-[280px] shrink-0 flex-col border-[var(--enver-border)] bg-[var(--enver-surface)] lg:flex lg:border-r"
        aria-label="Список лідів"
      >
        {left}
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto bg-[var(--enver-bg)]">
        <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
          {center}
        </div>
      </section>

      <aside
        className="hidden w-[320px] shrink-0 flex-col border-[var(--enver-border)] bg-[var(--enver-surface)] lg:flex lg:border-l"
        aria-label="AI та наступний крок"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {right}
        </div>
      </aside>
    </div>
  );
}
