"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DealWorkspacePayload } from "@/features/deal-workspace/types";
import { postJson } from "@/lib/api/patch-json";
import { getApiErrorMessage, parseResponseJson } from "@/lib/api/parse-response-json";
import { cn } from "@/lib/utils";
import { buildProcurementHubNewRequestHref } from "@/features/procurement/lib/quick-actions";

type Props = {
  data: DealWorkspacePayload;
  roleView: "director" | "head" | "sales";
};

type Summary = {
  paymentPlan: { stepsJson: unknown; reasonIfChanged: string | null } | null;
  invoices: Array<{
    id: string;
    type: string;
    status: string;
    amount: string;
    pdfUrl: string | null;
    createdAt: string;
  }>;
  purchaseOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: string;
    supplier: { id: string; name: string };
  }>;
  rollup: {
    revenueUah: string;
    expensesUah: string;
    paidClientUah: string;
    profitUah: string;
    marginPct: string | null;
  } | null;
  estimateSummary: {
    estimatedCost: number;
    actualPurchase: number;
    lineCount: number;
  };
  dealFinancialSummary: {
    contractAmount: number;
    receivedAmount: number;
    remainingToReceive: number;
    estimatedCost: number;
    procurementPlanned: number;
    procurementActual: number;
    operatingExpenses: number;
    payrollTotal: number;
    commissionsTotal: number;
    grossProfit: number;
    netProfit: number;
    marginPercent: number;
    cashGap: number;
    riskLevel: "low" | "medium" | "high";
  } | null;
  dealFinancialTabs: {
    payments: Array<{ id: string; amount: number; currency: string; date: string; status: string; category: string }>;
    expenses: Array<{ id: string; amount: number; date: string; status: string; category: string; title: string }>;
    procurement: Array<{ id: string; source: string; status: string; amountPlanned: number; amountActual: number; neededByDate: string | null }>;
    payroll: Array<{ id: string; employeeId: string; amount: number; type: string; status: string }>;
    commissions: Array<{ id: string; userId: string; amount: number; percent: number | null; status: string }>;
    profitability: {
      netProfit: number;
      grossProfit: number;
      marginPercent: number;
      cashGap: number;
      riskLevel: "low" | "medium" | "high";
    } | null;
  };
};

