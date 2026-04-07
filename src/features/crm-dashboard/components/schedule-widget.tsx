import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { SchedulePreview } from "../executive-types";

type ScheduleWidgetProps = {
  data: SchedulePreview | null;
};

export function ScheduleWidget({ data }: ScheduleWidgetProps) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--enver-border)] p-4 text-sm text-[var(--enver-text-muted)]">
        Календар недоступний.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4 shadow-[var(--enver-shadow)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-[var(--enver-accent)]" />
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">
            Сьогодні
          </h2>
        </div>
        {data.overdueTasks > 0 ? (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
            Задач прострочено: {data.overdueTasks}
          </span>
        ) : null}
      </div>
      <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
        {data.today.length === 0 ? (
          <li className="text-[var(--enver-text-muted)]">
            Подій на сьогодні немає.
          </li>
        ) : (
          data.today.map((e) => (
            <li
              key={e.id}
              className="flex gap-2 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)]/60 px-2 py-1.5"
            >
              <span className="shrink-0 tabular-nums text-[var(--enver-muted)]">
                {e.time}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-[var(--enver-text)]">{e.title}</p>
                <p className="text-[11px] text-[var(--enver-text-muted)]">
                  {e.type} · {e.context}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
      {data.nextEvent ? (
        <div className="mt-3 rounded-xl border border-[var(--enver-border)] bg-[var(--enver-bg)] px-3 py-2 text-xs">
          <p className="text-[var(--enver-muted)]">Наступна подія</p>
          <p className="font-medium text-[var(--enver-text)]">
            {data.nextEvent.time} — {data.nextEvent.title}
          </p>
        </div>
      ) : null}
      <Link
        href="/calendar"
        className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] py-2 text-xs font-semibold text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
      >
        Відкрити календар
      </Link>
    </div>
  );
}
