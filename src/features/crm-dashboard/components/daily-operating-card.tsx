import Link from "next/link";
import { CalendarClock, CheckSquare, ClipboardList } from "lucide-react";
import type { DailyOperatingSnapshot } from "../executive-types";

type DailyOperatingCardProps = {
  data: DailyOperatingSnapshot;
};

export function DailyOperatingCard({ data }: DailyOperatingCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-sky-600" aria-hidden />
        <h2 className="text-sm font-semibold text-[var(--enver-text)]">
          Daily Operating System
        </h2>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-2">
          <p className="text-[var(--enver-text-muted)]">Overdue задачі</p>
          <p className="text-base font-semibold text-[var(--enver-text)]">
            {data.workload.overdueTasks}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-2">
          <p className="text-[var(--enver-text-muted)]">Події сьогодні</p>
          <p className="text-base font-semibold text-[var(--enver-text)]">
            {data.workload.meetingsToday}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-2">
          <p className="text-[var(--enver-text-muted)]">Stale ліди</p>
          <p className="text-base font-semibold text-[var(--enver-text)]">
            {data.workload.staleLeads}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-2">
          <p className="text-[var(--enver-text-muted)]">Затримки виробництва</p>
          <p className="text-base font-semibold text-[var(--enver-text)]">
            {data.workload.delayedProduction}
          </p>
        </div>
      </div>

      {data.priorities.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {data.priorities.slice(0, 3).map((p) => (
            <li key={p.id} className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)]/60 px-3 py-2">
              <p className="text-sm font-medium text-[var(--enver-text)]">{p.title}</p>
              <p className="text-xs text-[var(--enver-text-muted)]">{p.reason}</p>
              <Link
                href={p.href}
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--enver-accent-hover)] hover:underline"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                {p.ctaLabel}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[var(--enver-text-muted)]">
          Пріоритетів на сьогодні не знайдено.
        </p>
      )}

      {data.weakManagers.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
          Слабкі менеджери дня:{" "}
          {data.weakManagers
            .slice(0, 2)
            .map((m) => `${m.name} (${m.score})`)
            .join(", ")}
        </div>
      ) : null}

      <Link
        href="/tasks/today"
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--enver-accent-hover)] hover:underline"
      >
        <CheckSquare className="h-3.5 w-3.5" />
        Відкрити пріоритети дня
      </Link>
    </div>
  );
}
