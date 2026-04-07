"use client";

/**
 * Три сегменти як на референсі: поточна сума → перехід → нова сума.
 */
export function EstimateComparisonStrip({
  currentVersion,
  currentTotal,
  newVersion,
  newTotal,
  hasChanges,
}: {
  currentVersion: number;
  currentTotal: number | null;
  newVersion: number;
  newTotal: number | null;
  hasChanges: boolean;
}) {
  return (
    <div className="border-b border-slate-200 bg-[var(--enver-card)]">
      <div className="mx-auto grid max-w-[1800px] grid-cols-1 divide-y divide-slate-200 md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="bg-slate-50/80 px-4 py-4 text-center md:px-6 md:text-left">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Поточна
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">
            Смета v{currentVersion}
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums text-[var(--enver-text)] md:text-2xl">
            {currentTotal != null
              ? `${currentTotal.toLocaleString("uk-UA")} грн`
              : "—"}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center bg-[var(--enver-card)] px-4 py-3 md:py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Перегляд змін
          </p>
          <div className="mt-1 flex items-center gap-3 text-slate-300">
            <span className="text-2xl font-light" aria-hidden>
              →
            </span>
            {hasChanges ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-900">
                Є зміни
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">Без змін</span>
            )}
          </div>
        </div>
        <div className="bg-emerald-50/50 px-4 py-4 text-center md:px-6 md:text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800/80">
            Нова
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--enver-text)]">
            Смета v{newVersion}
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums text-emerald-700 md:text-2xl">
            {newTotal != null ? `${newTotal.toLocaleString("uk-UA")} грн` : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
