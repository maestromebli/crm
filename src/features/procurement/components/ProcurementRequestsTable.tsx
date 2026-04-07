import { CurrencyCell } from "../../../components/shared/CurrencyCell";
import { DataTableShell } from "../../../components/shared/DataTableShell";
import type { ProcurementRequest } from "../types/models";
import { ProcurementStatusBadge } from "./ProcurementStatusBadge";

type Props = {
  rows: ProcurementRequest[];
  projectNameById: Record<string, string>;
};

export function ProcurementRequestsTable({ rows, projectNameById }: Props) {
  return (
    <DataTableShell columns={["№", "Проєкт", "Ініціатор", "Статус", "Потрібно до", "Бюджет", "Факт", "Відхилення", "Коментар"]}>
      {rows.map((r, idx) => (
        <tr key={r.id} className="border-t border-slate-100">
          <td className="px-3 py-2 text-slate-700">{idx + 1}</td>
          <td className="px-3 py-2 text-slate-800">{projectNameById[r.projectId] ?? r.projectId}</td>
          <td className="px-3 py-2 text-slate-700">{r.requestedById ?? "—"}</td>
          <td className="px-3 py-2"><ProcurementStatusBadge status={r.status} /></td>
          <td className="px-3 py-2 text-slate-600">{r.neededByDate ? new Date(r.neededByDate).toLocaleDateString("uk-UA") : "—"}</td>
          <td className="px-3 py-2"><CurrencyCell value={r.budgetTotal} /></td>
          <td className="px-3 py-2"><CurrencyCell value={r.actualTotal} /></td>
          <td className="px-3 py-2"><CurrencyCell value={r.actualTotal - r.budgetTotal} tone={r.actualTotal > r.budgetTotal ? "expense" : "income"} /></td>
          <td className="px-3 py-2 text-slate-600">{r.comment || "—"}</td>
        </tr>
      ))}
    </DataTableShell>
  );
}

