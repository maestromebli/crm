"use client";

import { useMemo, useState } from "react";
import type { FinanceTransaction } from "../types/models";
import type { ObjectFinanceLedgerRow } from "../lib/object-finance";
import { FinanceTransactionsTable } from "./FinanceTransactionsTable";
import { formatMoneyUa } from "../lib/format-money";

type Scope = "all" | "consolidated" | string;

type Props = {
  transactions: FinanceTransaction[];
  objectLedger: ObjectFinanceLedgerRow[];
  consolidated: ObjectFinanceLedgerRow;
  projectNameById: Record<string, string>;
  categoryNameById: Record<string, string>;
  objectNameById: Record<string, string>;
  accountLabelById?: Record<string, string>;
};

export function FinanceOperationsScopePanel({
  transactions,
  objectLedger,
  consolidated,
  projectNameById,
  categoryNameById,
  objectNameById,
  accountLabelById,
}: Props) {
  const [scope, setScope] = useState<Scope>("all");

  const filtered = useMemo(() => {
    if (scope === "consolidated") return [];
    if (scope === "all") return transactions;
    return transactions.filter((t) => t.objectId === scope);
  }, [transactions, scope]);

  const snap = useMemo(() => {
    if (scope === "all" || scope === "consolidated") return consolidated;
    return objectLedger.find((r) => r.objectId === scope) ?? null;
  }, [scope, consolidated, objectLedger]);

  const totals = useMemo(() => {
    let income = 0;
    let outflow = 0;
    for (const t of filtered) {
      if (t.status === "CANCELLED") continue;
      if (t.type === "INCOME") income += t.amount;
      else if (t.type === "EXPENSE" || t.type === "PAYROLL" || t.type === "COMMISSION") outflow += t.amount;
    }
    return { income, outflow };
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-white p-4 shadow-sm sm:flex-row sm:items-stretch sm:justify-between sm:gap-6">
        <label className="block min-w-0 flex-1 sm:max-w-md">
          <span className="text-sm font-medium text-slate-800">Зріз даних</span>
          <span className="mt-0.5 block text-xs text-slate-500">Оберіть портфель, одну адресу або лише зведені показники</span>
          <select
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-slate-200 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            <option value="all">Усі об&apos;єкти — повний реєстр проводок</option>
            <option value="consolidated">Лише зведення портфеля (без таблиці)</option>
            {objectLedger.map((r) => (
              <option key={r.objectId} value={r.objectId}>
                {r.projectCode} — {r.objectTitle}
              </option>
            ))}
          </select>
        </label>
        {snap ? (
          <div className="grid w-full min-w-0 gap-3 sm:grid-cols-3 sm:max-w-2xl">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Надходження</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-emerald-950">{formatMoneyUa(snap.incomeCash)} ₴</p>
            </div>
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-800">Витрати (cash)</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-rose-950">
                {formatMoneyUa(snap.expenseCash + snap.payrollCash + snap.commissionCash)} ₴
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Закупівлі (факт)</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-slate-900">{formatMoneyUa(snap.procurementAccrual)} ₴</p>
            </div>
          </div>
        ) : null}
      </div>

      {scope === "consolidated" ? (
        <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm leading-relaxed text-slate-700">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white" aria-hidden>
            i
          </span>
          <p>
            У режимі «зведення» таблицю проводок приховано — дивіться матрицю об&apos;єктів вище. Щоб переглянути рядки, оберіть «Усі
            об&apos;єкти» або конкретну адресу.
          </p>
        </div>
      ) : (
        <FinanceTransactionsTable
          rows={filtered}
          projectNameById={projectNameById}
          categoryNameById={categoryNameById}
          accountLabelById={accountLabelById}
          objectNameById={objectNameById}
          totals={totals}
        />
      )}
    </div>
  );
}
