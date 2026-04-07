"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useErpBridge } from "@/components/erp/ErpBridgeProvider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Dash = {
  suppliers: Array<{ id: string; name: string; category: string; rating: number | null }>;
  materials: Array<{
    id: string;
    name: string;
    code: string;
    price: string;
    supplier: { id: string; name: string } | null;
  }>;
  purchaseOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: string;
    supplier: { name: string };
    deal: { title: string } | null;
  }>;
  stock: Array<{
    id: string;
    quantity: string;
    reserved: string;
    available: string;
    material: { name: string; code: string };
  }>;
  ai: { cheapestSupplier: string; delays: string; reorder: string };
  enterprise: {
    supplierRiskRadar: Array<{
      supplierId: string;
      supplierName: string;
      slaPct: number;
      paymentDisciplinePct: number;
      delayedOrders: number;
      spend: number;
      riskScore: number;
      riskLabel: string;
    }>;
    systemicRiskScore: number;
  };
};

type PurchaseRequest = {
  productionOrder: string;
  materialCode: string;
  qty: number;
  requiredDate: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  comment: string;
};

type SupplierOnboarding = {
  name: string;
  category: string;
  leadTimeDays: number;
  rating: number;
  paymentTerms: string;
};

const EMPTY_REQUEST: PurchaseRequest = {
  productionOrder: "",
  materialCode: "",
  qty: 1,
  requiredDate: "",
  priority: "MEDIUM",
  comment: "",
};

const EMPTY_SUPPLIER: SupplierOnboarding = {
  name: "",
  category: "Фурнітура",
  leadTimeDays: 5,
  rating: 4,
  paymentTerms: "14 днів",
};

