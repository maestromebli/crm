import Link from "next/link";
import type { ProjectFinancialSummary } from "../../types/models";
import { SummaryCard } from "../../../../components/shared/SummaryCard";

function money(v: number): string {
  return v.toLocaleString("uk-UA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type Props = {
  projectId: string;
  projectCode: string;
  summary: ProjectFinancialSummary;
};

/**
 * Компактні віджети для Hub замовлення/проєкту: борги, шари закупівель, маржа, прострочення.
 */
export function ProjectFinanceWidgets({ projectId, projectCode, summary }: Props) {
  const s = summary;
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-[var(--enver-card)] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-[var(--enver-text)]">Фінанси · {projectCode}</h3>
        <Link
          href={`/crm/finance/${projectId}`}
          className="text-[11px] font-medium text-blue-600 hover:underline"
        >
          Робоче місце
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        <SummaryCard label="Договір" value={money(s.contractAmount)} />
        <SummaryCard label="Отримано" value={money(s.receivedFromClient)} tone="income" />
        <SummaryCard label="Борг клієнта" value={money(s.clientDebt)} tone="warning" />
        <SummaryCard label="Кредиторка (PO)" value={money(s.supplierDebt)} tone="expense" />
        <SummaryCard label="Грошові витрати" value={money(s.actualExpenses)} tone="expense" />
        <SummaryCard label="План закупівель" value={money(s.procurementPlanned)} />
        <SummaryCard label="Зобовʼязання PO" value={money(s.procurementCommitted)} />
        <SummaryCard label="Отримано по PO" value={money(s.procurementReceivedValue)} tone="income" />
        <SummaryCard
          label="Чистий прибуток"
          value={money(s.netProfit)}
          tone={s.netProfit >= 0 ? "income" : "expense"}
        />
        {s.overduePlanCount > 0 ? (
          <SummaryCard
            label="Прострочено графік"
            value={`${s.overduePlanCount} р.`}
            tone="warning"
            hint={money(s.overduePlanAmount)}
          />
        ) : null}
      </div>
    </div>
  );
}
