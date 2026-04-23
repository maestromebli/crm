"use client";

type Props = {
  dealId: string;
};

/** Швидкі посилання в модуль закупівель по поточній замовленні. */
export function DealProcurementLink({ dealId: _dealId }: Props) {
  return (
    <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/55 px-3 py-2 text-sm shadow-sm shadow-slate-900/5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/90">
        Закупівлі
      </p>
      <p className="text-[12px] text-emerald-900/90">
        Перехід до закупівель доступний лише через бокове меню.
      </p>
    </div>
  );
}
