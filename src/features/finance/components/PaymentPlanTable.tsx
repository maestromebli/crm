import { DataTableShell } from "../../../components/shared/DataTableShell";
import { CurrencyCell } from "../../../components/shared/CurrencyCell";
import { FinanceStatusBadge } from "./FinanceStatusBadge";
import type { ProjectPaymentPlan } from "../types/models";

export function PaymentPlanTable({ rows }: { rows: ProjectPaymentPlan[] }) {
  return (
    <DataTableShell columns={["Назва", "Дата", "План", "Оплачено", "Статус", "Коментар"]}>
      {rows.map((r) => (
        <tr key={r.id} className="border-t border-slate-100">
          <td className="px-3 py-2 text-slate-800">{r.title}</td>
          <td className="px-3 py-2 text-slate-600">{new Date(r.plannedDate).toLocaleDateString("uk-UA")}</td>
          <td className="px-3 py-2"><CurrencyCell value={r.plannedAmount} /></td>
          <td className="px-3 py-2"><CurrencyCell value={r.paidAmount} /></td>
          <td className="px-3 py-2"><FinanceStatusBadge status={r.status} /></td>
          <td className="px-3 py-2 text-slate-600">{r.comment || "—"}</td>
        </tr>
      ))}
    </DataTableShell>
  );
}

