import type { ProcurementProjectPageData } from "./live-procurement-project";
import {
  mockGoodsReceiptItems,
  mockGoodsReceipts,
  mockProcurementCategories,
  mockProcurementItems,
  mockProcurementRequests,
  mockProjects,
  mockPurchaseOrderItems,
  mockPurchaseOrders,
  mockSuppliers,
} from "../../shared/data/mock-crm";
import { sumPurchaseOrderCommitment, sumReceivedValueFromPoItems } from "../../finance/lib/aggregation";
import { isNeededByPast, isOpenProcurementLine } from "../lib/deadlines";
import { buildProcurementRiskAlerts } from "../lib/build-procurement-risk-alerts";
import { buildOrderedLineMonitorFromMock } from "../lib/ordered-line-monitor";
import type { ProcurementOverviewBundle } from "../types/overview-bundle";

export type { ProcurementOverviewBundle } from "../types/overview-bundle";
export type { ProcurementProjectPageData } from "./live-procurement-project";

const sum = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);

/** Демо-дані (mock-crm) — якщо з БД не вдалося зібрати live-огляд. */
export async function getProcurementOverviewMockData(): Promise<ProcurementOverviewBundle> {
  const planned = sum(mockProcurementItems.map((i) => i.plannedTotalCost));
  const actual = sum(mockProcurementItems.map((i) => i.actualTotalCost ?? 0));
  const ordered = sum(
    mockPurchaseOrders
      .filter((o) => ["SENT", "CONFIRMED", "PAID", "PARTIALLY_DELIVERED", "DELIVERED"].includes(o.status))
      .map((o) => o.totalAmount),
  );
  const committed = sumPurchaseOrderCommitment(mockPurchaseOrders);
  const receivedValue = sumReceivedValueFromPoItems(
    mockPurchaseOrderItems,
    mockPurchaseOrders.map((o) => o.id),
  );
  const paidSupplier = sum(
    mockPurchaseOrders.filter((o) => o.status === "PAID").map((o) => o.totalAmount),
  );
  const awaitingDelivery = sum(
    mockPurchaseOrders
      .filter((o) => ["SENT", "CONFIRMED", "PAID", "PARTIALLY_DELIVERED"].includes(o.status))
      .map((o) => o.totalAmount),
  );
  const overrun = Math.max(actual - planned, 0);
  const openCommitmentGap = Math.max(committed - receivedValue, 0);
  const referenceDay = new Date("2026-03-31");
  const receiptsByPo = mockGoodsReceipts.reduce<Record<string, string[]>>((acc, receipt) => {
    const list = acc[receipt.purchaseOrderId] ?? [];
    list.push(receipt.receiptDate);
    acc[receipt.purchaseOrderId] = list;
    return acc;
  }, {});
  const activeOrders = mockPurchaseOrders.filter((o) => o.status !== "CANCELLED");
  const onTimeDeliveredOrders = activeOrders.filter((o) => {
    if (!o.expectedDate) return true;
    const receiptDates = receiptsByPo[o.id] ?? [];
    if (receiptDates.length === 0) return false;
    const firstReceipt = receiptDates.sort()[0];
    return firstReceipt <= o.expectedDate;
  }).length;
  const overdueOpenRequests = mockProcurementRequests.filter((r) => {
    if (!isNeededByPast(r.neededByDate ?? null, referenceDay)) return false;
    return r.status !== "RECEIVED" && r.status !== "CLOSED" && r.status !== "CANCELLED";
  });
  const supplierSpend = mockPurchaseOrders.reduce<Record<string, number>>((acc, po) => {
    if (po.status === "CANCELLED") return acc;
    acc[po.supplierId] = (acc[po.supplierId] ?? 0) + po.totalAmount;
    return acc;
  }, {});
  const supplierOpenPos = mockPurchaseOrders.reduce<Record<string, number>>((acc, po) => {
    if (po.status === "CANCELLED" || po.status === "DELIVERED") return acc;
    acc[po.supplierId] = (acc[po.supplierId] ?? 0) + 1;
    return acc;
  }, {});
  const totalSupplierSpend = Object.values(supplierSpend).reduce((a, b) => a + b, 0);
  const supplierScorecard = Object.entries(supplierSpend)
    .map(([supplierId, spend]) => {
      const supplier = mockSuppliers.find((s) => s.id === supplierId);
      const openPoCount = supplierOpenPos[supplierId] ?? 0;
      return {
        supplierId,
        supplierName: supplier?.name ?? "—",
        spend,
        sharePct: totalSupplierSpend > 0 ? Number(((spend / totalSupplierSpend) * 100).toFixed(1)) : 0,
        openPoCount,
      };
    })
    .sort((a, b) => b.spend - a.spend);
  const topSupplierConcentrationPct = supplierScorecard[0]?.sharePct ?? 0;
  const receiptQualityRate = mockGoodsReceiptItems.length
    ? Number(
        (
          (mockGoodsReceiptItems.reduce((acc, item) => acc + item.acceptedQty, 0) /
            Math.max(1, mockGoodsReceiptItems.reduce((acc, item) => acc + item.receivedQty, 0))) *
          100
        ).toFixed(1),
      )
    : 100;
  const supplierRisks = supplierScorecard.map((row) => {
    const supplierOrders = mockPurchaseOrders.filter(
      (po) => po.supplierId === row.supplierId && po.status !== "CANCELLED",
    );
    const lateOrders = supplierOrders.filter((po) => {
      if (!po.expectedDate) return false;
      const firstReceipt = (receiptsByPo[po.id] ?? []).sort()[0];
      return !firstReceipt || firstReceipt > po.expectedDate;
    }).length;
    const paidOrders = supplierOrders.filter((po) => po.status === "PAID").length;
    const paymentDisciplinePct = supplierOrders.length
      ? Number(((paidOrders / supplierOrders.length) * 100).toFixed(1))
      : 100;
    const slaPct = supplierOrders.length
      ? Number((((supplierOrders.length - lateOrders) / supplierOrders.length) * 100).toFixed(1))
      : 100;
    const riskScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (row.sharePct > 40 ? 35 : row.sharePct > 25 ? 20 : 10) +
            (slaPct < 60 ? 35 : slaPct < 80 ? 20 : 8) +
            (paymentDisciplinePct < 40 ? 20 : paymentDisciplinePct < 70 ? 12 : 6),
        ),
      ),
    );
    return {
      supplierId: row.supplierId,
      supplierName: row.supplierName,
      slaPct,
      paymentDisciplinePct,
      lateOrders,
      riskScore,
      riskLabel: riskScore >= 70 ? "Критичний" : riskScore >= 45 ? "Підвищений" : "Контрольований",
    };
  });
  const systemicRiskScore = Math.round(
    (topSupplierConcentrationPct * 0.35 +
      (100 - (activeOrders.length
        ? Number(((onTimeDeliveredOrders / activeOrders.length) * 100).toFixed(1))
        : 100)) *
        0.4 +
      overdueOpenRequests.length * 4) /
      1.15,
  );

  const kpi = {
    planned,
    actual,
    ordered,
    committed,
    receivedValue,
    paidSupplier,
    awaitingDelivery,
    overrun,
    openCommitmentGap,
  };

  const saasControl = {
    openRequestCount: mockProcurementRequests.filter(
      (r) => r.status !== "RECEIVED" && r.status !== "CLOSED" && r.status !== "CANCELLED",
    ).length,
    overdueOpenRequestCount: overdueOpenRequests.length,
    onTimeDeliveryRatePct: activeOrders.length
      ? Number(((onTimeDeliveredOrders / activeOrders.length) * 100).toFixed(1))
      : 100,
    commitmentCoveragePct: committed > 0 ? Number(((receivedValue / committed) * 100).toFixed(1)) : 100,
    topSupplierConcentrationPct,
    receiptQualityRate,
    supplierScorecard,
    overdueRequests: overdueOpenRequests
      .map((r) => ({
        requestId: r.id,
        projectId: r.projectId,
        neededByDate: r.neededByDate,
        status: r.status,
        budgetTotal: r.budgetTotal,
      }))
      .sort((a, b) => (a.neededByDate ?? "").localeCompare(b.neededByDate ?? "")),
    supplierRisks: supplierRisks.sort((a, b) => b.riskScore - a.riskScore),
    systemicRiskScore: Math.max(0, Math.min(100, systemicRiskScore)),
  };

  const projectNameById = Object.fromEntries(mockProjects.map((p) => [p.id, `${p.code} · ${p.title}`]));
  const supplierNameById = Object.fromEntries(mockSuppliers.map((s) => [s.id, s.name]));
  const orderNumberById = Object.fromEntries(mockPurchaseOrders.map((p) => [p.id, p.orderNumber]));

  const orderedLineMonitor = buildOrderedLineMonitorFromMock(
    mockProcurementRequests,
    mockProcurementItems,
    projectNameById,
  );

  return {
    kpi,
    requests: mockProcurementRequests,
    items: mockProcurementItems,
    purchaseOrders: mockPurchaseOrders,
    purchaseOrderItems: mockPurchaseOrderItems,
    suppliers: mockSuppliers,
    receipts: mockGoodsReceipts,
    receiptItems: mockGoodsReceiptItems,
    categories: mockProcurementCategories,
    saasControl,
    projectNameById,
    supplierNameById,
    orderNumberById,
    dataSource: "demo",
    riskAlerts: buildProcurementRiskAlerts(saasControl, kpi),
    orderedLineMonitor,
  };
}

