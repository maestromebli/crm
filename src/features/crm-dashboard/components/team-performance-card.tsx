import type { TeamPerformanceBlock } from "../executive-types";

type TeamPerformanceCardProps = {
  data: TeamPerformanceBlock | null;
};

export function TeamPerformanceCard({ data }: TeamPerformanceCardProps) {
  if (!data) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]">
      <h2 className="text-sm font-semibold text-[var(--enver-text)]">
        Команда
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-2">
          <p className="text-[11px] text-[var(--enver-muted)]">Угоди в роботі</p>
          <p className="text-lg font-semibold tabular-nums">{data.dealsInWork}</p>
        </div>
        <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-2">
          <p className="text-[11px] text-[var(--enver-muted)]">Прострочені задачі</p>
          <p className="text-lg font-semibold tabular-nums text-rose-600">
            {data.tasksOverdue}
          </p>
        </div>
        {data.avgConversionPct != null ? (
          <div className="col-span-2 rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] px-3 py-2">
            <p className="text-[11px] text-[var(--enver-muted)]">
              Середня конверсія (30 д)
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {data.avgConversionPct}%
            </p>
          </div>
        ) : null}
      </div>
      <div className="mt-4">
        <p className="text-[11px] font-medium uppercase text-[var(--enver-muted)]">
          Лідерборд
        </p>
        <ul className="mt-2 space-y-1.5">
          {data.leaderboard.map((m, i) => (
            <li
              key={m.userId}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--enver-hover)]"
            >
              <span className="text-[var(--enver-text-muted)]">{i + 1}.</span>
              <span className="flex-1 truncate font-medium text-[var(--enver-text)]">
                {m.name}
              </span>
              <span className="tabular-nums text-[var(--enver-text-muted)]">
                {m.dealsOpen} / {m.tasksOpen} / {m.conversions30d}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] text-[var(--enver-muted)]">
          Формат: угоди / задачі / виграші за 30 днів
        </p>
      </div>
    </div>
  );
}
