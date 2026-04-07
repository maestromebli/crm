"use client";

import { useRouter } from "next/navigation";
import { SummaryCard } from "../../../components/shared/SummaryCard";

type Props = {
  kpi: {
    planned: number;
    actual: number;
    ordered: number;
    committed: number;
    receivedValue: number;
    paidSupplier: number;
    awaitingDelivery: number;
    overrun: number;
    openCommitmentGap: number;
  };
};

function money(v: number): string {
  return v.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** KPI закупівель: перехід у модуль «Закупівлі» з контекстом у query (скрол/фільтри — за бажанням). */
export function ProcurementKpiCards({ kpi }: Props) {
  const router = useRouter();
  const go = (kpiKey: string) => () => router.push(`/crm/procurement?kpi=${encodeURIComponent(kpiKey)}`);

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--enver-muted)]">
        Закупівельний портфель
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SummaryCard label="План закупівель" value={money(kpi.planned)} tone="neutral" hint="Позиції" onClick={go("planned")} />
        <SummaryCard label="Факт позицій" value={money(kpi.actual)} tone="neutral" hint="Accrual" onClick={go("actual")} />
        <SummaryCard label="Замовлено (сума PO)" value={money(kpi.ordered)} tone="neutral" onClick={go("ordered")} />
        <SummaryCard label="Зобовʼязання PO" value={money(kpi.committed)} tone="neutral" hint="Без чернеток" onClick={go("committed")} />
        <SummaryCard label="Отримано по PO" value={money(kpi.receivedValue)} tone="income" hint="qty×ціна" onClick={go("received")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SummaryCard label="Оплачено (статус PO)" value={money(kpi.paidSupplier)} tone="income" hint="Не cash-звіт" onClick={go("paid")} />
        <SummaryCard label="Очікується доставка" value={money(kpi.awaitingDelivery)} tone="warning" onClick={go("awaiting")} />
        <SummaryCard label="Різниця комітмент − поставка" value={money(kpi.openCommitmentGap)} tone="warning" onClick={go("gap")} />
        <SummaryCard
          label="Перевищення бюджету"
          value={money(kpi.overrun)}
          tone={kpi.overrun > 0 ? "expense" : "income"}
          onClick={go("overrun")}
        />
      </div>
    </div>
  );
}
