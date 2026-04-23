"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useErpBridge } from "@/components/erp/ErpBridgeProvider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProcurementOrderedMonitorTable } from "@/features/procurement/components/ProcurementOrderedMonitorTable";
import { patchJson, postJson } from "@/lib/api/patch-json";
import {
  readHubSegment,
  writeHubSegment,
  type HubSegment,
} from "@/features/procurement/lib/ordered-monitor-prefs";
import type { OrderedLineMonitorRow } from "@/features/procurement/lib/ordered-line-monitor";
import { tryReadResponseJson } from "@/lib/http/read-response-json";
import {
  clearProcurementQuickActionParams,
  parseProcurementQuickActionFromSearchParams,
} from "@/features/procurement/lib/quick-actions";

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
  procurementRequests?: Array<{
    id: string;
    dealId: string;
    dealTitle: string | null;
    status: string;
    workflowStatus?: string;
    priority: string | null;
    neededByDate: string | null;
  }>;
  dashboard?: {
    pendingApprovals: number;
    delayedOrders: number;
    priceDeviations: Array<{
      requestId: string;
      itemName: string;
      dealTitle: string;
      planned: number;
      actual: number;
      variance: number;
    }>;
    orderedLineMonitor?: Array<{
      rowKey: string;
      dealId: string;
      dealTitle: string;
      requestId: string;
      itemId: string;
      itemName: string;
      requestStatus: string;
      neededByDate: string | null;
      qtyPlanned: number;
      qtyOrdered: number;
      qtyReceived: number;
      plannedValue: number;
      orderedValue: number;
      receivedValue: number;
      qtyRemaining: number;
      valueRemainingPlanned: number;
      unitPriceDelta: number;
      deadlineStatus: "overdue" | "soon" | "ok" | "none";
      financeFlag: "overrun" | "on_track" | "saving";
      daysUntilDue: number | null;
      fulfillmentPct: number;
    }>;
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
};

const DEFAULT_RISK = {
  systemicWarn: 55,
  supplierRiskWarn: 65,
  slaWarnBelow: 75,
  criticalDueSoonWarn: 3,
  priceVarianceWarnPct: 8,
};

const PRIO_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};
type PriorityCode = keyof typeof PRIO_RANK;

function sortProcurementRequests(
  rows: NonNullable<Dash["procurementRequests"]>,
): NonNullable<Dash["procurementRequests"]> {
  const now = Date.now();
  return [...rows].sort((a, b) => {
    const ta = a.neededByDate ? new Date(a.neededByDate).getTime() : Number.NaN;
    const tb = b.neededByDate ? new Date(b.neededByDate).getTime() : Number.NaN;
    const aOver = !Number.isNaN(ta) && ta < now;
    const bOver = !Number.isNaN(tb) && tb < now;
    if (aOver !== bOver) return aOver ? -1 : 1;
    if (Number.isNaN(ta) && Number.isNaN(tb)) {
      return (PRIO_RANK[a.priority ?? ""] ?? 9) - (PRIO_RANK[b.priority ?? ""] ?? 9);
    }
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    if (ta !== tb) return ta - tb;
    return (PRIO_RANK[a.priority ?? ""] ?? 9) - (PRIO_RANK[b.priority ?? ""] ?? 9);
  });
}

function dueHint(iso: string | null, nowMs: number): { label: string; overdue: boolean; soon: boolean } {
  if (!iso) return { label: "без дати", overdue: false, soon: false };
  const end = new Date(iso).getTime();
  const d = Math.ceil((end - nowMs) / (24 * 60 * 60 * 1000));
  if (d < 0) return { label: `−${Math.abs(d)} дн.`, overdue: true, soon: false };
  if (d === 0) return { label: "сьогодні", overdue: false, soon: true };
  if (d <= 3) return { label: `за ${d} дн.`, overdue: false, soon: true };
  return { label: iso.slice(0, 10), overdue: false, soon: false };
}

function dueDays(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - nowMs) / (24 * 60 * 60 * 1000));
}

function suggestPriorityBySignals(input: {
  dueInDays: number | null;
  priceVariancePct: number;
  currentPriority: string | null;
}): { priority: PriorityCode; reason: string } {
  const current = (input.currentPriority ?? "").toUpperCase();
  if (input.dueInDays !== null && input.dueInDays < 0) {
    return { priority: "CRITICAL", reason: "дедлайн прострочено" };
  }
  if (input.dueInDays !== null && input.dueInDays <= 1) {
    return { priority: "CRITICAL", reason: "дедлайн сьогодні/завтра" };
  }
  if (input.priceVariancePct >= 15) {
    return { priority: "CRITICAL", reason: "цінове відхилення >= 15%" };
  }
  if (input.dueInDays !== null && input.dueInDays <= 3) {
    return { priority: "HIGH", reason: "ризик зсуву виробництва (<= 3 дні)" };
  }
  if (input.priceVariancePct >= 8) {
    return { priority: "HIGH", reason: "цінове відхилення >= 8%" };
  }
  if (current === "CRITICAL" || current === "HIGH" || current === "MEDIUM" || current === "LOW") {
    return { priority: current as PriorityCode, reason: "поточний пріоритет збережено" };
  }
  return { priority: "MEDIUM", reason: "стандартна черга закупівлі" };
}

function readRiskConfigFromStorage() {
  if (typeof window === "undefined") return DEFAULT_RISK;
  try {
    const raw = localStorage.getItem("procurement-hub-risk");
    if (!raw) return DEFAULT_RISK;
    const p = JSON.parse(raw) as Partial<typeof DEFAULT_RISK>;
    return { ...DEFAULT_RISK, ...p };
  } catch {
    return DEFAULT_RISK;
  }
}

type ProcurementHubClientProps = {
  initialOpenNewRequest?: boolean;
  initialDealId?: string;
};

type ProcurementHubTab = "overview" | "operations" | "suppliers" | "reconcile";
type RequestSourceContext = "procurement_hub" | "constructor_workspace";
type DispatchChannel = "telegram" | "whatsapp" | "viber";

type InvoiceReconcileData = {
  request: {
    id: string;
    number: string | null;
    dealTitle: string;
    supplierName: string | null;
    workflowStatus: string;
    invoiceAmount: number;
    aiMatchedAt: string | null;
  };
  summary: {
    matchedItems: number;
    totalRequestItems: number;
    totalSupplierLines: number;
    plannedTotal: number;
    supplierTotal: number;
    totalDelta: number;
    warnings: number;
    missing: number;
  };
  lines: Array<{
    itemId: string;
    itemName: string;
    plannedQty: number;
    plannedUnitPrice: number;
    plannedTotal: number;
    supplierLineName: string | null;
    supplierQty: number;
    supplierUnitPrice: number;
    supplierTotal: number;
    qtyDelta: number;
    priceDelta: number;
    totalDelta: number;
    confidencePct: number;
    status: "ok" | "warning" | "missing";
  }>;
  canConfirmForApproval: boolean;
};

