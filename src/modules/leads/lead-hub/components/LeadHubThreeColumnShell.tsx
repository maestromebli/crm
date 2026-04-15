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
 * Фіксовані колонки 176 / flex / 192 для більшого простору центру (desktop).
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
        "lead-hub-shell relative flex min-h-0 flex-1 flex-col gap-0 overflow-x-hidden lg:flex-row lg:items-stretch",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 bg-gradient-to-b from-indigo-200/45 via-sky-100/25 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-8 z-0 h-44 w-44 rounded-full bg-indigo-300/20 blur-3xl"
      />
      <aside
        className="relative z-10 hidden w-[176px] shrink-0 flex-col border-[var(--enver-border)]/80 bg-[var(--enver-surface)]/88 shadow-[inset_-1px_0_0_0_rgba(148,163,184,0.18)] backdrop-blur-xl lg:flex lg:border-r xl:w-[192px]"
        aria-label="Етапи та контроль ліда"
      >
        {left}
      </aside>

      <section className="relative z-10 min-w-0 flex-1 overflow-y-auto bg-[var(--enver-bg)]/92">
        <div className="w-full max-w-none px-3 py-6 md:px-4 lg:py-7">
          {center}
        </div>
      </section>

      <aside
        className="relative z-10 hidden w-[192px] shrink-0 flex-col border-[var(--enver-border)]/80 bg-[var(--enver-surface)]/88 shadow-[inset_1px_0_0_0_rgba(148,163,184,0.18)] backdrop-blur-xl lg:flex lg:border-l xl:w-[208px]"
        aria-label="Смарт-панель та швидкі дії"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-5">
          {right}
        </div>
      </aside>
    </div>
  );
}