export function DealFinanceProcurementTab({ data, roleView }: Props) {
  const [activeSubtab, setActiveSubtab] = useState<
    "payments" | "expenses" | "procurement" | "payroll" | "commissions" | "profitability"
  >("payments");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [genBusy, setGenBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/deals/${data.deal.id}/fp/summary`);
      const j = await parseResponseJson<Summary & { error?: string }>(r);
      if (!r.ok) throw new Error(getApiErrorMessage(r, j, "Помилка завантаження"));
      setSummary(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setLoading(false);
    }
  }, [data.deal.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const milestones = data.paymentMilestones ?? [];
  const m0 = milestones[0];
  const m1 = milestones[1];

  const onGenerate = async () => {
    setGenBusy(true);
    setErr(null);
    try {
      await postJson<{ orderNumber?: string }>(
        `/api/deals/${data.deal.id}/fp/generate-procurement`,
        {},
      );
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setGenBusy(false);
    }
  };

  const showMoney = roleView !== "sales";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--enver-text)]">
            Фінанси та закупівлі
          </h2>
          <div className="flex gap-2">
            <Link
              href="/crm/finance"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Каса CRM
            </Link>
            <Link
              href={buildProcurementHubNewRequestHref(data.deal.id)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Закупівлі
            </Link>
          </div>
        </div>

        {err && (
          <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-800">{err}</p>
        )}

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-medium text-slate-500">Статус оплат (70/30)</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <span>{m0?.label ?? "Аванс"}</span>
                <span
                  className={cn(
                    m0?.confirmedAt ? "text-emerald-700" : "text-amber-700",
                  )}
                >
                  {m0?.confirmedAt ? "оплачено" : "очікується"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>{m1?.label ?? "Фінал"}</span>
                <span
                  className={cn(
                    m1?.confirmedAt ? "text-emerald-700" : "text-slate-600",
                  )}
                >
                  {m1?.confirmedAt ? "оплачено" : "очікується"}
                </span>
              </div>
            </div>
          </div>

          {showMoney && summary?.rollup && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-xs font-medium text-slate-500">Вартість vs прибуток</p>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-600">Собівартість (смета)</dt>
                  <dd>{summary.estimateSummary.estimatedCost.toFixed(0)} ₴</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Факт закупівель</dt>
                  <dd>{summary.estimateSummary.actualPurchase.toFixed(0)} ₴</dd>
                </div>
                <div className="flex justify-between font-medium">
                  <dt>Маржа (оцінка)</dt>
                  <dd>
                    {summary.rollup.marginPct
                      ? `${Number(summary.rollup.marginPct).toFixed(1)}%`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </section>

        <section className="mt-4">
          <div className="mb-2 flex flex-wrap gap-2">
            {[
              ["payments", "Оплати"],
              ["expenses", "Витрати"],
              ["procurement", "Закупівлі"],
              ["payroll", "Зарплата"],
              ["commissions", "Комісії"],
              ["profitability", "Прибутковість"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setActiveSubtab(
                    key as
                      | "payments"
                      | "expenses"
                      | "procurement"
                      | "payroll"
                      | "commissions"
                      | "profitability",
                  )
                }
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs",
                  activeSubtab === key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--enver-text)]">Рахунки</h3>
            <button
              type="button"
              className="text-xs text-sky-700 hover:underline"
              onClick={() => {
                void postJson<{ id?: string }>(
                  `/api/deals/${data.deal.id}/finance/invoices`,
                  {
                    type: "PREPAYMENT_70",
                    amount:
                      m0?.amount ??
                      (data.deal.value != null ? data.deal.value * 0.7 : 0),
                  },
                ).then(() => load());
              }}
            >
              Створити рахунок (70%)
            </button>
          </div>
          {loading ? <p className="text-xs text-slate-500">Завантаження…</p> : null}
          {!loading && activeSubtab === "payments" && (
            <ul className="space-y-1 text-sm">
              {(summary?.dealFinancialTabs.payments ?? []).map((row) => (
                <li key={row.id} className="flex justify-between rounded-lg border border-slate-100 px-2 py-1">
                  <span>{row.category} · {row.status}</span>
                  <span>{row.amount.toFixed(0)} ₴</span>
                </li>
              ))}
            </ul>
          )}
          {!loading && activeSubtab === "expenses" && (
            <ul className="space-y-1 text-sm">
              {(summary?.dealFinancialTabs.expenses ?? []).map((row) => (
                <li key={row.id} className="flex justify-between rounded-lg border border-slate-100 px-2 py-1">
                  <span>{row.category} · {row.status}</span>
                  <span>{row.amount.toFixed(0)} ₴</span>
                </li>
              ))}
            </ul>
          )}
          {!loading && activeSubtab === "procurement" && (
            <ul className="space-y-1 text-sm">
              {(summary?.dealFinancialTabs.procurement ?? []).map((row) => (
                <li key={row.id} className="rounded-lg border border-slate-100 px-2 py-1">
                  <div className="flex justify-between">
                    <span>{row.source} · {row.status}</span>
                    <span>{row.amountActual.toFixed(0)} / {row.amountPlanned.toFixed(0)} ₴</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!loading && activeSubtab === "payroll" && (
            <ul className="space-y-1 text-sm">
              {(summary?.dealFinancialTabs.payroll ?? []).map((row) => (
                <li key={row.id} className="flex justify-between rounded-lg border border-slate-100 px-2 py-1">
                  <span>{row.type} · {row.status}</span>
                  <span>{row.amount.toFixed(0)} ₴</span>
                </li>
              ))}
            </ul>
          )}
          {!loading && activeSubtab === "commissions" && (
            <ul className="space-y-1 text-sm">
              {(summary?.dealFinancialTabs.commissions ?? []).map((row) => (
                <li key={row.id} className="flex justify-between rounded-lg border border-slate-100 px-2 py-1">
                  <span>{row.percent != null ? `${row.percent}%` : "фіксовано"} · {row.status}</span>
                  <span>{row.amount.toFixed(0)} ₴</span>
                </li>
              ))}
            </ul>
          )}
          {!loading && activeSubtab === "profitability" && (
            <div className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <p>Валовий: {summary?.dealFinancialSummary ? summary.dealFinancialSummary.grossProfit.toFixed(0) : "0"} ₴</p>
              <p>Чистий: {summary?.dealFinancialSummary ? summary.dealFinancialSummary.netProfit.toFixed(0) : "0"} ₴</p>
              <p>Маржа: {summary?.dealFinancialSummary ? summary.dealFinancialSummary.marginPercent.toFixed(1) : "0"}%</p>
              <p>Касовий розрив: {summary?.dealFinancialSummary ? summary.dealFinancialSummary.cashGap.toFixed(0) : "0"} ₴</p>
            </div>
          )}
        </section>

        <section className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={genBusy}
              onClick={() => void onGenerate()}
              className={cn(
                "rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-50",
              )}
            >
              {genBusy ? "Створення…" : "🔥 Згенерувати закупку"}
            </button>
            <p className="text-xs text-slate-500">
              Після оплати 70% — чернетка замовлення з рядків смети (матеріали / фурнітура).
            </p>
          </div>
          {summary?.purchaseOrders?.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {summary.purchaseOrders.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between rounded-lg border border-slate-100 px-2 py-1"
                >
                  <span>
                    {p.orderNumber} · {p.supplier.name}
                  </span>
                  <span className="text-slate-600">{p.status}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
