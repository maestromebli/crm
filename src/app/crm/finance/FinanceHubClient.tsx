"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useErpBridge } from "@/components/erp/ErpBridgeProvider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Dashboard = {
  kpi: {
    balance: number;
    incomeMonth: number;
    expenseMonth: number;
    profit: number;
  };
  cashflow: Array<{
    date: string;
    income: number;
    expense: number;
    balance: number;
  }>;
  ai: {
    paymentRisk: string;
    cashflowForecast: string;
    actions: string[];
  };
  enterprise: {
    arLedger: Array<{
      dealId: string;
      dealTitle: string;
      invoiced: number;
      received: number;
      outstanding: number;
      dueDate: string | null;
    }>;
    apLedger: Array<{
      purchaseOrderId: string;
      dealId: string | null;
      dealTitle: string;
      total: number;
      paid: number;
      outstanding: number;
      expectedDate: string | null;
      status: string;
    }>;
    cashflowForecast8w: Array<{
      week: string;
      inflow: number;
      outflow: number;
      net: number;
      projectedBalance: number;
    }>;
    riskIndex: number;
    riskLabel: string;
  };
};

export function FinanceHubClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nowLabel, setNowLabel] = useState("—");
  const [invoiceForm, setInvoiceForm] = useState({
    entity: "",
    amount: 0,
    dueDate: "",
    type: "OUTGOING" as "INCOMING" | "OUTGOING",
    productionOrder: "",
    note: "",
  });
  const [paymentPlanForm, setPaymentPlanForm] = useState({
    productionOrder: "",
    amount: 0,
    trancheDate: "",
    trancheLabel: "Аванс",
  });
  const [auditFeed, setAuditFeed] = useState<string[]>([]);
  const [riskConfig, setRiskConfig] = useState({
    riskIndexWarn: 55,
    arOutstandingWarn: 900000,
    apOutstandingWarn: 700000,
    weekNetWarn: -120000,
  });
  const firedAlertsRef = useRef<Set<string>>(new Set());
  const {
    productionOrders,
    addFinanceDocument,
    addEvent,
    financeDocuments,
    approveFinanceDocument,
    markFinanceDocumentPaid,
  } = useErpBridge();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/crm/finance/dashboard");
      const j = (await r.json()) as Dashboard & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const updateNow = () => setNowLabel(new Date().toLocaleString("uk-UA"));
    updateNow();
    const timer = setInterval(updateNow, 30_000);
    return () => clearInterval(timer);
  }, []);

  const maxCf =
    data?.cashflow?.length ?
      Math.max(
        ...data.cashflow.map((c) => Math.max(c.income, c.expense, Math.abs(c.balance))),
        1,
      )
    : 1;

  const analytics = useMemo(() => {
    if (!data) {
      return {
        runwayDays: 0,
        marginPct: 0,
        liquidityPct: 0,
        burnRate: 0,
      };
    }

    const avgExpensePerDay = Math.max(1, data.kpi.expenseMonth / 30);
    const runwayDays = Math.floor(Math.max(0, data.kpi.balance) / avgExpensePerDay);
    const marginPct = data.kpi.incomeMonth > 0 ? Math.round((data.kpi.profit / data.kpi.incomeMonth) * 100) : 0;
    const liquidityPct =
      data.kpi.expenseMonth > 0 ? Math.round((data.kpi.balance / Math.max(data.kpi.expenseMonth, 1)) * 100) : 0;
    const burnRate = Math.round(data.kpi.expenseMonth / 30);

    return { runwayDays, marginPct, liquidityPct, burnRate };
  }, [data]);

  const weeklyNet = useMemo(() => {
    if (!data) return [0, 0, 0, 0, 0, 0, 0];
    const tail = data.cashflow.slice(-7);
    const values = tail.map((row) => Math.round(row.income - row.expense));
    while (values.length < 7) values.unshift(0);
    return values;
  }, [data]);

  const enterpriseSignals = useMemo(() => {
    if (!data) return { arOutstanding: 0, apOutstanding: 0, worstWeekNet: 0 };
    return {
      arOutstanding: data.enterprise.arLedger.reduce((acc, row) => acc + row.outstanding, 0),
      apOutstanding: data.enterprise.apLedger.reduce((acc, row) => acc + row.outstanding, 0),
      worstWeekNet: data.enterprise.cashflowForecast8w.reduce((acc, row) => Math.min(acc, row.net), 0),
    };
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const alerts: Array<{ key: string; message: string }> = [];
    if (data.enterprise.riskIndex >= riskConfig.riskIndexWarn) {
      alerts.push({
        key: `finance-risk-${data.enterprise.riskIndex}-${riskConfig.riskIndexWarn}`,
        message: `Finance risk index ${data.enterprise.riskIndex}/100 перевищив поріг ${riskConfig.riskIndexWarn}.`,
      });
    }
    if (enterpriseSignals.arOutstanding >= riskConfig.arOutstandingWarn) {
      alerts.push({
        key: `finance-ar-${Math.round(enterpriseSignals.arOutstanding)}-${riskConfig.arOutstandingWarn}`,
        message: `AR outstanding ${formatMoney(enterpriseSignals.arOutstanding)} ₴ перевищив поріг.`,
      });
    }
    if (enterpriseSignals.apOutstanding >= riskConfig.apOutstandingWarn) {
      alerts.push({
        key: `finance-ap-${Math.round(enterpriseSignals.apOutstanding)}-${riskConfig.apOutstandingWarn}`,
        message: `AP outstanding ${formatMoney(enterpriseSignals.apOutstanding)} ₴ перевищив поріг.`,
      });
    }
    if (enterpriseSignals.worstWeekNet <= riskConfig.weekNetWarn) {
      alerts.push({
        key: `finance-net-${Math.round(enterpriseSignals.worstWeekNet)}-${riskConfig.weekNetWarn}`,
        message: `Forecast worst weekly net ${formatMoney(enterpriseSignals.worstWeekNet)} ₴ нижче порогу.`,
      });
    }
    for (const alert of alerts) {
      if (firedAlertsRef.current.has(alert.key)) continue;
      firedAlertsRef.current.add(alert.key);
      addEvent({
        module: "finance",
        type: "ENTERPRISE_RISK_ALERT",
        message: alert.message,
        actor: "AI Control",
        payload: { key: alert.key },
      });
      setAuditFeed((prev) => [`ALERT → ${alert.message}`, ...prev].slice(0, 80));
    }
  }, [addEvent, data, enterpriseSignals, riskConfig]);

  function createInvoice() {
    if (!invoiceForm.entity.trim() || invoiceForm.amount <= 0) return;
    addFinanceDocument({
      kind: "INVOICE",
      direction: invoiceForm.type,
      entity: invoiceForm.entity.trim(),
      amount: invoiceForm.amount,
      dueDate: invoiceForm.dueDate,
      productionOrder: invoiceForm.productionOrder.trim(),
    });
    addEvent({
      module: "finance",
      type: "INVOICE_CREATED",
      message: `Створено ${invoiceForm.type} документ для ${invoiceForm.entity}`,
      payload: { amount: invoiceForm.amount, productionOrder: invoiceForm.productionOrder || null },
    });
    setAuditFeed((prev) => [
      `INV → ${invoiceForm.type} / ${invoiceForm.entity} / ${formatMoney(invoiceForm.amount)} ₴ / due ${invoiceForm.dueDate || "—"}`,
      ...prev,
    ]);
    setInvoiceForm({
      entity: "",
      amount: 0,
      dueDate: "",
      type: "OUTGOING",
      productionOrder: "",
      note: "",
    });
  }

  function addPaymentPlan() {
    if (!paymentPlanForm.productionOrder.trim() || paymentPlanForm.amount <= 0) return;
    addFinanceDocument({
      kind: "PLAN",
      direction: "OUTGOING",
      entity: "Production plan",
      amount: paymentPlanForm.amount,
      dueDate: paymentPlanForm.trancheDate,
      productionOrder: paymentPlanForm.productionOrder.trim(),
    });
    addEvent({
      module: "finance",
      type: "PAYMENT_PLAN_ADDED",
      message: `План платежу ${paymentPlanForm.trancheLabel} для ${paymentPlanForm.productionOrder}`,
      payload: { amount: paymentPlanForm.amount },
    });
    setAuditFeed((prev) => [
      `PLAN → ${paymentPlanForm.productionOrder} / ${paymentPlanForm.trancheLabel} / ${formatMoney(paymentPlanForm.amount)} ₴`,
      ...prev,
    ]);
    setPaymentPlanForm({
      productionOrder: "",
      amount: 0,
      trancheDate: "",
      trancheLabel: "Аванс",
    });
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-5 text-slate-100 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">ENVER · SaaS ERP · Finance</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Фінансовий командний центр</h1>
            <p className="mt-1 text-sm text-slate-300">
              Cash-flow, P&amp;L, платіжна дисципліна та фінансовий контроль виробничих замовлень.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-right text-sm">
            <p className="text-slate-400">Фінансовий статус</p>
            <p className="font-semibold text-emerald-300">MONITORING</p>
            <p className="text-xs text-slate-400">{nowLabel}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Ліквідність"
            value={`${analytics.liquidityPct}%`}
            dark
            hint="Відношення залишку коштів до місячних витрат — наскільки довго вистачить обороту"
          />
          <KpiCard
            label="Margin (місяць)"
            value={`${analytics.marginPct}%`}
            tone="ok"
            dark
            hint="Частка прибутку в доході за поточний місяць"
          />
          <KpiCard
            label="Runway"
            value={`${analytics.runwayDays} днів`}
            tone="info"
            dark
            hint="Орієнтовна кількість днів роботи при поточних витратах"
          />
          <KpiCard
            label="Burn-rate / день"
            value={`${formatMoney(analytics.burnRate)} ₴`}
            tone="warn"
            dark
            hint="Середні витрати на день (місячні витрати / 30)"
          />
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
          <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1">
            ERP фіндокументи: {financeDocuments.length}
          </p>
          <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1">
            ERP виробничі замовлення: {productionOrders.length}
          </p>
          <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1">Audit trail: active</p>
        </div>
      </header>

      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {err}
        </div>
      )}

      {data && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Баланс"
              value={`${formatMoney(data.kpi.balance)} ₴`}
              hint="Поточний залишок на рахунках за даними вікна"
            />
            <KpiCard
              label="Надходження"
              value={`${formatMoney(data.kpi.incomeMonth)} ₴`}
              tone="ok"
              hint="Сума надходжень за поточний місяць"
            />
            <KpiCard
              label="Витрати"
              value={`${formatMoney(data.kpi.expenseMonth)} ₴`}
              tone="warn"
              hint="Сума витрат за поточний місяць"
            />
            <KpiCard
              label="Прибуток"
              value={`${formatMoney(data.kpi.profit)} ₴`}
              tone="info"
              hint="Доходи мінус витрати за місяць"
            />
          </section>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Enterprise Risk" value={`${data.enterprise.riskIndex}/100`} tone="warn" />
            <KpiCard label="Risk label" value={data.enterprise.riskLabel} />
            <KpiCard
              label="AR outstanding"
              value={`${formatMoney(data.enterprise.arLedger.reduce((a, r) => a + r.outstanding, 0))} ₴`}
              tone="info"
            />
            <KpiCard
              label="AP outstanding"
              value={`${formatMoney(data.enterprise.apLedger.reduce((a, r) => a + r.outstanding, 0))} ₴`}
              tone="warn"
            />
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Risk thresholds (керовані)</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs text-slate-600">
                Risk index warn
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                  value={riskConfig.riskIndexWarn}
                  onChange={(event) =>
                    setRiskConfig((prev) => ({ ...prev, riskIndexWarn: Number(event.target.value || 0) }))
                  }
                />
              </label>
              <label className="text-xs text-slate-600">
                AR outstanding warn
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                  value={riskConfig.arOutstandingWarn}
                  onChange={(event) =>
                    setRiskConfig((prev) => ({ ...prev, arOutstandingWarn: Number(event.target.value || 0) }))
                  }
                />
              </label>
              <label className="text-xs text-slate-600">
                AP outstanding warn
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                  value={riskConfig.apOutstandingWarn}
                  onChange={(event) =>
                    setRiskConfig((prev) => ({ ...prev, apOutstandingWarn: Number(event.target.value || 0) }))
                  }
                />
              </label>
              <label className="text-xs text-slate-600">
                Worst week net warn
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                  value={riskConfig.weekNetWarn}
                  onChange={(event) =>
                    setRiskConfig((prev) => ({ ...prev, weekNetWarn: Number(event.target.value || 0) }))
                  }
                />
              </label>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[var(--enver-text)]">Грошовий рух (90 днів)</h2>
              <div className="mt-4 flex h-40 items-end gap-px overflow-x-auto pb-1">
                {data.cashflow.map((row) => (
                  <div
                    key={row.date}
                    className="group flex min-w-[6px] flex-1 flex-col items-center gap-1"
                    title={`${row.date}: +${row.income.toFixed(0)} / −${row.expense.toFixed(0)}`}
                  >
                    <div
                      className="w-full max-w-[14px] rounded-t bg-emerald-400/90"
                      style={{ height: `${(row.income / maxCf) * 100}%`, minHeight: row.income > 0 ? 4 : 0 }}
                    />
                    <div
                      className="w-full max-w-[14px] rounded-t bg-rose-400/90"
                      style={{ height: `${(row.expense / maxCf) * 100}%`, minHeight: row.expense > 0 ? 4 : 0 }}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Зелений — надходження, червоний — витрати (масштаб по максимуму вікна).
              </p>

              <h3 className="mt-4 text-xs font-semibold text-slate-700">Net flow (останні 7 днів)</h3>
              <div className="mt-2 flex h-24 items-end gap-2 rounded-xl bg-slate-50 p-3">
                {weeklyNet.map((value, index) => {
                  const positive = value >= 0;
                  const abs = Math.min(100, Math.max(6, Math.round(Math.abs(value) / 1000)));
                  return (
                    <div key={`${value}-${index}`} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t ${positive ? "bg-emerald-500" : "bg-rose-500"}`}
                        style={{ height: `${abs}%` }}
                        title={`D${index + 1}: ${value}`}
                      />
                      <span className="text-[10px] text-slate-500">D{index + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 to-white p-4">
                <h2 className="text-sm font-semibold text-violet-900">AI: ризики та прогноз</h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  <li>
                    <span className="font-medium text-slate-900">Ризик оплат: </span>
                    {data.ai.paymentRisk}
                  </li>
                  <li>
                    <span className="font-medium text-slate-900">Прогноз: </span>
                    {data.ai.cashflowForecast}
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-xs font-semibold text-slate-700">Рекомендовані дії</h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
                  {data.ai.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
          <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Cashflow forecast · 8 тижнів</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-slate-500">
                      <th className="py-2 pr-2">Week</th>
                      <th className="py-2 pr-2">Inflow</th>
                      <th className="py-2 pr-2">Outflow</th>
                      <th className="py-2 pr-2">Net</th>
                      <th className="py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.enterprise.cashflowForecast8w.map((row) => (
                      <tr key={row.week} className="border-b border-slate-50">
                        <td className="py-2 pr-2 font-medium text-slate-900">{row.week}</td>
                        <td className="py-2 pr-2">{formatMoney(row.inflow)} ₴</td>
                        <td className="py-2 pr-2">{formatMoney(row.outflow)} ₴</td>
                        <td className={`py-2 pr-2 ${row.net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {formatMoney(row.net)} ₴
                        </td>
                        <td className="py-2">{formatMoney(row.projectedBalance)} ₴</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">AR / AP ledger</h2>
              <div className="mt-3 grid gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <p className="text-xs font-semibold uppercase text-emerald-700">AR</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {data.enterprise.arLedger.slice(0, 6).map((row) => (
                      <li key={row.dealId}>
                        {row.dealTitle}: due {formatMoney(row.outstanding)} ₴
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3">
                  <p className="text-xs font-semibold uppercase text-rose-700">AP</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-700">
                    {data.enterprise.apLedger.slice(0, 6).map((row) => (
                      <li key={row.purchaseOrderId}>
                        {row.dealTitle}: due {formatMoney(row.outstanding)} ₴
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <form
              className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                createInvoice();
              }}
            >
              <h2 className="text-sm font-semibold text-slate-900">Форма рахунку / платежу</h2>
              <select
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                value={invoiceForm.type}
                onChange={(event) =>
                  setInvoiceForm((prev) => ({
                    ...prev,
                    type: event.target.value as "INCOMING" | "OUTGOING",
                  }))
                }
              >
                <option value="INCOMING">INCOMING</option>
                <option value="OUTGOING">OUTGOING</option>
              </select>
              <input
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Контрагент"
                value={invoiceForm.entity}
                onChange={(event) => setInvoiceForm((prev) => ({ ...prev, entity: event.target.value }))}
              />
              <select
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                value={invoiceForm.productionOrder}
                onChange={(event) =>
                  setInvoiceForm((prev) => ({ ...prev, productionOrder: event.target.value }))
                }
              >
                <option value="">Прив&apos;язка до замовлення (опційно)</option>
                {productionOrders.map((order) => (
                  <option key={order.number} value={order.number}>
                    {order.number} · {order.client}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="Сума"
                  value={invoiceForm.amount}
                  onChange={(event) =>
                    setInvoiceForm((prev) => ({ ...prev, amount: Number(event.target.value || 0) }))
                  }
                />
                <input
                  type="date"
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  value={invoiceForm.dueDate}
                  onChange={(event) => setInvoiceForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                />
              </div>
              <textarea
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                rows={2}
                placeholder="Примітка"
                value={invoiceForm.note}
                onChange={(event) => setInvoiceForm((prev) => ({ ...prev, note: event.target.value }))}
              />
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Зареєструвати документ
              </button>
            </form>

            <form
              className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                addPaymentPlan();
              }}
            >
              <h2 className="text-sm font-semibold text-slate-900">План оплат по виробництву</h2>
              <input
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Номер замовлення (PR-...)"
                value={paymentPlanForm.productionOrder}
                onChange={(event) =>
                  setPaymentPlanForm((prev) => ({ ...prev, productionOrder: event.target.value }))
                }
              />
              <select
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                value={paymentPlanForm.productionOrder}
                onChange={(event) =>
                  setPaymentPlanForm((prev) => ({ ...prev, productionOrder: event.target.value }))
                }
              >
                <option value="">або виберіть з ERP</option>
                {productionOrders.map((order) => (
                  <option key={order.number} value={order.number}>
                    {order.number} · {order.product}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Назва траншу"
                value={paymentPlanForm.trancheLabel}
                onChange={(event) =>
                  setPaymentPlanForm((prev) => ({ ...prev, trancheLabel: event.target.value }))
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="Сума траншу"
                  value={paymentPlanForm.amount}
                  onChange={(event) =>
                    setPaymentPlanForm((prev) => ({ ...prev, amount: Number(event.target.value || 0) }))
                  }
                />
                <input
                  type="date"
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  value={paymentPlanForm.trancheDate}
                  onChange={(event) =>
                    setPaymentPlanForm((prev) => ({ ...prev, trancheDate: event.target.value }))
                  }
                />
              </div>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Додати в payment plan
              </button>
            </form>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Аудит фінансових операцій</h2>
              <ul className="mt-3 space-y-2 text-xs">
                {auditFeed.map((entry) => (
                  <li key={entry} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700">
                    {entry}
                  </li>
                ))}
                {auditFeed.length === 0 ? (
                  <li className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-500">
                    Нові записи з&apos;являться після створення документів.
                  </li>
                ) : null}
              </ul>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">Finance approvals (ERP bridge)</h2>
                <ul className="mt-2 space-y-2 text-xs">
                  {financeDocuments.slice(0, 6).map((doc) => (
                    <li key={doc.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <p className="font-medium text-slate-800">
                        {doc.kind} · {doc.direction} · {formatMoney(doc.amount)} ₴ · {doc.status}
                      </p>
                      <div className="mt-1 flex gap-1">
                        {doc.status === "DRAFT" ? (
                          <button
                            type="button"
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                            onClick={() => approveFinanceDocument(doc.id, "CFO")}
                          >
                            Approve
                          </button>
                        ) : null}
                        {doc.status === "APPROVED" ? (
                          <button
                            type="button"
                            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                            onClick={() => markFinanceDocumentPaid(doc.id, "Treasury")}
                          >
                            Mark paid
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                  {financeDocuments.length === 0 ? <li className="text-slate-500">Черга апрувів порожня.</li> : null}
                </ul>
              </div>
              <div className="grid gap-2">
              <QuickLink href="/crm/production" title="Виробничий контур" subtitle="готовність замовлень і ризики строків" />
              <QuickLink href="/crm/procurement" title="Контур закупівлі" subtitle="PO, постачальники, склад" />
              <QuickLink href="/crm/erp" title="Global ERP Command" subtitle="approval trail і наскрізний timeline" />
              </div>
            </div>
          </section>
        </>
      )}

      {!data && !err && (
        <p className="text-sm text-slate-500">Завантаження показників…</p>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
  dark = false,
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "ok" | "info";
  dark?: boolean;
  hint?: string;
}) {
  const reduceMotion = useReducedMotion();
  const toneClass =
    tone === "warn"
      ? "border-amber-200 bg-amber-50"
      : tone === "ok"
        ? "border-emerald-200 bg-emerald-50"
        : tone === "info"
          ? "border-cyan-200 bg-cyan-50"
          : "border-slate-200 bg-white";
  const skinClass = dark ? "border-slate-700 bg-slate-900/70" : toneClass;
  const labelClass = dark ? "text-slate-300" : "text-slate-600";
  const valueClass = dark ? "text-slate-100" : "text-slate-900";

  const labelNode = hint ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <p
          className={`inline-flex max-w-full cursor-help items-center gap-0.5 border-b border-dotted ${dark ? "border-slate-500" : "border-slate-400"} text-xs ${labelClass}`}
        >
          {label}
        </p>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[18rem]">
        {hint}
      </TooltipContent>
    </Tooltip>
  ) : (
    <p className={`text-xs ${labelClass}`}>{label}</p>
  );

  return (
    <motion.article
      className={`rounded-2xl border p-3 shadow-sm ${skinClass}`}
      whileHover={
        reduceMotion
          ? undefined
          : { y: dark ? -1 : -2, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }
      }
    >
      {labelNode}
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </motion.article>
  );
}

function QuickLink({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          whileHover={reduceMotion ? undefined : { y: -2, transition: { duration: 0.2 } }}
          whileTap={reduceMotion ? undefined : { scale: 0.99 }}
        >
          <Link
            href={href}
            className="block rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-cyan-400 hover:shadow-md"
          >
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </Link>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[20rem]">
        {subtitle}
      </TooltipContent>
    </Tooltip>
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString("uk-UA", { maximumFractionDigits: 0 });
}
