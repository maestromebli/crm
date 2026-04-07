import type { FinanceKpi } from "../types/models";
import { SummaryCard } from "../../../components/shared/SummaryCard";

function money(v: number): string {
  return v.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FinanceKpiCards({ kpi }: { kpi: FinanceKpi }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ключові показники портфеля</p>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <SummaryCard label="Дохід" value={money(kpi.revenue)} tone="neutral" />
      <SummaryCard label="Отримано" value={money(kpi.received)} tone="income" />
      <SummaryCard label="Борг клієнтів" value={money(kpi.clientDebt)} tone="warning" />
      <SummaryCard label="Витрати" value={money(kpi.expenses)} tone="expense" />
      <SummaryCard label="Валовий прибуток" value={money(kpi.grossProfit)} tone="neutral" />
      <SummaryCard label="Чистий прибуток" value={money(kpi.netProfit)} tone={kpi.netProfit >= 0 ? "income" : "expense"} />
      </div>
    </div>
  );
}