export function ProcurementHubClient() {
  const [data, setData] = useState<Dash | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState<PurchaseRequest>(EMPTY_REQUEST);
  const [supplierForm, setSupplierForm] = useState<SupplierOnboarding>(EMPTY_SUPPLIER);
  const [opsFeed, setOpsFeed] = useState<string[]>([]);
  const [riskConfig, setRiskConfig] = useState({
    systemicWarn: 55,
    supplierRiskWarn: 65,
    slaWarnBelow: 75,
  });
  const firedAlertsRef = useRef<Set<string>>(new Set());
  const [nowLabel, setNowLabel] = useState("—");
  const {
    productionOrders,
    addPurchaseRequest,
    addEvent,
    bumpProductionTasks,
    purchaseRequests,
    approvePurchaseRequest,
    setPurchaseRequestStatus,
  } = useErpBridge();

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch(`/api/crm/procurement/dashboard${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      const j = (await r.json()) as Dash & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const updateNow = () => setNowLabel(new Date().toLocaleString("uk-UA"));
    updateNow();
    const timer = setInterval(updateNow, 30_000);
    return () => clearInterval(timer);
  }, []);

  const board = useCallback(
    (status: string) => data?.purchaseOrders.filter((order) => order.status === status) ?? [],
    [data],
  );

  const analytics = useMemo(() => {
    if (!data) {
      return {
        totalSpend: 0,
        stockCoverage: 0,
        criticalStock: 0,
        avgSupplierRating: 0,
      };
    }

    const totalSpend = data.purchaseOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const stockCoverage =
      data.stock.length > 0
        ? Math.round(
            (data.stock.reduce((sum, row) => sum + Number(row.available || 0), 0) /
              Math.max(1, data.stock.reduce((sum, row) => sum + Number(row.quantity || 0), 0))) *
              100,
          )
        : 0;
    const criticalStock = data.stock.filter((row) => Number(row.available || 0) <= 10).length;
    const rated = data.suppliers.filter((supplier) => supplier.rating !== null);
    const avgSupplierRating =
      rated.length > 0
        ? Number(
            (rated.reduce((sum, supplier) => sum + Number(supplier.rating || 0), 0) / rated.length).toFixed(2),
          )
        : 0;

    return { totalSpend, stockCoverage, criticalStock, avgSupplierRating };
  }, [data]);

  const supplierRiskTop = useMemo(() => data?.enterprise.supplierRiskRadar[0] ?? null, [data]);

  useEffect(() => {
    if (!data) return;
    const alerts: Array<{ key: string; message: string }> = [];
    if (data.enterprise.systemicRiskScore >= riskConfig.systemicWarn) {
      alerts.push({
        key: `proc-systemic-${data.enterprise.systemicRiskScore}-${riskConfig.systemicWarn}`,
        message: `Procurement systemic risk ${data.enterprise.systemicRiskScore}/100 перевищив поріг ${riskConfig.systemicWarn}.`,
      });
    }
    if (supplierRiskTop && supplierRiskTop.riskScore >= riskConfig.supplierRiskWarn) {
      alerts.push({
        key: `proc-toprisk-${supplierRiskTop.supplierId}-${supplierRiskTop.riskScore}-${riskConfig.supplierRiskWarn}`,
        message: `Top supplier risk ${supplierRiskTop.supplierName}: ${supplierRiskTop.riskScore}/100.`,
      });
    }
    if (supplierRiskTop && supplierRiskTop.slaPct <= riskConfig.slaWarnBelow) {
      alerts.push({
        key: `proc-sla-${supplierRiskTop.supplierId}-${supplierRiskTop.slaPct}-${riskConfig.slaWarnBelow}`,
        message: `SLA постачальника ${supplierRiskTop.supplierName} впав до ${supplierRiskTop.slaPct}%.`,
      });
    }
    for (const alert of alerts) {
      if (firedAlertsRef.current.has(alert.key)) continue;
      firedAlertsRef.current.add(alert.key);
      addEvent({
        module: "procurement",
        type: "ENTERPRISE_RISK_ALERT",
        message: alert.message,
        actor: "AI Control",
        payload: { key: alert.key },
      });
      setOpsFeed((prev) => [`ALERT → ${alert.message}`, ...prev].slice(0, 80));
    }
  }, [addEvent, data, riskConfig, supplierRiskTop]);

  function createPurchaseRequest() {
    if (!requestForm.productionOrder.trim() || !requestForm.materialCode.trim()) return;
    addPurchaseRequest({
      productionOrder: requestForm.productionOrder.trim(),
      materialCode: requestForm.materialCode.trim(),
      qty: requestForm.qty,
      priority: requestForm.priority,
      requiredDate: requestForm.requiredDate,
      comment: requestForm.comment,
    });
    bumpProductionTasks(requestForm.productionOrder.trim(), { procurement: 1 });
    addEvent({
      module: "procurement",
      type: "PURCHASE_REQUEST_CREATED",
      message: `Заявка ${requestForm.materialCode} для ${requestForm.productionOrder}`,
      payload: { qty: requestForm.qty, priority: requestForm.priority },
    });
    setOpsFeed((prev) => [
      `REQ → ${requestForm.productionOrder} / ${requestForm.materialCode} / ${requestForm.qty} од. / ${requestForm.priority}`,
      ...prev,
    ]);
    setRequestForm(EMPTY_REQUEST);
  }

  function onboardSupplier() {
    if (!supplierForm.name.trim()) return;
    addEvent({
      module: "procurement",
      type: "SUPPLIER_ONBOARDING",
      message: `Onboarding постачальника ${supplierForm.name}`,
      payload: { leadTime: supplierForm.leadTimeDays, rating: supplierForm.rating },
    });
    setOpsFeed((prev) => [
      `SUP → ${supplierForm.name} / ${supplierForm.category} / lead ${supplierForm.leadTimeDays} дн.`,
      ...prev,
    ]);
    setSupplierForm(EMPTY_SUPPLIER);
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-5 text-slate-100 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">ENVER · SaaS ERP · Procurement</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Командний контур закупівлі</h1>
            <p className="mt-1 text-sm text-slate-300">
              SLA постачань, контроль запасів, зв&apos;язок з виробництвом і фінансами в єдиному стеку.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-right text-sm">
            <p className="text-slate-400">Операційний статус</p>
            <p className="font-semibold text-emerald-300">ACTIVE</p>
            <p className="text-xs text-slate-400">{nowLabel}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="PO сума (оперативно)"
            value={`${formatMoney(analytics.totalSpend)} ₴`}
            dark
            hint="Сума відкритих закупівельних ордерів у поточному наборі даних"
          />
          <MetricCard
            label="Покриття складу"
            value={`${analytics.stockCoverage}%`}
            tone="info"
            dark
            hint="Частка доступного залишку відносно загального обсягу на складі"
          />
          <MetricCard
            label="Критичні позиції"
            value={`${analytics.criticalStock}`}
            tone="warn"
            dark
            hint="Кількість позицій з доступним залишком ≤ 10 одиниць"
          />
          <MetricCard
            label="Середній рейтинг постач."
            value={`${analytics.avgSupplierRating}`}
            tone="ok"
            dark
            hint="Середнє арифметичне рейтингів постачальників з заповненим рейтингом"
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Systemic risk" value={`${data?.enterprise.systemicRiskScore ?? 0}/100`} tone="warn" dark />
          <MetricCard
            label="Top supplier risk"
            value={
              data?.enterprise.supplierRiskRadar[0]
                ? `${data.enterprise.supplierRiskRadar[0].riskScore}/100`
                : "0/100"
            }
            tone="info"
            dark
          />
          <MetricCard label="Vendors in radar" value={`${data?.enterprise.supplierRiskRadar.length ?? 0}`} dark />
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
          <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1">
            ERP замовлення з виробництва: {productionOrders.length}
          </p>
          <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1">
            ERP заявки закупівлі: {purchaseRequests.length}
          </p>
          <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1">SLA моніторинг: online</p>
        </div>
      </header>

      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{err}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Risk thresholds (керовані)</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs text-slate-600">
            Systemic risk warn
            <input
              type="number"
              min={0}
              max={100}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={riskConfig.systemicWarn}
              onChange={(event) =>
                setRiskConfig((prev) => ({ ...prev, systemicWarn: Number(event.target.value || 0) }))
              }
            />
          </label>
          <label className="text-xs text-slate-600">
            Supplier risk warn
            <input
              type="number"
              min={0}
              max={100}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={riskConfig.supplierRiskWarn}
              onChange={(event) =>
                setRiskConfig((prev) => ({ ...prev, supplierRiskWarn: Number(event.target.value || 0) }))
              }
            />
          </label>
          <label className="text-xs text-slate-600">
            SLA warn below
            <input
              type="number"
              min={0}
              max={100}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={riskConfig.slaWarnBelow}
              onChange={(event) =>
                setRiskConfig((prev) => ({ ...prev, slaWarnBelow: Number(event.target.value || 0) }))
              }
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Пошук матеріалу за назвою або кодом…"
              className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            />
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Оновити дані
            </button>
          </div>

          <h2 className="mt-4 text-sm font-semibold text-slate-900">Дошка закупівельних ордерів</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {(["DRAFT", "ORDERED", "DELIVERED"] as const).map((status) => (
              <div key={status} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">{status}</p>
                <ProgressBar value={board(status).length} max={Math.max(data?.purchaseOrders.length ?? 1, 1)} />
                <ul className="mt-2 space-y-1 text-xs">
                  {board(status).map((order) => (
                    <li key={order.id} className="rounded border border-white bg-white px-2 py-1">
                      <p className="font-medium text-slate-800">{order.orderNumber}</p>
                      <p className="text-slate-600">{order.supplier.name}</p>
                    </li>
                  ))}
                  {board(status).length === 0 ? <li className="text-slate-400">Немає</li> : null}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-white p-3">
            <h3 className="text-sm font-semibold text-indigo-900">AI-рекомендації закупівлі</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              <li>{data?.ai.cheapestSupplier ?? "..."}</li>
              <li>{data?.ai.delays ?? "..."}</li>
              <li>{data?.ai.reorder ?? "..."}</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Процесні форми (ERP flow)</h2>
          <form
            className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              createPurchaseRequest();
            }}
          >
            <p className="text-xs font-semibold text-slate-700">Нова заявка від виробництва</p>
            <select
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              value={requestForm.productionOrder}
              onChange={(event) =>
                setRequestForm((prev) => ({ ...prev, productionOrder: event.target.value }))
              }
            >
              <option value="">Виберіть замовлення виробництва</option>
              {productionOrders.map((order) => (
                <option key={order.number} value={order.number}>
                  {order.number} · {order.client} · {order.status}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Номер виробничого замовлення (напр. PR-102)"
              value={requestForm.productionOrder}
              onChange={(event) =>
                setRequestForm((prev) => ({ ...prev, productionOrder: event.target.value }))
              }
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Код матеріалу"
              value={requestForm.materialCode}
              onChange={(event) => setRequestForm((prev) => ({ ...prev, materialCode: event.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                value={requestForm.qty}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, qty: Number(event.target.value || 1) }))}
              />
              <select
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                value={requestForm.priority}
                onChange={(event) =>
                  setRequestForm((prev) => ({
                    ...prev,
                    priority: event.target.value as PurchaseRequest["priority"],
                  }))
                }
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              value={requestForm.requiredDate}
              onChange={(event) => setRequestForm((prev) => ({ ...prev, requiredDate: event.target.value }))}
            />
            <textarea
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              rows={2}
              placeholder="Коментар для закупівлі"
              value={requestForm.comment}
              onChange={(event) => setRequestForm((prev) => ({ ...prev, comment: event.target.value }))}
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Створити заявку
            </button>
          </form>

          <form
            className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              onboardSupplier();
            }}
          >
            <p className="text-xs font-semibold text-slate-700">Onboarding постачальника</p>
            <input
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Назва постачальника"
              value={supplierForm.name}
              onChange={(event) => setSupplierForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <input
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Категорія"
              value={supplierForm.category}
              onChange={(event) => setSupplierForm((prev) => ({ ...prev, category: event.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                max={60}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                value={supplierForm.leadTimeDays}
                onChange={(event) =>
                  setSupplierForm((prev) => ({ ...prev, leadTimeDays: Number(event.target.value || 1) }))
                }
              />
              <input
                type="number"
                min={1}
                max={5}
                step={0.1}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                value={supplierForm.rating}
                onChange={(event) =>
                  setSupplierForm((prev) => ({ ...prev, rating: Number(event.target.value || 1) }))
                }
              />
            </div>
            <input
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Умови оплати"
              value={supplierForm.paymentTerms}
              onChange={(event) => setSupplierForm((prev) => ({ ...prev, paymentTerms: event.target.value }))}
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Додати в реєстр
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Склад і покриття запасів</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="py-2 pr-2">Матеріал</th>
                  <th className="py-2 pr-2">Код</th>
                  <th className="py-2 pr-2">Доступно</th>
                  <th className="py-2">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {data?.stock.map((row) => {
                  const qty = Number(row.quantity || 0);
                  const available = Number(row.available || 0);
                  const coverage = qty > 0 ? Math.round((available / qty) * 100) : 0;
                  return (
                    <tr key={row.id} className="border-b border-slate-50">
                      <td className="py-2 pr-2">{row.material.name}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{row.material.code}</td>
                      <td className="py-2 pr-2 tabular-nums">{row.available}</td>
                      <td className="py-2">
                        <ProgressBar value={coverage} max={100} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Реєстр постачальників (SLA / рейтинг)</h2>
          <ul className="mt-3 space-y-2">
            {data?.suppliers.map((supplier) => (
              <li key={supplier.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{supplier.name}</p>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                    rating {supplier.rating ?? "—"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{supplier.category}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Supplier risk radar</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="py-2 pr-2">Supplier</th>
                <th className="py-2 pr-2">SLA</th>
                <th className="py-2 pr-2">Payment discipline</th>
                <th className="py-2 pr-2">Delayed PO</th>
                <th className="py-2 pr-2">Spend</th>
                <th className="py-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {data?.enterprise.supplierRiskRadar.map((row) => (
                <tr key={row.supplierId} className="border-b border-slate-50">
                  <td className="py-2 pr-2 font-medium text-slate-900">{row.supplierName}</td>
                  <td className="py-2 pr-2">{row.slaPct}%</td>
                  <td className="py-2 pr-2">{row.paymentDisciplinePct}%</td>
                  <td className="py-2 pr-2">{row.delayedOrders}</td>
                  <td className="py-2 pr-2">{formatMoney(row.spend)} ₴</td>
                  <td className="py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        row.riskScore >= 70
                          ? "bg-rose-100 text-rose-800"
                          : row.riskScore >= 45
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {row.riskScore}/100 · {row.riskLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Операційний лог контуру</h2>
          <ul className="mt-3 space-y-2 text-xs">
            {opsFeed.map((entry) => (
              <li key={entry} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700">
                {entry}
              </li>
            ))}
            {opsFeed.length === 0 ? (
              <li className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-500">
                Події з процесних форм з&apos;являться тут.
              </li>
            ) : null}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Approval queue (ERP bridge)</h2>
            <ul className="mt-2 space-y-2 text-xs">
              {purchaseRequests.slice(0, 6).map((request) => (
                <li key={request.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <p className="font-medium text-slate-800">
                    {request.productionOrder} · {request.materialCode} · {request.status}
                  </p>
                  <div className="mt-1 flex gap-1">
                    {request.status === "NEW" ? (
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                        onClick={() => approvePurchaseRequest(request.id, "Procurement Lead")}
                      >
                        Approve
                      </button>
                    ) : null}
                    {request.status !== "DONE" ? (
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                        onClick={() => setPurchaseRequestStatus(request.id, "DONE", "Procurement Lead")}
                      >
                        Done
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
              {purchaseRequests.length === 0 ? <li className="text-slate-500">Черга апрувів порожня.</li> : null}
            </ul>
          </div>
          <div className="grid gap-2">
          <QuickLink href="/crm/production" title="Виробничий командний пункт" subtitle="замовлення, конструктори, апруви" />
          <QuickLink href="/crm/finance" title="Фінансовий центр ERP" subtitle="cash-flow, P&L, оплати постачальникам" />
          <QuickLink href="/crm/erp" title="Global ERP Command" subtitle="approval trail і наскрізний timeline" />
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
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

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(2, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));
  return (
    <div className="mt-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        />
      </div>
    </div>
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
