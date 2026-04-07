import { CurrencyCell } from "../../../components/shared/CurrencyCell";
import { DataTableShell } from "../../../components/shared/DataTableShell";
import type { PurchaseOrder } from "../types/models";
import { ProcurementStatusBadge } from "./ProcurementStatusBadge";

type Props = {
  rows: PurchaseOrder[];
  supplierNameById: Record<string, string>;
  projectNameById: Record<string, string>;
};

export function PurchaseOrdersTable({ rows, supplierNameById, projectNameById }: Props) {
  return (
    <DataTableShell columns={["№ замовлення", "Постачальник", "Проєкт", "Дата", "Очікується", "Сума", "Статус"]}>
      {rows.map((r) => (
        <tr key={r.id} className="border-t border-slate-100">
          <td className="px-3 py-2 text-slate-800">{r.orderNumber}</td>
          <td className="px-3 py-2 text-slate-700">{supplierNameById[r.supplierId] ?? r.supplierId}</td>
          <td className="px-3 py-2 text-slate-700">{projectNameById[r.projectId] ?? r.projectId}</td>
          <td className="px-3 py-2 text-slate-600">{new Date(r.orderDate).toLocaleDateString("uk-UA")}</td>
          <td className="px-3 py-2 text-slate-600">{r.expectedDate ? new Date(r.expectedDate).toLocaleDateString("uk-UA") : "—"}</td>
          <td className="px-3 py-2"><CurrencyCell value={r.totalAmount} /></td>
          <td className="px-3 py-2"><ProcurementStatusBadge status={r.status} /></td>
        </tr>
      ))}
    </DataTableShell>
  );
}

