"use client";

import { CurrencyCell } from "@/components/shared/CurrencyCell";
import { DataTableShell } from "@/components/shared/DataTableShell";
import type { FinanceTransaction } from "../types/models";
import { FinanceTransactionStatusBadge } from "./FinanceStatusBadge";
import { counterpartyTypeUa, financeTransactionTypeUa } from "../lib/labels";

type Props = {
  rows: FinanceTransaction[];
  projectNameById: Record<string, string>;
  categoryNameById: Record<string, string>;
  /** Назва та тип рахунку (див. buildAccountLabelById). */
  accountLabelById?: Record<string, string>;
  /** Підпис обʼєкта (адреса монтажу), якщо колонка потрібна. */
  objectNameById?: Record<string, string>;
  /** Підсумки по поточному зрізу (опційно). */
  totals?: {
    income: number;
    outflow: number;
  };
};

export function FinanceTransactionsTable({
  rows,
  projectNameById,
  categoryNameById,
  accountLabelById,
  objectNameById,
  totals,
}: Props) {
  const net = (totals?.income ?? 0) - (totals?.outflow ?? 0);
  const cols = objectNameById
    ? [
        "Дата",
        "Проєкт",
        "Об'єкт",
        "Тип",
        "Категорія",
        "Контрагент",
        "Сума",
        "Рахунок",
        "Статус",
        "Документ",
        "Коментар",
      ]
    : [
        "Дата",
        "Проєкт",
        "Тип",
        "Категорія",
        "Контрагент",
        "Сума",
        "Рахунок",
        "Статус",
        "Документ",
        "Коментар",
      ];
  return (
    <div className="space-y-0">
      <DataTableShell columns={cols}>
        {rows.map((r, i) => (
          <tr
            key={r.id}
            className={`border-t border-slate-100 text-[13px] transition-colors hover:bg-slate-50/80 ${i % 2 === 1 ? "bg-slate-50/35" : ""}`}
          >
            <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{new Date(r.transactionDate).toLocaleDateString("uk-UA")}</td>
            <td className="px-3 py-2.5 text-slate-800">
              <span className="font-medium text-slate-800">
                {projectNameById[r.projectId] ?? r.projectId}
              </span>
            </td>
            {objectNameById ? (
              <td className="max-w-[min(180px,28vw)] truncate px-3 py-2.5 text-slate-600" title={r.objectId ? objectNameById[r.objectId] : undefined}>
                {r.objectId ? objectNameById[r.objectId] ?? "—" : "—"}
              </td>
            ) : null}
            <td className="px-3 py-2.5 text-slate-800">{financeTransactionTypeUa(r.type)}</td>
            <td className="max-w-[8rem] truncate px-3 py-2.5 text-slate-700" title={categoryNameById[r.categoryId]}>
              {categoryNameById[r.categoryId] ?? r.categoryId}
            </td>
            <td className="px-3 py-2.5 text-slate-600">{counterpartyTypeUa(r.counterpartyType)}</td>
            <td className="px-3 py-2.5">
              <CurrencyCell value={r.amount} tone={r.type === "INCOME" ? "income" : "expense"} />
            </td>
            <td className="px-3 py-2.5 text-slate-600">
              {r.accountId
                ? (accountLabelById?.[r.accountId] ?? r.accountId)
                : "—"}
            </td>
            <td className="px-3 py-2.5">
              <FinanceTransactionStatusBadge status={r.status} />
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{r.documentNumber || "—"}</td>
            <td className="max-w-[10rem] truncate px-3 py-2.5 text-slate-500" title={r.comment || undefined}>
              {r.comment || "—"}
            </td>
          </tr>
        ))}
      </DataTableShell>
      {totals ? (
        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-slate-200 bg-slate-100/80 px-3 py-2.5 text-xs text-slate-700">
          <span>
            Надходження:{" "}
            <strong className="tabular-nums text-emerald-800">{totals.income.toLocaleString("uk-UA")}</strong>
          </span>
          <span>
            Витрати:{" "}
            <strong className="tabular-nums text-rose-800">{totals.outflow.toLocaleString("uk-UA")}</strong>
          </span>
          <span>
            Чистий рух:{" "}
            <strong className={`tabular-nums ${net >= 0 ? "text-emerald-800" : "text-rose-800"}`}>
              {net.toLocaleString("uk-UA")}
            </strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}