const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  new_request: "Нова заявка",
  in_progress_by_purchaser: "В роботі закупівельника",
  ai_grouping: "AI-групування",
  grouped_by_supplier_or_category: "Розгруповано по постачальниках/категоріях",
  sent_to_supplier: "Надіслано постачальнику",
  supplier_response_received: "Відповідь від постачальника",
  supplier_invoice_uploaded: "Файл постачальника завантажено",
  invoice_ai_matched: "AI розподілив рахунок по замовленнях",
  invoice_verification: "Звірка рахунку закупівельником",
  approval_pending: "На погодженні",
  sent_to_payment: "Передано в бухгалтерію",
  payment_method_selected: "Метод оплати обрано",
  paid: "Оплачено",
  receipt_verification_pending: "Очікує перевірки надходження",
  awaiting_delivery: "Очікується поставка",
  goods_received: "Товар отримано",
  stock_posted: "Оприбутковано на склад",
  reserved_for_order: "Зарезервовано під замовлення",
  issued_to_production: "Передано у виробництво",
  returned_for_revision: "Повернено на корекцію",
  rejected: "Відхилено",
};

export function ProcurementHubClient({
  initialOpenNewRequest = false,
  initialDealId = "",
}: ProcurementHubClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Dash | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState<PurchaseRequest>(EMPTY_REQUEST);
  const [supplierForm, setSupplierForm] = useState<SupplierOnboarding>(EMPTY_SUPPLIER);
  const [dealId, setDealId] = useState("");
  const [requestSourceContext, setRequestSourceContext] =
    useState<RequestSourceContext>("procurement_hub");
  const [deals, setDeals] = useState<Array<{ id: string; title: string }>>([]);
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [dbRequestSaving, setDbRequestSaving] = useState(false);
  const [supplierFileRequestId, setSupplierFileRequestId] = useState("");
  const [supplierFile, setSupplierFile] = useState<File | null>(null);
  const [supplierFileUploading, setSupplierFileUploading] = useState(false);
  const [dispatchRequestId, setDispatchRequestId] = useState("");
  const [dispatchChannel, setDispatchChannel] = useState<DispatchChannel>("telegram");
  const [dispatchTarget, setDispatchTarget] = useState("");
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [generatedDispatchMessage, setGeneratedDispatchMessage] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [reconcileRequestId, setReconcileRequestId] = useState("");
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [reconcileData, setReconcileData] = useState<InvoiceReconcileData | null>(null);
  const [showAllBridge, setShowAllBridge] = useState(false);
  const [applyingPriorityRequestId, setApplyingPriorityRequestId] = useState<string | null>(null);
  const [transitioningRequestId, setTransitioningRequestId] = useState<string | null>(null);
  const [opsFeed, setOpsFeed] = useState<string[]>([]);
  const [riskConfig, setRiskConfig] = useState(DEFAULT_RISK);
  const skipFirstRiskPersist = useRef(true);
  const firedAlertsRef = useRef<Set<string>>(new Set());
  const [nowLabel, setNowLabel] = useState("—");
  const [lineMonitorFilter, setLineMonitorFilter] = useState<HubSegment>("all");
  const [activeTab, setActiveTab] = useState<ProcurementHubTab>("overview");
  const [hubMonitorSegmentReady, setHubMonitorSegmentReady] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pollMs, setPollMs] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const requestFormRef = useRef<HTMLFormElement | null>(null);
  const quickActionAppliedRef = useRef(false);
  const {
    productionOrders,
    addPurchaseRequest,
    addEvent,
    bumpProductionTasks,
    purchaseRequests,
    approvePurchaseRequest,
    setPurchaseRequestStatus,
  } = useErpBridge();

  const load = useCallback(async (query: string) => {
    setErr(null);
    try {
      const r = await fetch(`/api/crm/procurement/dashboard${query ? `?q=${encodeURIComponent(query)}` : ""}`, {
        cache: "no-store",
      });
      const j = await tryReadResponseJson<Dash & { error?: string }>(r);
      if (!r.ok) throw new Error(j?.error ?? "Помилка");
      if (!j) throw new Error("Порожня відповідь сервера");
      setData(j);
      setLastSyncedAt(new Date().toISOString());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    }
  }, []);

  useEffect(() => {
    setRiskConfig(readRiskConfigFromStorage());
  }, []);

  useEffect(() => {
    setLineMonitorFilter(readHubSegment());
    setHubMonitorSegmentReady(true);
  }, []);

  useEffect(() => {
    if (!hubMonitorSegmentReady) return;
    writeHubSegment(lineMonitorFilter);
  }, [hubMonitorSegmentReady, lineMonitorFilter]);

  useEffect(() => {
    if (skipFirstRiskPersist.current) {
      skipFirstRiskPersist.current = false;
      return;
    }
    try {
      localStorage.setItem("procurement-hub-risk", JSON.stringify(riskConfig));
    } catch {
      /* ignore */
    }
  }, [riskConfig]);

  useEffect(() => {
    const delay = q === "" ? 0 : 450;
    const t = setTimeout(() => void load(q), delay);
    return () => clearTimeout(t);
  }, [q, load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/crm/procurement/deals", { cache: "no-store" });
        const j = await tryReadResponseJson<{ deals?: Array<{ id: string; title: string }> }>(r);
        if (!cancelled && r.ok && j?.deals) setDeals(j.deals);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (quickActionAppliedRef.current) return;

    const fromUrl = parseProcurementQuickActionFromSearchParams(searchParams);
    const shouldOpenNewRequest = fromUrl.openNewRequest || initialOpenNewRequest;
    const linkedDealId = fromUrl.dealId || initialDealId.trim();
    const sourceContext =
      fromUrl.source === "constructor_workspace"
        ? "constructor_workspace"
        : "procurement_hub";
    const hasQuickActionParams = Boolean(fromUrl.openNewRequest || fromUrl.dealId);
    if (!shouldOpenNewRequest && !linkedDealId && !hasQuickActionParams) return;

    quickActionAppliedRef.current = true;

    if (linkedDealId) {
      setDealId(linkedDealId);
    }
    setRequestSourceContext(sourceContext);

    if (shouldOpenNewRequest) {
      setActiveTab("overview");
      setOpsFeed((prev) => [
        `Швидка дія → форма нової заявки готова${linkedDealId ? ` (замовлення ${linkedDealId})` : ""}${
          sourceContext === "constructor_workspace" ? " · джерело: воркспейс конструктора" : ""
        }`,
        ...prev,
      ]);
      window.requestAnimationFrame(() => {
        requestFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        requestFormRef.current
          ?.querySelector<HTMLInputElement>('input[list="procurement-prod-orders"]')
          ?.focus();
      });
    }

    const next = new URLSearchParams(searchParams.toString());
    if (clearProcurementQuickActionParams(next)) {
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }, [initialDealId, initialOpenNewRequest, pathname, router, searchParams]);

  useEffect(() => {
    if (window.location.hash === "#supplier-onboarding" || window.location.hash === "#new-request") {
      setActiveTab("overview");
    }
  }, []);

  useEffect(() => {
    if (!dealId || deals.length === 0) return;
    if (deals.some((d) => d.id === dealId)) return;
    setDealId("");
    setOpsFeed((prev) => [
      `Швидка дія → замовлення ${dealId} не знайдено, оберіть вручну`,
      ...prev,
    ]);
  }, [dealId, deals]);

  useEffect(() => {
    const updateNow = () => setNowLabel(new Date().toLocaleString("uk-UA"));
    updateNow();
    const timer = setInterval(updateNow, 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (pollMs <= 0) return;
    const id = window.setInterval(() => void load(q), pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, q, load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void load(q);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load, q]);

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

  const filteredOrderedLineMonitor = useMemo((): OrderedLineMonitorRow[] => {
    const raw = (data?.dashboard?.orderedLineMonitor ?? []) as OrderedLineMonitorRow[];
    if (lineMonitorFilter === "deadline") {
      return raw.filter((r) => r.deadlineStatus === "overdue" || r.deadlineStatus === "soon");
    }
    if (lineMonitorFilter === "finance") {
      return raw.filter((r) => r.financeFlag === "overrun" || r.financeFlag === "saving");
    }
    return raw;
  }, [data, lineMonitorFilter]);

  const sortedCrmRequests = useMemo(() => {
    if (!data?.procurementRequests?.length) return [];
    return sortProcurementRequests(data.procurementRequests);
  }, [data?.procurementRequests]);

  useEffect(() => {
    if (!sortedCrmRequests.length) return;
    if (reconcileRequestId) return;
    setReconcileRequestId(sortedCrmRequests[0]!.id);
  }, [reconcileRequestId, sortedCrmRequests]);

  const nowMsForDueHints = clock;
  const criticalDueSoonCount = useMemo(() => {
    if (!sortedCrmRequests.length) return 0;
    return sortedCrmRequests.filter((r) => {
      if (!r.neededByDate) return false;
      if (r.status === "RECEIVED" || r.status === "CLOSED" || r.status === "CANCELLED") return false;
      const d = dueHint(r.neededByDate, nowMsForDueHints);
      return d.overdue || d.soon;
    }).length;
  }, [nowMsForDueHints, sortedCrmRequests]);
  const maxPriceVariancePct = useMemo(() => {
    const deviations = data?.dashboard?.priceDeviations ?? [];
    if (!deviations.length) return 0;
    return deviations.reduce((max, row) => {
      if (row.planned <= 0) return max;
      const pct = Math.abs((row.variance / row.planned) * 100);
      return Math.max(max, pct);
    }, 0);
  }, [data?.dashboard?.priceDeviations]);
  const priceVarianceByRequestPct = useMemo(() => {
    const map = new Map<string, number>();
    const deviations = data?.dashboard?.priceDeviations ?? [];
    for (const row of deviations) {
      if (row.planned <= 0) continue;
      const pct = Math.abs((row.variance / row.planned) * 100);
      map.set(row.requestId, Math.max(map.get(row.requestId) ?? 0, pct));
    }
    return map;
  }, [data?.dashboard?.priceDeviations]);
  const prioritizedRequests = useMemo(() => {
    return sortedCrmRequests.map((r) => {
      const dueInDays = dueDays(r.neededByDate ?? null, nowMsForDueHints);
      const priceVariancePct = priceVarianceByRequestPct.get(r.id) ?? 0;
      const suggested = suggestPriorityBySignals({
        dueInDays,
        priceVariancePct,
        currentPriority: r.priority,
      });
      return {
        ...r,
        dueInDays,
        priceVariancePct,
        suggestedPriority: suggested.priority,
        suggestedReason: suggested.reason,
      };
    });
  }, [nowMsForDueHints, priceVarianceByRequestPct, sortedCrmRequests]);
  const redLineBlockers = useMemo(() => {
    const rows = data?.dashboard?.orderedLineMonitor ?? [];
    return rows
      .filter((row) => {
        const hasOpenGap = row.qtyRemaining > 0;
        if (!hasOpenGap) return false;
        return row.deadlineStatus === "overdue" || row.deadlineStatus === "soon" || row.financeFlag === "overrun";
      })
      .sort((a, b) => {
        const rank = (v: "overdue" | "soon" | "ok" | "none") => (v === "overdue" ? 0 : v === "soon" ? 1 : 2);
        const byDeadline = rank(a.deadlineStatus) - rank(b.deadlineStatus);
        if (byDeadline !== 0) return byDeadline;
        return b.valueRemainingPlanned - a.valueRemainingPlanned;
      })
      .slice(0, 12);
  }, [data?.dashboard?.orderedLineMonitor]);

  useEffect(() => {
    if (!data) return;
    const alerts: Array<{ key: string; message: string }> = [];
    if (data.enterprise.systemicRiskScore >= riskConfig.systemicWarn) {
      alerts.push({
        key: `proc-systemic-${data.enterprise.systemicRiskScore}-${riskConfig.systemicWarn}`,
        message: `Системний ризик закупівель ${data.enterprise.systemicRiskScore}/100 перевищив поріг ${riskConfig.systemicWarn}.`,
      });
    }
    if (supplierRiskTop && supplierRiskTop.riskScore >= riskConfig.supplierRiskWarn) {
      alerts.push({
        key: `proc-toprisk-${supplierRiskTop.supplierId}-${supplierRiskTop.riskScore}-${riskConfig.supplierRiskWarn}`,
        message: `Топ ризик постачальника ${supplierRiskTop.supplierName}: ${supplierRiskTop.riskScore}/100.`,
      });
    }
    if (supplierRiskTop && supplierRiskTop.slaPct <= riskConfig.slaWarnBelow) {
      alerts.push({
        key: `proc-sla-${supplierRiskTop.supplierId}-${supplierRiskTop.slaPct}-${riskConfig.slaWarnBelow}`,
        message: `SLA постачальника ${supplierRiskTop.supplierName} впав до ${supplierRiskTop.slaPct}%.`,
      });
    }
    if (criticalDueSoonCount >= riskConfig.criticalDueSoonWarn) {
      alerts.push({
        key: `proc-critical-due-${criticalDueSoonCount}-${riskConfig.criticalDueSoonWarn}`,
        message: `Критичних заявок за строками: ${criticalDueSoonCount} (поріг ${riskConfig.criticalDueSoonWarn}).`,
      });
    }
    if (maxPriceVariancePct >= riskConfig.priceVarianceWarnPct) {
      alerts.push({
        key: `proc-price-var-${Math.round(maxPriceVariancePct)}-${riskConfig.priceVarianceWarnPct}`,
        message: `Максимальне відхилення ціни ${maxPriceVariancePct.toFixed(1)}% перевищило поріг ${riskConfig.priceVarianceWarnPct}%.`,
      });
    }
    if (redLineBlockers.length > 0) {
      alerts.push({
        key: `proc-blockers-${redLineBlockers.length}`,
        message: `У червоному списку ${redLineBlockers.length} блокаторів виробництва.`,
      });
    }
    for (const alert of alerts) {
      if (firedAlertsRef.current.has(alert.key)) continue;
      firedAlertsRef.current.add(alert.key);
      addEvent({
        module: "procurement",
        type: "ENTERPRISE_RISK_ALERT",
        message: alert.message,
        actor: "AI-контроль",
        payload: { key: alert.key },
      });
      setOpsFeed((prev) => [`СПОВІЩЕННЯ → ${alert.message}`, ...prev].slice(0, 80));
    }
  }, [addEvent, criticalDueSoonCount, data, maxPriceVariancePct, redLineBlockers.length, riskConfig, supplierRiskTop]);

  async function createPurchaseRequest() {
    if (!requestForm.productionOrder.trim() || !requestForm.materialCode.trim()) return;
    const normalizedDealId = dealId.trim();
    if (normalizedDealId) {
      setDbRequestSaving(true);
      try {
        await postJson<{ ok?: boolean }>("/api/crm/procurement/requests", {
          dealId: normalizedDealId,
          lines: [
            {
              name: requestForm.materialCode.trim(),
              qty: requestForm.qty,
              plannedUnitCost: 0,
            },
          ],
          neededByDate: requestForm.requiredDate || null,
          priority: requestForm.priority,
          comment: requestForm.comment || null,
          sourceContext: requestSourceContext,
        });
        setOpsFeed((prev) => [
          `CRM → заявка збережена для замовлення, матеріал ${requestForm.materialCode}${
            requestSourceContext === "constructor_workspace" ? " (після погодження конструктора)" : ""
          }`,
          ...prev,
        ]);
        void load(q);
      } catch (e) {
        setOpsFeed((prev) => [
          `ПОМИЛКА CRM → ${e instanceof Error ? e.message : "невідомо"}`,
          ...prev,
        ]);
        return;
      } finally {
        setDbRequestSaving(false);
      }
    }
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
      `ERP → ${requestForm.productionOrder} / ${requestForm.materialCode} / ${requestForm.qty} од. / ${requestForm.priority}`,
      ...prev,
    ]);
    setRequestForm(EMPTY_REQUEST);
    setDealId("");
  }

  async function onboardSupplier() {
    if (!supplierForm.name.trim()) return;
    setSupplierSaving(true);
    const name = supplierForm.name.trim();
    const category = supplierForm.category.trim();
    try {
      await postJson<{ ok?: boolean }>("/api/crm/procurement/suppliers", {
        name,
        category,
      });
      addEvent({
        module: "procurement",
        type: "SUPPLIER_ONBOARDING",
        message: `Постачальник ${name} додано в CRM`,
        payload: { category },
      });
      setOpsFeed((prev) => [`CRM → ${name} / ${category} збережено в довіднику`, ...prev]);
      setSupplierForm(EMPTY_SUPPLIER);
      void load(q);
    } catch (e) {
      setOpsFeed((prev) => [
        `ПОМИЛКА → ${e instanceof Error ? e.message : "не вдалося зберегти постачальника"}`,
        ...prev,
      ]);
    } finally {
      setSupplierSaving(false);
    }
  }

  async function applySuggestedPriority(requestId: string, priority: PriorityCode) {
    if (!requestId) return;
    setApplyingPriorityRequestId(requestId);
    try {
      const response = await patchJson<{ request?: { id: string; priority: string } }>(
        `/api/crm/procurement/requests/${requestId}/priority`,
        { priority },
      );
      setOpsFeed((prev) => [
        `MTO-priority → ${requestId.slice(0, 8)}… встановлено ${response.request?.priority ?? priority}`,
        ...prev,
      ]);
      await load(q);
    } catch (error) {
      setOpsFeed((prev) => [
        `ПОМИЛКА MTO-priority → ${error instanceof Error ? error.message : "невідомо"}`,
        ...prev,
      ]);
    } finally {
      setApplyingPriorityRequestId(null);
    }
  }

  async function transitionWorkflowStatus(requestId: string, toStatus: string, reason?: string) {
    if (!requestId || !toStatus) return;
    setTransitioningRequestId(requestId);
    try {
      const response = await patchJson<{
        request?: { id: string; workflowStatus: string; status: string };
        details?: string[];
      }>(`/api/crm/procurement/requests/${requestId}/status`, {
        toStatus,
        reason: reason ?? null,
      });
      setOpsFeed((prev) => [
        `Процес → ${requestId.slice(0, 8)}… → ${response.request?.workflowStatus ?? toStatus}`,
        ...prev,
      ]);
      await load(q);
    } catch (error) {
      setOpsFeed((prev) => [
        `ПОМИЛКА workflow → ${error instanceof Error ? error.message : "невідомо"}`,
        ...prev,
      ]);
    } finally {
      setTransitioningRequestId(null);
    }
  }

  async function uploadSupplierFileAndRunAi() {
    if (!supplierFileRequestId || !supplierFile) return;
    setSupplierFileUploading(true);
    try {
      const form = new FormData();
      form.append("file", supplierFile);
      const r = await fetch(
        `/api/crm/procurement/requests/${encodeURIComponent(supplierFileRequestId)}/supplier-file`,
        {
          method: "POST",
          body: form,
        },
      );
      const j = await tryReadResponseJson<{
        error?: string;
        aiMatch?: { parsedItems: number; matchedItems: number; unmatchedRequestItems: number };
      }>(r);
      if (!r.ok) {
        throw new Error(j?.error ?? "Не вдалося обробити файл постачальника");
      }
      setOpsFeed((prev) => [
        `AI-файл → розбір ${supplierFile.name}: співпало ${j?.aiMatch?.matchedItems ?? 0}/${j?.aiMatch?.parsedItems ?? 0}`,
        ...prev,
      ]);
      setSupplierFile(null);
      setReconcileRequestId(supplierFileRequestId);
      await load(q);
    } catch (error) {
      setOpsFeed((prev) => [
        `ПОМИЛКА AI-файлу → ${error instanceof Error ? error.message : "невідомо"}`,
        ...prev,
      ]);
    } finally {
      setSupplierFileUploading(false);
    }
  }

  async function loadInvoiceReconcile(requestId: string) {
    if (!requestId) return;
    setReconcileLoading(true);
    setReconcileError(null);
    try {
      const response = await fetch(
        `/api/crm/procurement/requests/${encodeURIComponent(requestId)}/invoice-reconcile`,
        { cache: "no-store" },
      );
      const json = await tryReadResponseJson<InvoiceReconcileData & { error?: string }>(response);
      if (!response.ok || !json) {
        throw new Error(json?.error ?? "Не вдалося завантажити звірку");
      }
      setReconcileData(json);
    } catch (error) {
      setReconcileData(null);
      setReconcileError(error instanceof Error ? error.message : "Помилка звірки");
    } finally {
      setReconcileLoading(false);
    }
  }

  async function dispatchGroupedRequestToSupplier() {
    if (!dispatchRequestId) return;
    setDispatching(true);
    try {
      const payload = {
        channel: dispatchChannel,
        target: dispatchTarget.trim() || null,
        message: dispatchMessage.trim() || null,
      };
      const response = await postJson<{
        providerMessageId?: string | null;
        generatedMessage?: string;
        channel?: string;
      }>(
        `/api/crm/procurement/requests/${encodeURIComponent(dispatchRequestId)}/dispatch`,
        payload,
      );
      if (response.generatedMessage) {
        setGeneratedDispatchMessage(response.generatedMessage);
      }
      setOpsFeed((prev) => [
        `Месенджер ${response.channel ?? dispatchChannel} → пакет відправлено (msg id: ${response.providerMessageId ?? "—"})`,
        ...prev,
      ]);
      await load(q);
    } catch (error) {
      setOpsFeed((prev) => [
        `ПОМИЛКА месенджера → ${error instanceof Error ? error.message : "невідомо"}`,
        ...prev,
      ]);
    } finally {
      setDispatching(false);
    }
  }

  function dispatchTargetHint(channel: DispatchChannel): string {
    if (channel === "telegram") return "Telegram chat id (напр. @supplier_chat або -100...)";
    if (channel === "whatsapp") return "Номер WhatsApp (напр. +380...)";
    return "Viber receiver id";
  }

  function getWorkflowQuickActions(status?: string): Array<{ id: string; label: string }> {
    switch (status) {
      case "new_request":
        return [{ id: "in_progress_by_purchaser", label: "Взяти в роботу" }];
      case "in_progress_by_purchaser":
        return [{ id: "ai_grouping", label: "AI-групування позицій" }];
      case "ai_grouping":
        return [{ id: "grouped_by_supplier_or_category", label: "Розгруповано по постачальниках/категоріях" }];
      case "grouped_by_supplier_or_category":
        return [{ id: "sent_to_supplier", label: "Надіслано постачальнику" }];
      case "sent_to_supplier":
        return [{ id: "supplier_response_received", label: "Отримано відповідь постачальника" }];
      case "supplier_response_received":
        return [{ id: "supplier_invoice_uploaded", label: "Завантажено PDF/XLSX рахунку" }];
      case "supplier_invoice_uploaded":
        return [{ id: "invoice_ai_matched", label: "AI розподілив на замовлення" }];
      case "invoice_ai_matched":
        return [{ id: "invoice_verification", label: "Звірка рахунку закупівельником" }];
      case "invoice_verification":
        return [{ id: "approval_pending", label: "На погодження" }];
      case "approval_pending":
        return [{ id: "sent_to_payment", label: "Передати на оплату" }];
      case "sent_to_payment":
        return [{ id: "payment_method_selected", label: "Обрано метод оплати" }];
      case "payment_method_selected":
        return [{ id: "paid", label: "Позначити оплаченим" }];
      case "paid":
        return [{ id: "receipt_verification_pending", label: "Запит на перевірку надходження" }];
      case "receipt_verification_pending":
        return [{ id: "awaiting_delivery", label: "Очікується поставка" }];
      case "awaiting_delivery":
        return [{ id: "goods_received", label: "Товар отримано" }];
      case "goods_received":
        return [{ id: "stock_posted", label: "Оприбутковано на склад" }];
      case "stock_posted":
        return [{ id: "reserved_for_order", label: "Зарезервувати під замовлення" }];
      case "reserved_for_order":
        return [{ id: "issued_to_production", label: "Передано у виробництво" }];
      default:
        return [];
    }
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-5 text-slate-100 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">ENVER · SaaS ERP · Закупівлі</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Командний контур закупівлі</h1>
            <p className="mt-1 text-sm text-slate-300">
              SLA постачань, контроль запасів, зв&apos;язок з виробництвом і фінансами в єдиному стеку.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-medium">
              <Link
                href="/crm/production"
                className="text-cyan-200/95 underline-offset-2 hover:text-white hover:underline"
              >
                Штаб виробництва
              </Link>
              <span className="text-slate-600">·</span>
              <Link
                href="/crm/procurement"
                className="text-cyan-200/95 underline-offset-2 hover:text-white hover:underline"
              >
                Аналітика закупівель
              </Link>
              <span className="text-slate-600">·</span>
              <Link
                href="/crm/production/workshop"
                className="text-cyan-200/95 underline-offset-2 hover:text-white hover:underline"
              >
                Канбан цеху
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-right text-sm">
            <p className="text-slate-400">Операційний статус</p>
            <p className="font-semibold text-emerald-300">АКТИВНО</p>
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
          <MetricCard label="Системний ризик" value={`${data?.enterprise.systemicRiskScore ?? 0}/100`} tone="warn" dark />
          <MetricCard
            label="Топ ризик постачальника"
            value={
              data?.enterprise.supplierRiskRadar[0]
                ? `${data.enterprise.supplierRiskRadar[0].riskScore}/100`
                : "0/100"
            }
            tone="info"
            dark
          />
          <MetricCard label="Постачальників у радарі" value={`${data?.enterprise.supplierRiskRadar.length ?? 0}`} dark />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <MetricCard
            label="Критичні дедлайни (<=3 дні)"
            value={`${criticalDueSoonCount}`}
            tone={criticalDueSoonCount > 0 ? "warn" : "ok"}
            dark
          />
          <MetricCard
            label="Макс відхилення ціни"
            value={`${maxPriceVariancePct.toFixed(1)}%`}
            tone={maxPriceVariancePct >= riskConfig.priceVarianceWarnPct ? "warn" : "ok"}
            dark
          />
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
          <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1">
            ERP замовлення з виробництва: {productionOrders.length}
          </p>
          <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1">
            ERP заявки закупівлі: {purchaseRequests.length}
          </p>
          <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1">Моніторинг SLA: онлайн</p>
        </div>
      </header>

      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{err}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["overview", "Огляд закупівель"],
              ["reconcile", "Звірка AI vs рахунок"],
              ["operations", "Операційний журнал"],
              ["suppliers", "Склад і постачальники"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "overview" ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Пороги сповіщень (зберігаються в браузері)</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <label className="text-xs text-slate-600">
                Системний ризик, від
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
                Ризик постачальника, від
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
                SLA нижче, %
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
              <label className="text-xs text-slate-600">
                Критичних строків, від
                <input
                  type="number"
                  min={1}
                  max={99}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                  value={riskConfig.criticalDueSoonWarn}
                  onChange={(event) =>
                    setRiskConfig((prev) => ({ ...prev, criticalDueSoonWarn: Math.max(1, Number(event.target.value || 1)) }))
                  }
                />
              </label>
              <label className="text-xs text-slate-600">
                Відхилення ціни, %
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                  value={riskConfig.priceVarianceWarnPct}
                  onChange={(event) =>
                    setRiskConfig((prev) => ({
                      ...prev,
                      priceVarianceWarnPct: Math.max(1, Number(event.target.value || 1)),
                    }))
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
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              Авто
              <select
                value={pollMs}
                onChange={(e) => setPollMs(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800"
              >
                <option value={0}>вимкн.</option>
                <option value={45_000}>45 с</option>
                <option value={120_000}>2 хв</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void load(q)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Оновити дані
            </button>
            {lastSyncedAt ? (
              <span className="font-mono text-[10px] text-slate-400" title={lastSyncedAt}>
                {lastSyncedAt.replace("T", " ").slice(0, 19)}
              </span>
            ) : null}
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

          {data?.dashboard?.pendingApprovals != null ? (
            <p className="mt-3 text-xs text-slate-600">
              Чернеток заявок на погодження (CRM):{" "}
              <span className="font-semibold text-slate-900">{data.dashboard.pendingApprovals}</span>
              {data.dashboard.delayedOrders ? (
                <>
                  {" "}
                  · прострочених PO:{" "}
                  <span className="font-semibold text-amber-800">{data.dashboard.delayedOrders}</span>
                </>
              ) : null}
            </p>
          ) : null}

          {data?.materials && data.materials.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-900">Матеріали за пошуком</h3>
              <div className="mt-2 max-h-52 overflow-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">Назва</th>
                      <th className="px-2 py-1.5">Код</th>
                      <th className="px-2 py-1.5">Ціна</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.materials.slice(0, 40).map((m) => (
                      <tr key={m.id} className="border-t border-slate-50">
                        <td className="px-2 py-1.5">{m.name}</td>
                        <td className="px-2 py-1.5 font-mono">{m.code || "—"}</td>
                        <td className="px-2 py-1.5 tabular-nums">{m.price} ₴</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {sortedCrmRequests.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-900">Заявки CRM (за дедлайном і пріоритетом)</h3>
              <ul className="mt-2 max-h-52 space-y-1.5 overflow-auto text-xs text-slate-700">
                {sortedCrmRequests.slice(0, 14).map((r) => {
                  const d = dueHint(r.neededByDate ?? null, nowMsForDueHints);
                  const workflowStatus = r.workflowStatus ?? "new_request";
                  const quickActions = getWorkflowQuickActions(workflowStatus);
                  return (
                    <li
                      key={r.id}
                      className={`rounded-lg border px-2 py-1.5 ${
                        d.overdue
                          ? "border-rose-200 bg-rose-50/90"
                          : d.soon
                            ? "border-amber-200/90 bg-amber-50/50"
                            : "border-slate-100 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-1">
                        <span className="font-mono text-[11px] text-slate-500">{r.id.slice(0, 8)}…</span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            d.overdue ? "bg-rose-100 text-rose-900" : d.soon ? "bg-amber-100 text-amber-950" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {d.label}
                        </span>
                      </div>
                      <p className="mt-0.5 font-medium text-slate-800">{r.dealTitle ?? "Замовлення"}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                        <span>{r.status}</span>
                        <span>· workflow {WORKFLOW_STATUS_LABELS[workflowStatus] ?? workflowStatus}</span>
                        {r.priority ? <span>· пріоритет {r.priority}</span> : null}
                        {r.dealId ? (
                          <Link
                            href={`/deals/${r.dealId}`}
                            className="text-sky-700 underline-offset-2 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            відкрити замовлення
                          </Link>
                        ) : null}
                      </div>
                      {quickActions.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {quickActions.map((action) => {
                            const isBusy = transitioningRequestId === r.id;
                            return (
                              <button
                                key={`${r.id}-${action.id}`}
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  void transitionWorkflowStatus(
                                    r.id,
                                    action.id,
                                    `Quick action from hub: ${action.label}`,
                                  )
                                }
                                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                              >
                                {isBusy ? "Оновлення…" : action.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {prioritizedRequests.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-900">Автопріоритезація MTO (SLA + ціна)</h3>
              <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">Заявка</th>
                      <th className="px-2 py-1.5">Поточний</th>
                      <th className="px-2 py-1.5">Рекоменд.</th>
                      <th className="px-2 py-1.5">Δ ціни</th>
                      <th className="px-2 py-1.5">Причина</th>
                      <th className="px-2 py-1.5">Дія</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prioritizedRequests.slice(0, 14).map((row) => {
                      const currentPriority = (row.priority ?? "").toUpperCase();
                      const canApply = currentPriority !== row.suggestedPriority;
                      const isApplying = applyingPriorityRequestId === row.id;
                      return (
                      <tr key={`prio-${row.id}`} className="border-t border-slate-50">
                        <td className="px-2 py-1.5 font-mono text-[11px] text-slate-600">{row.id.slice(0, 8)}…</td>
                        <td className="px-2 py-1.5">{row.priority ?? "—"}</td>
                        <td className="px-2 py-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              row.suggestedPriority === "CRITICAL"
                                ? "bg-rose-100 text-rose-900"
                                : row.suggestedPriority === "HIGH"
                                  ? "bg-amber-100 text-amber-900"
                                  : row.suggestedPriority === "LOW"
                                    ? "bg-emerald-100 text-emerald-900"
                                    : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {row.suggestedPriority}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{row.priceVariancePct.toFixed(1)}%</td>
                        <td className="px-2 py-1.5 text-slate-600">{row.suggestedReason}</td>
                        <td className="px-2 py-1.5">
                          {canApply ? (
                            <button
                              type="button"
                              disabled={isApplying}
                              onClick={() => void applySuggestedPriority(row.id, row.suggestedPriority)}
                              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                            >
                              {isApplying ? "Застосування…" : "Застосувати"}
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">Актуально</span>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {redLineBlockers.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-3">
              <h3 className="text-sm font-semibold text-rose-900">Червоний список блокаторів виробництва</h3>
              <p className="mt-1 text-[11px] text-rose-800">
                Позиції з відкритим дефіцитом, що ризикують зірвати виготовлення замовних меблів.
              </p>
              <ul className="mt-2 space-y-1.5 text-xs">
                {redLineBlockers.map((row) => (
                  <li key={`block-${row.rowKey}`} className="rounded-lg border border-rose-200/80 bg-white/80 px-2 py-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-medium text-slate-800">{row.itemName}</span>
                      <span className="font-mono text-[11px] text-slate-500">{row.requestId.slice(0, 8)}…</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {row.dealTitle} · залишок {row.qtyRemaining} од. · {row.valueRemainingPlanned.toLocaleString("uk-UA")} ₴
                    </p>
                    <p className="mt-0.5 text-[11px] text-rose-900">
                      {row.deadlineStatus === "overdue"
                        ? "Прострочено"
                        : row.deadlineStatus === "soon"
                          ? "Дедлайн наближається"
                          : "Фінансовий ризик"}{" "}
                      · {row.financeFlag === "overrun" ? "перевищення бюджету" : "контроль"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data?.dashboard?.priceDeviations && data.dashboard.priceDeviations.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-900">Найбільші відхилення ціни (план / факт)</h3>
              <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">Позиція</th>
                      <th className="px-2 py-1.5">Замовлення</th>
                      <th className="px-2 py-1.5">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.dashboard.priceDeviations.slice(0, 8).map((row) => (
                      <tr key={`${row.requestId}-${row.itemName}`} className="border-t border-slate-50">
                        <td className="px-2 py-1.5">{row.itemName}</td>
                        <td className="px-2 py-1.5 text-slate-600">{row.dealTitle}</td>
                        <td className="px-2 py-1.5 tabular-nums text-rose-700">
                          {formatMoney(row.variance)} ₴
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {data?.dashboard ? (
            <div className="mt-4 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/90 via-white to-indigo-50/30 p-4 shadow-sm shadow-slate-900/5 ring-1 ring-slate-100/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Моніторинг позицій</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Дедлайн заявки, залишок бюджету, фактична ціна; пошук і CSV — нижче.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ["all", "Усі"],
                      ["deadline", "Строки"],
                      ["finance", "Фінанси"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setLineMonitorFilter(id)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        lineMonitorFilter === id
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-white/90 text-slate-600 ring-1 ring-slate-200 hover:bg-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-white/60 bg-white/80 p-1 shadow-inner shadow-slate-900/5">
                <ProcurementOrderedMonitorTable
                  rows={filteredOrderedLineMonitor}
                  maxRows={100}
                  compact
                  prefsScope="hub"
                  tableScrollClassName="max-h-[min(480px,58vh)] overflow-y-auto"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Процесні форми (ERP + CRM)</h2>
          <form
            id="new-request"
            ref={requestFormRef}
            className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void createPurchaseRequest();
            }}
          >
            <p className="text-xs font-semibold text-slate-700">Нова заявка від виробництва</p>
            {requestSourceContext === "constructor_workspace" ? (
              <p className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] text-sky-900">
                Створення з воркспейсу конструктора: доступно тільки після погодження начальником виробництва або
                головним конструктором.
              </p>
            ) : null}
            <label className="text-[11px] text-slate-600">Замовлення в CRM (опційно — збере заявку в БД)</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              value={dealId}
              onChange={(event) => setDealId(event.target.value)}
            >
              <option value="">— Без запису в CRM —</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            <label className="text-[11px] text-slate-600">Виробниче замовлення (ERP-міст)</label>
            <datalist id="procurement-prod-orders">
              {productionOrders.map((order) => (
                <option key={order.number} value={order.number} label={`${order.client} · ${order.status}`} />
              ))}
            </datalist>
            <input
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Номер замовлення (підказки з ERP)"
              list="procurement-prod-orders"
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
                <option value="LOW">Низький</option>
                <option value="MEDIUM">Середній</option>
                <option value="HIGH">Високий</option>
                <option value="CRITICAL">Критичний</option>
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
              disabled={dbRequestSaving}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {dbRequestSaving ? "Збереження…" : "Створити заявку"}
            </button>
          </form>

          <form
            id="supplier-onboarding"
            className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void onboardSupplier();
            }}
          >
            <p className="text-xs font-semibold text-slate-700">Новий постачальник (CRM)</p>
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
            <button
              type="submit"
              disabled={supplierSaving}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {supplierSaving ? "Збереження…" : "Додати в реєстр"}
            </button>
          </form>

          <form
            className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void uploadSupplierFileAndRunAi();
            }}
          >
            <p className="text-xs font-semibold text-slate-700">Файл постачальника (PDF/XLSX) → AI-розподіл</p>
            <label className="text-[11px] text-slate-600">Заявка CRM</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              value={supplierFileRequestId}
              onChange={(event) => setSupplierFileRequestId(event.target.value)}
            >
              <option value="">— Оберіть заявку —</option>
              {sortedCrmRequests.map((r) => (
                <option key={`sf-${r.id}`} value={r.id}>
                  {(r.dealTitle ?? "Замовлення").slice(0, 40)} · {r.id.slice(0, 8)}…
                </option>
              ))}
            </select>
            <input
              type="file"
              accept=".xlsx,.xls,.pdf"
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
              onChange={(event) => setSupplierFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="submit"
              disabled={!supplierFileRequestId || !supplierFile || supplierFileUploading}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {supplierFileUploading ? "Обробка…" : "Завантажити та розподілити AI"}
            </button>
          </form>

          <form
            className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void dispatchGroupedRequestToSupplier();
            }}
          >
            <p className="text-xs font-semibold text-slate-700">
              Відправка розгрупованого пакета в Telegram / WhatsApp / Viber
            </p>
            <label className="text-[11px] text-slate-600">Заявка CRM</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              value={dispatchRequestId}
              onChange={(event) => setDispatchRequestId(event.target.value)}
            >
              <option value="">— Оберіть заявку —</option>
              {sortedCrmRequests.map((r) => (
                <option key={`dispatch-${r.id}`} value={r.id}>
                  {(r.dealTitle ?? "Замовлення").slice(0, 40)} · {r.id.slice(0, 8)}…
                </option>
              ))}
            </select>
            <label className="text-[11px] text-slate-600">Канал</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              value={dispatchChannel}
              onChange={(event) => setDispatchChannel(event.target.value as DispatchChannel)}
            >
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="viber">Viber</option>
            </select>
            <input
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              placeholder={dispatchTargetHint(dispatchChannel)}
              value={dispatchTarget}
              onChange={(event) => setDispatchTarget(event.target.value)}
            />
            <textarea
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              rows={3}
              placeholder="Кастомний текст (залиште порожнім для автогенерації з розбивкою по постачальнику/категорії)"
              value={dispatchMessage}
              onChange={(event) => setDispatchMessage(event.target.value)}
            />
            <button
              type="submit"
              disabled={!dispatchRequestId || dispatching}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {dispatching ? "Відправка…" : "Відправити постачальнику"}
            </button>
            {generatedDispatchMessage ? (
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <p className="text-[11px] font-medium text-slate-700">Згенерований текст повідомлення:</p>
                <pre className="mt-1 whitespace-pre-wrap text-[11px] text-slate-600">{generatedDispatchMessage}</pre>
              </div>
            ) : null}
          </form>
        </div>
          </section>
        </>
      ) : null}

      {activeTab === "reconcile" ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Екран звірки AI vs рахунок постачальника</h2>
            <p className="mt-1 text-xs text-slate-600">
              Перед підтвердженням рахунку та передачею в оплату перевірте збіг позицій, кількості та ціни.
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <select
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                value={reconcileRequestId}
                onChange={(event) => setReconcileRequestId(event.target.value)}
              >
                <option value="">— Оберіть заявку —</option>
                {sortedCrmRequests.map((r) => (
                  <option key={`reconcile-${r.id}`} value={r.id}>
                    {(r.dealTitle ?? "Замовлення").slice(0, 44)} · {r.id.slice(0, 8)}…
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!reconcileRequestId || reconcileLoading}
                onClick={() => void loadInvoiceReconcile(reconcileRequestId)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {reconcileLoading ? "Завантаження…" : "Оновити звірку"}
              </button>
            </div>
            {reconcileError ? (
              <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-800">
                {reconcileError}
              </p>
            ) : null}
          </div>

          {reconcileData ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-2 text-xs text-slate-700 md:grid-cols-3">
                <p>Заявка: {reconcileData.request.number ?? reconcileData.request.id.slice(0, 8)}</p>
                <p>Процес: {WORKFLOW_STATUS_LABELS[reconcileData.request.workflowStatus] ?? reconcileData.request.workflowStatus}</p>
                <p>Постачальник: {reconcileData.request.supplierName ?? "—"}</p>
                <p>Співпало: {reconcileData.summary.matchedItems}/{reconcileData.summary.totalRequestItems}</p>
                <p>Попереджень: {reconcileData.summary.warnings}</p>
                <p>Відсутніх: {reconcileData.summary.missing}</p>
              </div>
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">Позиція</th>
                      <th className="px-2 py-1.5">План (qty × ціна)</th>
                      <th className="px-2 py-1.5">Рахунок постачальника</th>
                      <th className="px-2 py-1.5">Δ qty</th>
                      <th className="px-2 py-1.5">Δ ціни</th>
                      <th className="px-2 py-1.5">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconcileData.lines.map((line) => (
                      <tr key={`rec-line-${line.itemId}`} className="border-t border-slate-50">
                        <td className="px-2 py-1.5">
                          <p className="font-medium text-slate-800">{line.itemName}</p>
                          <p className="text-[10px] text-slate-500">{line.supplierLineName ?? "не знайдено у файлі"}</p>
                        </td>
                        <td className="px-2 py-1.5">
                          {line.plannedQty} × {line.plannedUnitPrice.toFixed(2)} грн
                        </td>
                        <td className="px-2 py-1.5">
                          {line.supplierQty} × {line.supplierUnitPrice.toFixed(2)} грн
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{line.qtyDelta.toFixed(2)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{line.priceDelta.toFixed(2)} грн</td>
                        <td className="px-2 py-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              line.status === "ok"
                                ? "bg-emerald-100 text-emerald-900"
                                : line.status === "warning"
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-rose-100 text-rose-900"
                            }`}
                          >
                            {line.status === "ok" ? "OK" : line.status === "warning" ? "Увага" : "Немає збігу"} · {line.confidencePct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {reconcileData.request.workflowStatus === "invoice_ai_matched" ? (
                  <button
                    type="button"
                    disabled={transitioningRequestId === reconcileData.request.id}
                    onClick={() =>
                      void transitionWorkflowStatus(
                        reconcileData.request.id,
                        "invoice_verification",
                        "Підтверджено перевірку рахунку на екрані звірки",
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    Позначити: звірку завершено
                  </button>
                ) : null}
                {reconcileData.canConfirmForApproval ? (
                  <button
                    type="button"
                    disabled={transitioningRequestId === reconcileData.request.id}
                    onClick={() =>
                      void transitionWorkflowStatus(
                        reconcileData.request.id,
                        "approval_pending",
                        "Рахунок підтверджено закупівельником після звірки AI vs постачальник",
                      )
                    }
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Підтвердити рахунок і передати на погодження
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "suppliers" ? (
        <>
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
                      <th className="py-2">Покриття</th>
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
                    рейтинг {supplier.rating ?? "—"}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{supplier.category}</p>
              </li>
            ))}
          </ul>
        </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Радар ризиків постачальників</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs text-slate-500">
                    <th className="py-2 pr-2">Постачальник</th>
                    <th className="py-2 pr-2">SLA</th>
                    <th className="py-2 pr-2">Оплати вчасно</th>
                    <th className="py-2 pr-2">Затримані PO</th>
                    <th className="py-2 pr-2">Витрати</th>
                    <th className="py-2">Ризик</th>
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
        </>
      ) : null}

      {activeTab === "operations" ? (
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
            <h2 className="text-sm font-semibold text-slate-900">Черга погодження (ERP-міст)</h2>
            <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto text-xs">
              {(showAllBridge ? purchaseRequests : purchaseRequests.slice(0, 8)).map((request) => (
                <li key={request.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <p className="font-medium text-slate-800">
                    {request.productionOrder} · {request.materialCode} · {request.status}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {request.status === "NEW" ? (
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                        onClick={() => approvePurchaseRequest(request.id, "Керівник закупівель")}
                      >
                        Погодити
                      </button>
                    ) : null}
                    {request.status !== "DONE" ? (
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                        onClick={() => setPurchaseRequestStatus(request.id, "DONE", "Керівник закупівель")}
                      >
                        Готово
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
              {purchaseRequests.length === 0 ? <li className="text-slate-500">Черга порожня.</li> : null}
            </ul>
            {purchaseRequests.length > 8 ? (
              <button
                type="button"
                className="mt-2 text-[11px] font-medium text-sky-800 underline-offset-2 hover:underline"
                onClick={() => setShowAllBridge((v) => !v)}
              >
                {showAllBridge ? "Згорнути" : `Показати всі (${purchaseRequests.length})`}
              </button>
            ) : null}
          </div>
          <div className="grid gap-2">
          <QuickLink href="/crm/production" title="Виробничий командний пункт" subtitle="замовлення, конструктори, погодження" />
          <QuickLink href="/warehouse" title="Склад WMS" subtitle="залишки, резерви, рух із PO" />
          <QuickLink href="/crm/erp" title="Глобальний ERP-командний центр" subtitle="ланцюжок погоджень і наскрізна стрічка подій" />
          </div>
        </div>
        </section>
      ) : null}
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
