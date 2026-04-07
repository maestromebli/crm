"use client";

import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { tryReadResponseJson } from "@/lib/http/read-response-json";
import { patchJson } from "@/lib/api/patch-json";
import { formatMoneyUa } from "@/features/finance/lib/format-money";
import { movementKindLabel, refKindLabel } from "@/features/warehouse/lib/movement-labels";
import {
  ArrowLeftRight,
  ClipboardCopy,
  Download,
  Factory,
  Loader2,
  Package,
  ShoppingCart,
  Sparkles,
  Wallet,
} from "lucide-react";

type OverviewPayload = {
  kpi: {
    skuCount: number;
    totalQuantity: number;
    totalReserved: number;
    totalAvailable: number;
    estimatedValueUah: number;
    lowStockLines: number;
    coveragePct: number;
    lowStockThreshold: number;
  };
  insights?: {
    healthScore: number;
    stockWithoutZone: number;
    activeReservationsCount: number;
    reservationPressurePct: number;
    topByValue: Array<{ id: string; name: string; code: string | null; lineValueUah: number }>;
  };
  stock: Array<{
    id: string;
    sku: string | null;
    quantity: string;
    reserved: string;
    available: string;
    material: { id: string; name: string; code: string | null; price: string | null } | null;
    lineValueUah: number;
    storageZone?: { id: string; name: string; code: string; barcode: string } | null;
  }>;
  zones?: Array<{
    id: string;
    name: string;
    code: string;
    barcode: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  reservations?: Array<{
    id: string;
    quantity: number;
    materialName: string;
    materialCode: string | null;
    flowNumber: string | null;
    flowTitle: string | null;
    productionTaskId: string | null;
    note: string | null;
  }>;
  recentMovements?: Array<{
    id: string;
    kind: string;
    quantityDelta: number;
    refKind: string | null;
    refId: string | null;
    note: string | null;
    createdAt: string;
    materialName: string;
  }>;
  procurement: {
    openPurchaseOrders: number;
    inboundExpected7d: number;
    orders: Array<{
      id: string;
      orderNumber: string;
      status: string;
      total: string;
      expectedDate: string | null;
      supplierName: string;
      dealTitle: string | null;
    }>;
  };
  production: { reservedQty: number };
  finance: { inventoryEstimateUah: number; note: string };
  wms?: {
    reserveSchema: string;
    syncHint: string;
  };
};

const TABS: { id: string; label: string; href: string; description: string }[] = [
  { id: "overview", label: "Огляд", href: "/warehouse", description: "KPI та звʼязки контуру." },
  { id: "stock", label: "Залишки", href: "/warehouse/stock", description: "Таблиця номенклатури та доступності." },
  { id: "movements", label: "Рух", href: "/warehouse/movements", description: "Журнал проводок." },
  { id: "reservations", label: "Резерви", href: "/warehouse/reservations", description: "Резерви під виробництво." },
  { id: "zones", label: "Зони", href: "/warehouse/zones", description: "Стелажі та штрихкоди для ТСД." },
];

type StockFilter = "all" | "critical" | "reserved" | "no_zone";
type SortKey = "name" | "code" | "value" | "avail";

function normalizeSection(raw: string): string {
  const allowed = new Set(TABS.map((t) => t.id));
  return allowed.has(raw) ? raw : "overview";
}

function exportStockCsv(rows: OverviewPayload["stock"], filename: string) {
  const header = ["Матеріал", "Код", "Зона", "Всього", "Резерв", "Доступно", "Оцінка_грн"];
  const lines = rows.map((r) => {
    const zone = r.storageZone?.code ?? "";
    return [
      `"${(r.material?.name ?? "").replace(/"/g, '""')}"`,
      r.material?.code ?? r.sku ?? "",
      zone,
      r.quantity,
      r.reserved,
      r.available,
      String(r.lineValueUah),
    ].join(",");
  });
  const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function WarehouseHubClient({ activeSection }: { activeSection: string }) {
  const section = normalizeSection(activeSection);
  const reduceMotion = useReducedMotion();
  const searchRef = useRef<HTMLInputElement>(null);
  const hasLoadedOnce = useRef(false);

  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("value");
  const [syncBusy, setSyncBusy] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [zoneCode, setZoneCode] = useState("");
  const [zoneSaving, setZoneSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [updatingZoneFor, setUpdatingZoneFor] = useState<string | null>(null);
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    if (hasLoadedOnce.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch("/api/crm/warehouse/overview", { cache: "no-store" });
      const json = await tryReadResponseJson<OverviewPayload & { error?: string }>(res);
      if (!res.ok) {
        setData(null);
        setErr(json && "error" in json && json.error ? String(json.error) : "Не вдалося завантажити склад");
        return;
      }
      setData(json as OverviewPayload);
      hasLoadedOnce.current = true;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!successMsg) return;
    const t = window.setTimeout(() => setSuccessMsg(null), 6000);
    return () => window.clearTimeout(t);
  }, [successMsg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runSyncReservations = useCallback(async () => {
    setSyncBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/crm/warehouse/sync-reservations", { method: "POST" });
      const json = await tryReadResponseJson<{
        error?: string;
        ok?: boolean;
        reservationsUpserted?: number;
        tasksWithLines?: number;
        tasksConsidered?: number;
        stockItemsRecomputed?: number;
      }>(res);
      if (!res.ok) {
        setErr(json && "error" in json && json.error ? String(json.error) : "Синхронізація не вдалася");
        return;
      }
      setSuccessMsg(
        `Резерви оновлено: +${json.reservationsUpserted ?? 0} рядків, задач зі специфікацією: ${json.tasksWithLines ?? 0} з ${json.tasksConsidered ?? 0}, перераховано позицій: ${json.stockItemsRecomputed ?? 0}.`,
      );
      await load();
    } finally {
      setSyncBusy(false);
    }
  }, [load]);

  const createZone = useCallback(async () => {
    const name = zoneName.trim();
    const code = zoneCode.trim();
    if (!name || !code) return;
    setZoneSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/crm/warehouse/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code }),
      });
      const json = await tryReadResponseJson<{ error?: string }>(res);
      if (!res.ok) {
        setErr(json && "error" in json && json.error ? String(json.error) : "Не вдалося створити зону");
        return;
      }
      setSuccessMsg(`Зону «${name}» створено.`);
      setZoneName("");
      setZoneCode("");
      await load();
    } finally {
      setZoneSaving(false);
    }
  }, [load, zoneName, zoneCode]);

  const patchStockZone = useCallback(
    async (stockItemId: string, storageZoneId: string | null) => {
      setUpdatingZoneFor(stockItemId);
      setErr(null);
      try {
        await patchJson<{ ok?: boolean }>(
          `/api/crm/warehouse/stock/${stockItemId}`,
          { storageZoneId },
        );
        setSuccessMsg("Зону збережено.");
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Не вдалося змінити зону");
      } finally {
        setUpdatingZoneFor(null);
      }
    },
    [load],
  );

  const copyBarcode = useCallback(async (barcode: string) => {
    try {
      await navigator.clipboard.writeText(barcode);
      setCopiedBarcode(barcode);
      window.setTimeout(() => setCopiedBarcode((b) => (b === barcode ? null : b)), 2000);
    } catch {
      setErr("Не вдалося скопіювати в буфер");
    }
  }, []);

  const filteredStock = useMemo(() => {
    if (!data?.stock) return [];
    const s = dq.trim().toLowerCase();
    let rows = data.stock;

    if (s) {
      rows = rows.filter((row) => {
        const name = row.material?.name?.toLowerCase() ?? "";
        const code = row.material?.code?.toLowerCase() ?? "";
        const sku = row.sku?.toLowerCase() ?? "";
        const zone = row.storageZone?.code?.toLowerCase() ?? "";
        return name.includes(s) || code.includes(s) || sku.includes(s) || zone.includes(s);
      });
    }

    const low = data.kpi.lowStockThreshold;
    if (stockFilter === "critical") {
      rows = rows.filter((r) => Number(r.available) < low);
    } else if (stockFilter === "reserved") {
      rows = rows.filter((r) => Number(r.reserved) > 0);
    } else if (stockFilter === "no_zone") {
      rows = rows.filter((r) => !r.storageZone);
    }

    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sortKey === "value") return b.lineValueUah - a.lineValueUah;
      if (sortKey === "avail") return Number(b.available) - Number(a.available);
      if (sortKey === "code") {
        const ca = a.material?.code ?? a.sku ?? "";
        const cb = b.material?.code ?? b.sku ?? "";
        return ca.localeCompare(cb, "uk");
      }
      const na = a.material?.name ?? "";
      const nb = b.material?.name ?? "";
      return na.localeCompare(nb, "uk");
    });
    return sorted;
  }, [data?.stock, data?.kpi.lowStockThreshold, dq, stockFilter, sortKey]);

  const zones = data?.zones ?? [];
  const hasZones = zones.length > 0;

  return (
    <div className="enver-page-shell flex min-h-[70vh] flex-col px-3 py-3 md:px-6 md:py-4">
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-4">
        <nav className="text-[11px] text-[var(--enver-muted)]">
          <span className="font-medium text-[var(--enver-text)]">Склад</span>
          <span className="mx-1.5 text-[var(--enver-border-strong)]">/</span>
          <span>{TABS.find((t) => t.id === section)?.label ?? "Огляд"}</span>
        </nav>

        <header className="enver-panel enver-panel--interactive overflow-hidden px-4 py-3 shadow-sm ring-1 ring-slate-200/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="enver-eyebrow">ERP · WMS</p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight text-[var(--enver-text)] md:text-xl">
                Складський контур
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-[var(--enver-text-muted)] md:text-sm">
                Залишки, зони ТСД, журнал руху, резерви з цеху та оцінка запасів у єдиному операційному шарі.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runSyncReservations()}
                disabled={syncBusy || loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 shadow-sm hover:bg-emerald-100 disabled:opacity-60"
              >
                {syncBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {syncBusy ? "Синхронізація…" : "Синхронізувати резерви"}
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading || refreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Оновити
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--enver-border)] pt-3">
            {TABS.map((t) => {
              const active = t.id === section;
              return (
                <Link
                  key={t.id}
                  href={t.href}
                  title={t.description}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "bg-slate-900 text-white shadow-md shadow-slate-900/15"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </header>

        {successMsg ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-2.5 text-sm text-emerald-950 shadow-sm">
            {successMsg}
          </div>
        ) : null}

        {err ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
            {err}
          </div>
        ) : null}

        {loading && !data ? <LoadingSkeleton /> : null}

        {!loading && !data && !err ? (
          <p className="text-sm text-slate-500">Немає даних.</p>
        ) : null}

        {data ? (
          <>
            {(section === "stock" || section === "reservations") && (
              <motion.section
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <KpiCard label="Номенклатура (SKU)" value={String(data.kpi.skuCount)} hint="Активні позиції" />
                <KpiCard
                  label="Оцінка залишків"
                  value={`${formatMoneyUa(data.finance.inventoryEstimateUah)} ₴`}
                  hint={data.finance.note}
                  tone="info"
                />
                <KpiCard
                  label="Доступно / резерв"
                  value={`${data.kpi.totalAvailable} / ${data.kpi.totalReserved}`}
                  hint="Одиниці обліку"
                />
                <KpiCard
                  label="Покриття / критичні"
                  value={`${data.kpi.coveragePct}% · ${data.kpi.lowStockLines}`}
                  hint={`Поріг: менше ${data.kpi.lowStockThreshold} од.`}
                  tone={data.kpi.lowStockLines > 0 ? "warn" : "ok"}
                />
              </motion.section>
            )}

            {section === "overview" && data.insights ? (
              <motion.section
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]"
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard label="Номенклатура (SKU)" value={String(data.kpi.skuCount)} hint="Активні позиції" />
                  <KpiCard
                    label="Оцінка залишків"
                    value={`${formatMoneyUa(data.finance.inventoryEstimateUah)} ₴`}
                    hint={data.finance.note}
                    tone="info"
                  />
                  <KpiCard
                    label="Доступно / резерв"
                    value={`${data.kpi.totalAvailable} / ${data.kpi.totalReserved}`}
                    hint={`Навантаження резерву: ${data.insights.reservationPressurePct}%`}
                  />
                  <KpiCard
                    label="Критичні / без зони"
                    value={`${data.kpi.lowStockLines} / ${data.insights.stockWithoutZone}`}
                    hint={`Поріг «мало»: менше ${data.kpi.lowStockThreshold} од. доступно`}
                    tone={data.kpi.lowStockLines > 0 ? "warn" : "ok"}
                  />
                </div>
                <HealthRing score={data.insights.healthScore} />
              </motion.section>
            ) : null}

            {section === "overview" && data.insights && data.insights.topByValue.length > 0 ? (
              <div className="enver-panel px-4 py-3">
                <h2 className="text-sm font-semibold text-[var(--enver-text)]">Топ за вартістю залишку</h2>
                <ul className="mt-2 divide-y divide-slate-100">
                  {data.insights.topByValue.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span className="font-medium text-[var(--enver-text)]">{t.name}</span>
                      <span className="text-xs text-slate-500">{t.code ?? "—"}</span>
                      <span className="tabular-nums text-slate-800">{formatMoneyUa(t.lineValueUah)} ₴</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {section === "overview" && data.wms ? (
              <div className="enver-panel px-4 py-3 text-xs text-slate-600">
                <p className="font-medium text-slate-800">Автоматичні резерви з задач цеху</p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{data.wms.reserveSchema}</p>
                <p className="mt-2 text-[11px] text-slate-500">{data.wms.syncHint}</p>
              </div>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                {section === "movements" ? (
                  <div className="space-y-3">
                    <div className="enver-panel px-4 py-4 text-sm text-[var(--enver-text-muted)]">
                      <h2 className="text-sm font-semibold text-[var(--enver-text)]">Журнал руху</h2>
                      <p className="mt-2">
                        Аудит проводок: надходження, видача, переміщення між зонами. Закупівлі та PO — у{" "}
                        <Link
                          href="/crm/procurement?view=hub"
                          className="font-medium text-sky-700 underline-offset-2 hover:underline"
                        >
                          хабі закупівель
                        </Link>
                        .
                      </p>
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px]">
                        <li>Відкриті PO: {data.procurement.openPurchaseOrders}</li>
                        <li>Очікується протягом 7 днів: {data.procurement.inboundExpected7d}</li>
                      </ul>
                    </div>
                    <div className="enver-panel overflow-hidden shadow-sm ring-1 ring-slate-200/50">
                      <div className="border-b border-[var(--enver-border)] px-3 py-2">
                        <h3 className="text-sm font-semibold text-[var(--enver-text)]">Останні записи</h3>
                      </div>
                      <div className="max-h-[min(480px,55vh)] overflow-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 shadow-sm">
                            <tr>
                              <th className="px-3 py-2">Час</th>
                              <th className="px-3 py-2">Тип</th>
                              <th className="px-3 py-2">Δ</th>
                              <th className="px-3 py-2">Матеріал</th>
                              <th className="px-3 py-2">Джерело</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(data.recentMovements ?? []).map((m) => (
                              <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                                  {m.createdAt.slice(0, 19).replace("T", " ")}
                                </td>
                                <td className="px-3 py-2 text-xs font-medium text-slate-800">
                                  {movementKindLabel(m.kind)}
                                </td>
                                <td className="px-3 py-2 tabular-nums">{m.quantityDelta}</td>
                                <td className="px-3 py-2">{m.materialName}</td>
                                <td className="px-3 py-2 text-xs text-slate-500">
                                  {refKindLabel(m.refKind)}
                                  {m.refId ? ` · ${m.refId.slice(0, 8)}…` : ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(data.recentMovements ?? []).length === 0 ? (
                          <p className="px-3 py-8 text-center text-sm text-slate-500">
                            Журнал порожній — зʼявлятиметься після операцій (зокрема зміни зони позиції).
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {section === "reservations" ? (
                  <div className="space-y-3">
                    <div className="enver-panel px-4 py-4 text-sm text-[var(--enver-text-muted)]">
                      <h2 className="text-sm font-semibold text-[var(--enver-text)]">Резерви під виробництво</h2>
                      <p className="mt-2">
                        Всього зарезервовано:{" "}
                        <strong className="text-[var(--enver-text)]">
                          {new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(data.production.reservedQty)}
                        </strong>{" "}
                        од.{" "}
                        <Link href="/crm/production/workshop" className="font-medium text-sky-700 hover:underline">
                          Kanban
                        </Link>
                      </p>
                    </div>
                    <div className="enver-panel overflow-hidden shadow-sm ring-1 ring-slate-200/50">
                      <div className="border-b border-[var(--enver-border)] px-3 py-2">
                        <h3 className="text-sm font-semibold text-[var(--enver-text)]">Активні резерви</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Матеріал</th>
                              <th className="px-3 py-2">Кількість</th>
                              <th className="px-3 py-2">Потік</th>
                              <th className="px-3 py-2">Примітка</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(data.reservations ?? []).map((r) => (
                              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                                <td className="px-3 py-2">
                                  <span className="font-medium text-[var(--enver-text)]">{r.materialName}</span>
                                  {r.materialCode ? (
                                    <span className="ml-1 text-xs text-slate-500">({r.materialCode})</span>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 tabular-nums">{r.quantity}</td>
                                <td className="px-3 py-2 text-xs">
                                  {r.flowNumber ?? "—"}
                                  {r.flowTitle ? <span className="block text-slate-500">{r.flowTitle}</span> : null}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-600">{r.note ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(data.reservations ?? []).length === 0 ? (
                          <p className="px-3 py-8 text-center text-sm text-slate-500">
                            Порожньо. Запустіть синхронізацію або додайте{" "}
                            <code className="rounded bg-slate-100 px-1">warehouseReserve</code> у задачі WORKSHOP.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {section === "zones" ? (
                  <div className="space-y-3">
                    <div className="enver-panel px-4 py-4">
                      <h2 className="text-sm font-semibold text-[var(--enver-text)]">Зони зберігання</h2>
                      <p className="mt-1 text-xs text-[var(--enver-text-muted)]">
                        Штрихкод унікальний — друкуйте на етикетку стелажа; скануйте ТСД для навігації кладовщика.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          value={zoneName}
                          onChange={(e) => setZoneName(e.target.value)}
                          placeholder="Назва (напр. Ряд А)"
                          className="min-w-[160px] flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm shadow-inner"
                        />
                        <input
                          value={zoneCode}
                          onChange={(e) => setZoneCode(e.target.value)}
                          placeholder="Код (A1)"
                          className="w-28 rounded-md border border-slate-200 px-2 py-1.5 text-sm shadow-inner"
                        />
                        <button
                          type="button"
                          disabled={zoneSaving || !zoneName.trim() || !zoneCode.trim()}
                          onClick={() => void createZone()}
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm disabled:opacity-50"
                        >
                          {zoneSaving ? "Збереження…" : "Додати зону"}
                        </button>
                      </div>
                    </div>
                    <div className="enver-panel overflow-hidden shadow-sm ring-1 ring-slate-200/50">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2">Назва</th>
                              <th className="px-3 py-2">Код</th>
                              <th className="px-3 py-2">Штрихкод</th>
                              <th className="px-3 py-2 w-24" />
                            </tr>
                          </thead>
                          <tbody>
                            {(data.zones ?? []).map((z) => (
                              <tr key={z.id} className="border-t border-slate-100">
                                <td className="px-3 py-2 font-medium">{z.name}</td>
                                <td className="px-3 py-2 font-mono text-xs">{z.code}</td>
                                <td className="px-3 py-2 font-mono text-xs text-sky-900">{z.barcode}</td>
                                <td className="px-3 py-2">
                                  <button
                                    type="button"
                                    onClick={() => void copyBarcode(z.barcode)}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    <ClipboardCopy className="h-3 w-3" />
                                    {copiedBarcode === z.barcode ? "OK" : "Копіювати"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(data.zones ?? []).length === 0 ? (
                          <p className="px-3 py-8 text-center text-sm text-slate-500">
                            Створіть першу зону — потім призначайте її в таблиці залишків.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {(section === "overview" || section === "stock" || section === "reservations") && (
                  <div className="enver-panel overflow-hidden shadow-sm ring-1 ring-slate-200/50">
                    <div className="flex flex-col gap-2 border-b border-[var(--enver-border)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-sm font-semibold text-[var(--enver-text)]">
                        {section === "reservations" ? "Позиції з резервом" : "Залишки на складі"}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={sortKey}
                          onChange={(e) => setSortKey(e.target.value as SortKey)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
                        >
                          <option value="value">Сортування: вартість</option>
                          <option value="avail">Сортування: доступно</option>
                          <option value="name">Сортування: назва</option>
                          <option value="code">Сортування: код</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            exportStockCsv(
                              filteredStock,
                              `warehouse-stock-${new Date().toISOString().slice(0, 10)}.csv`,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          CSV
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-3 py-2">
                      {(
                        [
                          ["all", "Усі"],
                          ["critical", "Критичні"],
                          ["reserved", "З резервом"],
                          ["no_zone", "Без зони"],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setStockFilter(id)}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                            stockFilter === id
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
                      <input
                        ref={searchRef}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Пошук… (натисніть / для фокусу)"
                        className="min-w-[200px] flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs shadow-inner outline-none focus:ring-2 focus:ring-sky-500/25"
                      />
                      <span className="hidden text-[10px] text-slate-400 sm:inline">
                        {filteredStock.length} з {data.stock.length}
                      </span>
                    </div>
                    <div className="max-h-[min(520px,60vh)] overflow-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 shadow-sm">
                          <tr>
                            <th className="px-3 py-2">Матеріал</th>
                            <th className="px-3 py-2">Код</th>
                            <th className="px-3 py-2">Зона</th>
                            <th className="px-3 py-2">Всього</th>
                            <th className="px-3 py-2">Резерв</th>
                            <th className="px-3 py-2">Доступно</th>
                            <th className="px-3 py-2">Оцінка, ₴</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStock.map((row) => {
                            const res = Number(row.reserved);
                            const low = data.kpi.lowStockThreshold;
                            const highlight =
                              section === "reservations"
                                ? res > 0
                                : Number(row.available) < low;
                            return (
                              <tr
                                key={row.id}
                                className={`border-t border-slate-100 transition hover:bg-slate-50/90 ${
                                  highlight ? "bg-amber-50/70" : ""
                                }`}
                              >
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-[var(--enver-text)]">
                                      {row.material?.name ?? "—"}
                                    </span>
                                    {Number(row.available) < low ? (
                                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-800">
                                        мало
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{row.material?.code ?? row.sku ?? "—"}</td>
                                <td className="px-2 py-1.5 align-middle">
                                  {hasZones ? (
                                    <div className="flex items-center gap-1">
                                      <select
                                        disabled={updatingZoneFor === row.id}
                                        value={row.storageZone?.id ?? ""}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          void patchStockZone(row.id, v === "" ? null : v);
                                        }}
                                        className="max-w-[9rem] rounded border border-slate-200 bg-white py-1 pl-1 pr-6 text-[11px] text-slate-800 shadow-sm disabled:opacity-50"
                                      >
                                        <option value="">— зона —</option>
                                        {zones.map((z) => (
                                          <option key={z.id} value={z.id}>
                                            {z.code} · {z.name}
                                          </option>
                                        ))}
                                      </select>
                                      {updatingZoneFor === row.id ? (
                                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-500" />
                                      ) : null}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-500">
                                      {row.storageZone ? row.storageZone.code : "—"}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 tabular-nums text-slate-800">{row.quantity}</td>
                                <td className="px-3 py-2 tabular-nums text-amber-900/90">{row.reserved}</td>
                                <td className="px-3 py-2 tabular-nums font-medium text-slate-900">{row.available}</td>
                                <td className="px-3 py-2 tabular-nums text-slate-800">{formatMoneyUa(row.lineValueUah)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredStock.length === 0 ? (
                        <p className="px-3 py-10 text-center text-sm text-slate-500">Нічого не знайдено за фільтрами.</p>
                      ) : null}
                    </div>
                  </div>
                )}

                {section === "overview" && data.procurement.orders.length > 0 ? (
                  <div className="enver-panel overflow-hidden shadow-sm ring-1 ring-slate-200/50">
                    <div className="border-b border-[var(--enver-border)] px-3 py-2">
                      <h2 className="text-sm font-semibold text-[var(--enver-text)]">Найближчі поставки</h2>
                      <p className="text-[11px] text-slate-500">Звʼязок з PO у закупівлях.</p>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {data.procurement.orders.map((o) => (
                        <li
                          key={o.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm transition hover:bg-slate-50/80"
                        >
                          <span className="font-mono text-xs text-slate-700">{o.orderNumber}</span>
                          <span className="text-slate-600">{o.supplierName}</span>
                          <span className="text-xs text-slate-500">
                            {o.expectedDate ? o.expectedDate.slice(0, 10) : "дата уточнюється"}
                          </span>
                          <Link
                            href="/crm/procurement?view=hub"
                            className="text-[11px] font-medium text-sky-700 hover:underline"
                          >
                            хаб
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              <aside className="space-y-3">
                <div className="enver-panel px-3 py-3 shadow-sm ring-1 ring-slate-200/40">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Звʼязки контуру</p>
                  <ul className="mt-3 space-y-2">
                    <ContourLink
                      href="/crm/procurement?view=hub"
                      icon={ShoppingCart}
                      title="Закупівлі"
                      subtitle="PO, постачальники, приймання на склад"
                    />
                    <ContourLink
                      href="/crm/finance"
                      icon={Wallet}
                      title="Фінанси"
                      subtitle="Оцінка запасів, каса, кредиторка по PO"
                    />
                    <ContourLink
                      href="/crm/production"
                      icon={Factory}
                      title="Виробництво"
                      subtitle="Резерви матеріалів під виробничі замовлення"
                    />
                    <ContourLink
                      href="/crm/procurement"
                      icon={Package}
                      title="Реєстр закупівель"
                      subtitle="Заявки та замовлення"
                    />
                  </ul>
                </div>
                <div className="rounded-xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white px-3 py-3 text-xs text-slate-600 shadow-sm">
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    <ArrowLeftRight className="h-4 w-4 shrink-0 text-sky-700" />
                    Наскрізний потік
                  </div>
                  <p className="mt-2 leading-relaxed">
                    Заявка → PO → надходження → зона ТСД → резерв цеху → списання / монтаж.
                  </p>
                </div>
              </aside>
            </section>

          </>
        ) : null}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-200/80" />
        ))}
      </div>
      <div className="h-40 rounded-xl bg-slate-200/60" />
    </div>
  );
}

function HealthRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const tone =
    clamped >= 75 ? "from-emerald-500 to-teal-600" : clamped >= 45 ? "from-amber-500 to-orange-500" : "from-rose-500 to-red-600";
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br ${tone} p-4 text-center text-white shadow-lg`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/90">Складський індекс</p>
      <p className="mt-1 text-4xl font-bold tabular-nums leading-none">{clamped}</p>
      <p className="mt-2 text-[11px] leading-snug text-white/85">
        За критичними залишками, позиціями без зони та резервним навантаженням.
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "ok" | "info";
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-200 bg-amber-50"
      : tone === "ok"
        ? "border-emerald-200 bg-emerald-50"
        : tone === "info"
          ? "border-cyan-200 bg-cyan-50"
          : "border-slate-200 bg-white";
  return (
    <div className={`rounded-xl border px-3 py-3 shadow-sm ${toneClass}`}>
      <p className="text-[11px] font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ContourLink({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-2 py-2 transition hover:border-sky-200 hover:bg-sky-50/60"
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
        <span>
          <span className="block text-sm font-medium text-slate-900">{title}</span>
          <span className="block text-[11px] text-slate-500">{subtitle}</span>
        </span>
      </Link>
    </li>
  );
}
