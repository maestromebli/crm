import Link from "next/link";
import { DataTableShell } from "../../../components/shared/DataTableShell";
import { CurrencyCell } from "../../../components/shared/CurrencyCell";
import { PaymentPlanStatusBadge } from "./FinanceStatusBadge";
import type { ProjectPaymentPlan } from "../types/models";

type Props = {
  rows: ProjectPaymentPlan[];
  projectNameById?: Record<string, string>;
};

export function PaymentPlanTable({ rows, projectNameById }: Props) {
  const showProject = Boolean(projectNameById && Object.keys(projectNameById).length > 0);
  const columns = showProject
    ? ["Проєкт", "Назва", "Дата", "План", "Оплачено", "Залишок", "Статус", "Коментар"]
    : ["Назва", "Дата", "План", "Оплачено", "Залишок", "Статус", "Коментар"];

  return (
    <DataTableShell columns={columns}>
      {rows.map((r) => {
        const remaining = Math.max(r.plannedAmount - r.paidAmount, 0);
        return (
          <tr key={r.id} className="border-t border-slate-100">
            {showProject ? (
              <td className="px-3 py-2 text-slate-800">
                <Link
                  href={`/crm/finance/${r.projectId}`}
                  className="font-medium text-blue-700 hover:underline"
                >
                  {projectNameById?.[r.projectId] ?? r.projectId}
                </Link>
              </td>
            ) : null}
            <td className="px-3 py-2 text-slate-800">{r.title}</td>
            <td className="px-3 py-2 text-slate-600">{new Date(r.plannedDate).toLocaleDateString("uk-UA")}</td>
            <td className="px-3 py-2">
              <CurrencyCell value={r.plannedAmount} />
            </td>
            <td className="px-3 py-2">
              <CurrencyCell value={r.paidAmount} />
            </td>
            <td className="px-3 py-2">
              <CurrencyCell value={remaining} tone={remaining > 0 ? "expense" : "income"} />
            </td>
            <td className="px-3 py-2">
              <PaymentPlanStatusBadge status={r.status} />
            </td>
            <td className="px-3 py-2 text-slate-600">{r.comment || "—"}</td>
          </tr>
        );
      })}
    </DataTableShell>
  );
}
