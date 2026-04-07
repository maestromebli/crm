import type { CashflowPreview } from "../executive-types";

type CashflowCardProps = {
  data: CashflowPreview | null;
};

export function CashflowCard({ data }: CashflowCardProps) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--enver-border)] bg-[var(--enver-surface)]/50 p-4">
        <p className="text-xs text-[var(--enver-text-muted)]">
          Касовий зріз недоступний для вашої ролі або немає даних.
        </p>
      </div>
    );
  }

  const fmt = (n: number) =>
    `${Math.round(n).toLocaleString("uk-UA")} ${data.currency}`;

  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-gradient-to-br from-[var(--enver-card)] to-[var(--enver-surface)] p-4 shadow-[var(--enver-shadow)]">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
        Касовий превʼю
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-[11px] text-[var(--enver-text-muted)]">Надійшло</p>
          <p className="font-semibold tabular-nums text-emerald-700">
            {fmt(data.received)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--enver-text-muted)]">Витрачено</p>
          <p className="font-semibold tabular-nums text-rose-700">
            {fmt(data.outgoing)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--enver-text-muted)]">Баланс</p>
          <p className="font-semibold tabular-nums text-[var(--enver-text)]">
            {fmt(data.balance)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--enver-text-muted)]">
            Прогноз 7 днів
          </p>
          <p className="font-semibold tabular-nums text-[var(--enver-text)]">
            {fmt(data.forecast7d)}
          </p>
        </div>
      </div>
    </div>
  );
}