export async function getProcurementOverviewData(): Promise<ProcurementOverviewBundle> {
  const { tryLoadLiveProcurementOverview } = await import("./live-procurement-overview");
  const live = await tryLoadLiveProcurementOverview();
  if (live) return live;
  return getProcurementOverviewMockData();
}

export async function getProcurementProjectData(projectId: string): Promise<ProcurementProjectPageData | null> {
  const { tryLoadProcurementProjectFromDeal } = await import("./live-procurement-project");
  const live = await tryLoadProcurementProjectFromDeal(projectId);
  if (live) return live;

  const project = mockProjects.find((p) => p.id === projectId) ?? null;
  if (!project) return null;
  const requests = mockProcurementRequests.filter((r) => r.projectId === projectId);
  const items = mockProcurementItems.filter((i) => i.projectId === projectId);
  const orders = mockPurchaseOrders.filter((o) => o.projectId === projectId);
  const receipts = mockGoodsReceipts.filter((r) => r.projectId === projectId);
  const planned = sum(items.map((i) => i.plannedTotalCost));
  const actual = sum(items.map((i) => i.actualTotalCost ?? 0));
  const ordered = sum(orders.map((o) => o.totalAmount));
  const committed = sumPurchaseOrderCommitment(orders);
  const received = sumReceivedValueFromPoItems(
    mockPurchaseOrderItems,
    orders.map((o) => o.id),
  );
  const delta = actual - planned;
  const notClosed = items.filter((i) => isOpenProcurementLine(i.status)).length;
  const requestById = Object.fromEntries(requests.map((r) => [r.id, r]));
  const today = new Date();
  const overdueLines = items.filter((i) => {
    if (!isOpenProcurementLine(i.status)) return false;
    const req = requestById[i.requestId];
    return isNeededByPast(req?.neededByDate ?? null, today);
  }).length;

  const projectNameById = Object.fromEntries(mockProjects.map((p) => [p.id, `${p.code} · ${p.title}`]));
  const supplierNameById = Object.fromEntries(mockSuppliers.map((s) => [s.id, s.name]));
  const categoryNameById = Object.fromEntries(mockProcurementCategories.map((c) => [c.id, c.name]));
  const orderNumberById = Object.fromEntries(mockPurchaseOrders.map((p) => [p.id, p.orderNumber]));

  return {
    project,
    summary: { planned, actual, delta, ordered, committed, received, notClosed, overdueLines },
    requests,
    items,
    orders,
    receipts,
    projectNameById,
    supplierNameById,
    categoryNameById,
    orderNumberById,
    dataSource: "demo",
  };
}
