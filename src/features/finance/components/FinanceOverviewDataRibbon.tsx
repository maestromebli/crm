import type { FinanceOverviewDataSource } from "../types/overview";

type Props = {
  source: FinanceOverviewDataSource;
  referenceDay: string;
  transactionSampleSize?: number;
  /** Скільки метрик мають збережені уточнення в БД (початковий зріз). */
  executiveKpiNotesSaved?: number;
};

/** Контекст зрізу: джерело даних і референсна дата для SLA/прострочень. */
export function FinanceOverviewDataRibbon({
  source,
  referenceDay,
  transactionSampleSize,
  executiveKpiNotesSaved,
}: Props) {
  const srcLabel = (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-900">PostgreSQL</span>
  );

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600"
      role="status"
    >
      <span title="Звідки беруться цифри на цій сторінці">Джерело: {srcLabel}</span>
      <span className="hidden sm:inline text-slate-300" aria-hidden>
        ·
      </span>
      <span title="Поріг для позначення прострочених платежів у графіку та алертах">
        Референсна дата (прострочення графіку):{" "}
        <time className="font-mono font-medium text-slate-800" dateTime={referenceDay}>
          {referenceDay}
        </time>
      </span>
      {typeof transactionSampleSize === "number" ? (
        <>
          <span className="hidden md:inline text-slate-300" aria-hidden>
            ·
          </span>
          <span
            className="text-slate-500"
            title="Скільки рядків транзакцій підвантажено для таблиць і експорту на цій сторінці"
          >
            Транзакцій для екрану та CSV: {transactionSampleSize}
          </span>
        </>
      ) : null}
      {typeof executiveKpiNotesSaved === "number" ? (
        <>
          <span className="hidden lg:inline text-slate-300" aria-hidden>
            ·
          </span>
          <span
            className="text-slate-500"
            title="Скільки верхніх KPI мають збережені уточнення в базі (з 10 метрик)"
          >
            KPI з нотатками (БД): <strong className="text-slate-800">{executiveKpiNotesSaved}</strong>/10
          </span>
        </>
      ) : null}
    </div>
  );
}
