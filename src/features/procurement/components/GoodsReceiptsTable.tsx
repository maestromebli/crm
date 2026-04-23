import { DataTableShell } from "../../../components/shared/DataTableShell";
import type { GoodsReceipt } from "../types/models";

type Props = {
  rows: GoodsReceipt[];
  orderNumberById: Record<string, string>;
  projectNameById: Record<string, string>;
};

export function GoodsReceiptsTable({ rows, orderNumberById, projectNameById }: Props) {
  return (
    <DataTableShell columns={["Дата", "Замовлення", "Проєкт", "Отримано", "Прийнято", "Брак", "Коментар"]}>
      {rows.map((r) => (
        <tr key={r.id} className="border-t border-slate-100">
          <td className="px-3 py-2 text-slate-700">{new Date(r.receiptDate).toLocaleDateString("uk-UA")}</td>
          <td className="px-3 py-2 text-slate-700">{orderNumberById[r.purchaseOrderId] ?? r.purchaseOrderId}</td>
          <td className="px-3 py-2 text-slate-800">
            {projectNameById[r.projectId] ?? r.projectId}
          </td>
          <td className="px-3 py-2 text-slate-700">—</td>
          <td className="px-3 py-2 text-slate-700">—</td>
          <td className="px-3 py-2 text-slate-700">—</td>
          <td className="px-3 py-2 text-slate-600">{r.comment || "—"}</td>
        </tr>
      ))}
    </DataTableShell>
  );
}

