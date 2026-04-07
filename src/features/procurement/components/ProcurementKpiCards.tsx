import { SummaryCard } from "../../../components/shared/SummaryCard";

type Props = {
  kpi: {
    planned: number;
    actual: number;
    ordered: number;
    paidSupplier: number;
    awaitingDelivery: number;
    overrun: number;
  };
};

function money(v: number): string {
  return v.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ProcurementKpiCards({ kpi }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <SummaryCard label="План закупок" value={money(kpi.planned)} tone="info" />
      <SummaryCard label="Факт закупок" value={money(kpi.actual)} tone="neutral" />
      <SummaryCard label="Замовлено" value={money(kpi.ordered)} tone="neutral" />
      <SummaryCard label="Оплачено постачальникам" value={money(kpi.paidSupplier)} tone="income" />
      <SummaryCard label="Очікується доставка" value={money(kpi.awaitingDelivery)} tone="warning" />
      <SummaryCard label="Перевищення бюджету" value={money(kpi.overrun)} tone={kpi.overrun > 0 ? "expense" : "income"} />
    </div>
  );
}

