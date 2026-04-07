"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";

const FILTERS: { id: string; href: string; label: string }[] = [
  { id: "all", href: "/leads", label: "Усі" },
  { id: "new", href: "/leads/new", label: "Нові" },
  { id: "no-response", href: "/leads/no-response", label: "Без відповіді" },
  { id: "no-next-step", href: "/leads/no-next-step", label: "Без кроку" },
  { id: "unassigned", href: "/leads/unassigned", label: "На розподіл" },
  { id: "mine", href: "/leads/mine", label: "Мої" },
  { id: "overdue", href: "/leads/overdue", label: "Прострочені" },
  { id: "duplicates", href: "/leads/duplicates", label: "Дублі" },
];

const MORE_FILTERS: { id: string; href: string; label: string }[] = [
  { id: "qualified", href: "/leads/qualified", label: "Розрахунок" },
  { id: "re-contact", href: "/leads/re-contact", label: "Повторний контакт" },
  { id: "converted", href: "/leads/converted", label: "Конвертовані" },
  { id: "lost", href: "/leads/lost", label: "Архів" },
  { id: "sources", href: "/leads/sources", label: "За джерелом" },
  { id: "pipeline", href: "/leads/pipeline", label: "Воронка" },
];

type LeadFiltersProps = {
  className?: string;
};

export function LeadFilters({ className }: LeadFiltersProps) {
  const pathname = usePathname();

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2.5 shadow-sm">
        <span className="mr-0.5 self-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Черга
        </span>
        {FILTERS.map((f) => {
          const active =
            pathname === f.href ||
            (f.id === "all" && pathname === "/leads");
          return (
            <Link
              key={f.href}
              href={f.href}
              className={cn(
                "rounded-full px-2.5 py-1.5 text-[11px] font-medium transition",
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-slate-200/90 bg-slate-50/80 px-3 py-2">
        <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Ще
        </span>
        {MORE_FILTERS.map((f) => {
          const active = pathname === f.href;
          return (
            <Link
              key={f.href}
              href={f.href}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                active
                  ? "bg-[var(--enver-card)] text-[var(--enver-text)] ring-1 ring-slate-300"
                  : "text-slate-600 hover:bg-[var(--enver-card)] hover:text-[var(--enver-text)]",
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
