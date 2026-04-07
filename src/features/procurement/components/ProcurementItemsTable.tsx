import { CurrencyCell } from "../../../components/shared/CurrencyCell";
import { DataTableShell } from "../../../components/shared/DataTableShell";
import type { ProcurementItem } from "../types/models";
import { ProcurementStatusBadge } from "./ProcurementStatusBadge";

type Props = {
  rows: ProcurementItem[];
  projectNameById: Record<string, string>;
  categoryNameById: Record<string, string>;
  supplierNameById: Record<string, string>;
};

export function ProcurementItemsTable({
  rows,
  projectNameById,
  categoryNameById,
  supplierNameById,
}: Props) {
  return (
    <DataTableShell
      columns={[
        "Проєкт",
        "Категорія",
        "Позиція",
        "Артикул",
        "Qty",
        "План / од.",
        "План / всього",
        "Факт / од.",
        "Факт / всього",
        "Постачальник",
        "Статус",
        "Відхилення",
      ]}
    >
      {rows.map((r) => (
        <tr key={r.id} className="border-t border-slate-100">
          <td className="px-3 py-2 text-slate-800">{projectNameById[r.projectId] ?? r.projectId}</td>
          <td className="px-3 py-2 text-slate-700">{categoryNameById[r.categoryId] ?? r.categoryId}</td>
          <td className="px-3 py-2 text-slate-700">{r.name}</td>
          <td className="px-3 py-2 text-slate-600">{r.article ?? "—"}</td>
          <td className="px-3 py-2 text-slate-700">{r.qty.toFixed(2)}</td>
          <td className="px-3 py-2"><CurrencyCell value={r.plannedUnitCost} /></td>
          <td className="px-3 py-2"><CurrencyCell value={r.plannedTotalCost} /></td>
          <td className="px-3 py-2"><CurrencyCell value={r.actualUnitCost ?? 0} /></td>
          <td className="px-3 py-2"><CurrencyCell value={r.actualTotalCost ?? 0} /></td>
          <td className="px-3 py-2 text-slate-700">{(r.supplierId && supplierNameById[r.supplierId]) || "—"}</td>
          <td className="px-3 py-2"><ProcurementStatusBadge status={r.status} /></td>
          <td className="px-3 py-2">
            <CurrencyCell
              value={(r.actualTotalCost ?? 0) - r.plannedTotalCost}
              tone={(r.actualTotalCost ?? 0) > r.plannedTotalCost ? "expense" : "income"}
            />
          </td>
        </tr>
      ))}
    </DataTableShell>
  );
}

