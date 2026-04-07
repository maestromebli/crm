import Link from "next/link";
import { CurrencyCell } from "../../../components/shared/CurrencyCell";
import { DataTableShell } from "../../../components/shared/DataTableShell";
import type { ProcurementItem } from "../types/models";
import { isProcurementLineOverdue } from "../lib/deadlines";
import { ProcurementStatusBadge } from "./ProcurementStatusBadge";

type Props = {
  rows: ProcurementItem[];
  projectNameById: Record<string, string>;
  categoryNameById: Record<string, string>;
  supplierNameById: Record<string, string>;
  /** Дата «потрібно до» з батьківської заявки (якщо передано). */
  neededByDateByRequestId?: Record<string, string | null>;
};

export function ProcurementItemsTable({
  rows,
  projectNameById,
  categoryNameById,
  supplierNameById,
  neededByDateByRequestId,
}: Props) {
  const showDeadline = neededByDateByRequestId != null;
  const columns = showDeadline
    ? [
        "Проєкт",
        "Потрібно до",
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
      ]
    : [
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
      ];

  return (
    <DataTableShell columns={columns}>
      {rows.map((r) => {
        const neededRaw = neededByDateByRequestId?.[r.requestId] ?? null;
        const overdue = neededRaw
          ? isProcurementLineOverdue(neededRaw, r.status)
          : false;
        const deadlineCell =
          neededRaw === null || neededRaw === undefined ? (
            <span className="text-slate-400">—</span>
          ) : (
            <span
              className={
                overdue
                  ? "font-medium text-rose-700"
                  : "text-slate-700"
              }
              title={overdue ? "Дедлайн заявки минув, рядок ще відкритий" : undefined}
            >
              {new Date(neededRaw).toLocaleDateString("uk-UA")}
            </span>
          );

        return (
          <tr key={r.id} className="border-t border-slate-100">
            <td className="px-3 py-2 text-slate-800">
              <Link
                className="text-sky-800 underline-offset-2 hover:text-sky-950 hover:underline"
                href={`/crm/procurement/${r.projectId}`}
              >
                {projectNameById[r.projectId] ?? r.projectId}
              </Link>
            </td>
            {showDeadline ? <td className="px-3 py-2 whitespace-nowrap">{deadlineCell}</td> : null}
            <td className="px-3 py-2 text-slate-700">{categoryNameById[r.categoryId] ?? r.categoryId}</td>
            <td className="px-3 py-2 text-slate-700">{r.name}</td>
            <td className="px-3 py-2 text-slate-600">{r.article ?? "—"}</td>
            <td className="px-3 py-2 text-slate-700">{r.qty.toFixed(2)}</td>
            <td className="px-3 py-2">
              <CurrencyCell value={r.plannedUnitCost} />
            </td>
            <td className="px-3 py-2">
              <CurrencyCell value={r.plannedTotalCost} />
            </td>
            <td className="px-3 py-2">
              <CurrencyCell value={r.actualUnitCost ?? 0} />
            </td>
            <td className="px-3 py-2">
              <CurrencyCell value={r.actualTotalCost ?? 0} />
            </td>
            <td className="px-3 py-2 text-slate-700">{(r.supplierId && supplierNameById[r.supplierId]) || "—"}</td>
            <td className="px-3 py-2">
              <ProcurementStatusBadge status={r.status} />
            </td>
            <td className="px-3 py-2">
              <CurrencyCell
                value={(r.actualTotalCost ?? 0) - r.plannedTotalCost}
                tone={(r.actualTotalCost ?? 0) > r.plannedTotalCost ? "expense" : "income"}
              />
            </td>
          </tr>
        );
      })}
    </DataTableShell>
  );
}
