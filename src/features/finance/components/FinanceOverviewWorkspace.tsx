"use client";

import { useMemo, useState } from "react";
import type { FinanceTransaction } from "../types/models";
import type { ProjectPaymentPlan } from "../types/models";
import { FinanceTransactionsTable } from "./FinanceTransactionsTable";
import { PaymentPlanTable } from "./PaymentPlanTable";
import { SectionCard } from "../../../components/shared/SectionCard";
import { isPaymentPlanOverdue } from "../lib/aggregation";

type TabKey =
  | "ALL"
  | "INCOME"
  | "EXPENSE"
  | "PAYROLL"
  | "COMMISSION"
  | "OVERDUE";

const TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "Усі" },
  { key: "INCOME", label: "Надходження" },
  { key: "EXPENSE", label: "Витрати" },
  { key: "PAYROLL", label: "Зарплата" },
  { key: "COMMISSION", label: "Комісії" },
  { key: "OVERDUE", label: "Прострочення графіку" },
];

type SortKey = "date" | "amount" | "project";

type Props = {
  transactions: FinanceTransaction[];
  projectNameById: Record<string, string>;
  categoryNameById: Record<string, string>;
  accountLabelById?: Record<string, string>;
  canViewDetails: boolean;
  /** Графік оплат для вкладки прострочень (опційно). */
  paymentPlan?: ProjectPaymentPlan[];
  /** Референсна дата для визначення прострочення (YYYY-MM-DD). */
  referenceDay?: string;
};

function isOutflow(t: FinanceTransaction): boolean {
  return t.type === "EXPENSE" || t.type === "PAYROLL" || t.type === "COMMISSION";
}

export function FinanceOverviewWorkspace({
  transactions,
  projectNameById,
  categoryNameById,
  accountLabelById,
  canViewDetails,
  paymentPlan = [],
  referenceDay = new Date().toISOString().slice(0, 10),
}: Props) {
  const [tab, setTab] = useState<TabKey>("ALL");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const overduePlanRows = useMemo(
    () => paymentPlan.filter((p) => isPaymentPlanOverdue(p, referenceDay)),
    [paymentPlan, referenceDay],
  );

  const filtered = useMemo(() => {
    let rows = transactions;
    if (tab === "INCOME") rows = rows.filter((t) => t.type === "INCOME");
    if (tab === "EXPENSE") rows = rows.filter((t) => t.type === "EXPENSE");
    if (tab === "PAYROLL") rows = rows.filter((t) => t.type === "PAYROLL");
    if (tab === "COMMISSION") rows = rows.filter((t) => t.type === "COMMISSION");
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (t) =>
          (projectNameById[t.projectId] ?? "").toLowerCase().includes(q) ||
          t.documentNumber.toLowerCase().includes(q) ||
          t.comment.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [transactions, tab, query, projectNameById]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") {
        cmp = new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
      } else if (sortKey === "amount") {
        cmp = a.amount - b.amount;
      } else {
        const pa = projectNameById[a.projectId] ?? "";
        const pb = projectNameById[b.projectId] ?? "";
        cmp = pa.localeCompare(pb, "uk");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir, projectNameById]);

  const totals = useMemo(() => {
    let income = 0;
    let outflow = 0;
    for (const t of filtered) {
      if (t.type === "INCOME") income += t.amount;
      else if (isOutflow(t)) outflow += t.amount;
    }
    return { income, outflow };
  }, [filtered]);

  const cycleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(key === "project" ? "asc" : "desc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const sortLabel = (key: SortKey, label: string) => {
    const active = sortKey === key;
    const arrow = active ? (sortDir === "asc" ? "↑" : "↓") : "";
    return (
      <button
        type="button"
        onClick={() => cycleSort(key)}
        className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
          active ? "border-slate-800 bg-slate-100 text-[var(--enver-text)]" : "border-slate-200 text-slate-600 hover:bg-[var(--enver-hover)]"
        }`}
      >
        {label} {arrow}
      </button>
    );
  };

  if (!canViewDetails) {
    return null;
  }

  return (
    <SectionCard title="Операційний реєстр" subtitle="Фільтри, сортування та підсумки по поточному зрізу">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              tab === t.key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-[var(--enver-card)] text-slate-700 hover:bg-[var(--enver-hover)]"
            }`}
          >
            {t.label}
            {t.key === "OVERDUE" && overduePlanRows.length > 0 ? (
              <span className="ml-1 rounded bg-amber-200 px-1 text-[10px] text-amber-900">
                {overduePlanRows.length}
              </span>
            ) : null}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пошук…"
          className="ml-auto h-8 min-w-[180px] rounded-md border border-slate-200 px-2 text-xs"
          disabled={tab === "OVERDUE"}
        />
      </div>

      {tab === "OVERDUE" ? (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-600">
            Рядки графіку оплат з залишком до сплати та датою/статусом прострочення (референс:{" "}
            <span className="font-mono">{referenceDay}</span>).
          </p>
          {overduePlanRows.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-600">
              Немає прострочених рядків графіку.
            </p>
          ) : (
            <PaymentPlanTable rows={overduePlanRows} projectNameById={projectNameById} />
          )}
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">Сортування:</span>
            {sortLabel("date", "Дата")}
            {sortLabel("amount", "Сума")}
            {sortLabel("project", "Проєкт")}
          </div>
          <FinanceTransactionsTable
            rows={sorted}
            projectNameById={projectNameById}
            categoryNameById={categoryNameById}
            accountLabelById={accountLabelById}
            totals={totals}
          />
          <p className="mt-2 text-[11px] text-slate-500">
            Показано {sorted.length} з {transactions.length} записів. Джерело грошей — транзакції; закупівлі — модуль
            «Закупки».
          </p>
        </>
      )}
    </SectionCard>
  );
}
