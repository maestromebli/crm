import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import type { NextActionItem } from "../executive-types";
import { cn } from "../../../lib/utils";

type NextBestActionsCardProps = {
  items: NextActionItem[];
};

const urgencyStyle = {
  high: "border-rose-200/80 bg-rose-50/80 text-rose-900",
  medium: "border-amber-200/80 bg-amber-50/80 text-amber-900",
  low: "border-[var(--enver-border)] bg-[var(--enver-surface)] text-[var(--enver-text)]",
};

export function NextBestActionsCard({ items }: NextBestActionsCardProps) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5">
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Наступні кроки
        </h2>
        <p className="mt-2 text-sm text-[var(--enver-text-muted)]">
          Критичних дій не виявлено — підтримуйте ритм комунікацій.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" aria-hidden />
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Пріоритетні дії
        </h2>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((a) => (
          <li key={a.id}>
            <div
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                urgencyStyle[a.urgency],
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs opacity-80">{a.reason}</p>
              </div>
              <Link
                href={a.href}
                className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-black/5 transition hover:bg-white"
              >
                {a.ctaLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
