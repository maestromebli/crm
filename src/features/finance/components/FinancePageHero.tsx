import type { ReactNode } from "react";
import { FinanceDataSourceBadge } from "./FinanceDataSourceBadge";

type Props = {
  /** Короткий контекст, напр. «Фінанси · Податки». */
  eyebrow?: string;
  title: string;
  /** 1–2 речення: що на сторінці і навіщо вона бухгалтеру. */
  description: string;
  dataSource?: "db" | "mock";
  /** Додаткова технічна примітка під бейджем (джерело таблиць, оціночні коефіцієнти). */
  footnote?: string;
  actionsSlot?: ReactNode;
};

/**
 * Єдиний «герой»-блок для підрозділів фінансів: заголовок, зрозумілий опис, бейдж джерела даних.
 */
export function FinancePageHero({
  eyebrow = "Фінансовий модуль",
  title,
  description,
  dataSource,
  footnote,
  actionsSlot,
}: Props) {
  return (
    <header className="relative overflow-hidden rounded-xl border border-[var(--enver-border)] bg-gradient-to-br from-[var(--enver-card)] via-[#1a1b22] to-[#221f35] p-5 shadow-[var(--enver-shadow)] sm:p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-[var(--enver-accent)]/15 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--enver-accent-hover)]">{eyebrow}</p>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--enver-text)] sm:text-2xl">{title}</h1>
          <p className="text-sm leading-relaxed text-[var(--enver-text-muted)]">{description}</p>
          {dataSource != null ? (
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <FinanceDataSourceBadge source={dataSource} />
              {footnote ? (
                <span className="text-xs leading-snug text-[var(--enver-muted)] sm:max-w-xl">{footnote}</span>
              ) : null}
            </div>
          ) : footnote ? (
            <p className="pt-1 text-xs leading-relaxed text-[var(--enver-muted)]">{footnote}</p>
          ) : null}
        </div>
        {actionsSlot ? (
          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">{actionsSlot}</div>
        ) : null}
      </div>
    </header>
  );
}
