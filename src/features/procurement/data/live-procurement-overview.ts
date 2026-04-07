import { prisma } from "@/lib/prisma";
import type {
  ProcurementCategory,
  ProcurementItem,
  ProcurementRequest,
  ProcurementRequestStatus,
  PurchaseOrder,
  Supplier,
} from "../types/models";
import { sumPurchaseOrderCommitment, sumReceivedValueFromPoItems } from "../../finance/lib/aggregation";
import { isNeededByPast } from "../lib/deadlines";
import { mockProcurementCategories } from "../../shared/data/mock-crm";
import { buildProcurementRiskAlerts } from "../lib/build-procurement-risk-alerts";
import { buildOrderedLineMonitorFromPrismaRequests } from "../lib/ordered-line-monitor";
import type { ProcurementOverviewBundle } from "../types/overview-bundle";

const sum = (arr: number[]): number => arr.reduce((a, b) => a + b, 0);

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const p = Number(v);
  return Number.isFinite(p) ? p : 0;
}

function mapDealPoStatus(s: string): PurchaseOrder["status"] {
  const m: Record<string, PurchaseOrder["status"]> = {
    DRAFT: "DRAFT",
    ORDERED: "SENT",
    DELIVERED: "DELIVERED",
    PAID: "PAID",
    CANCELLED: "CANCELLED",
    SENT: "SENT",
    CONFIRMED: "CONFIRMED",
    PARTIALLY_DELIVERED: "PARTIALLY_DELIVERED",
  };
  return m[s] ?? "SENT";
}

function mapRequestStatus(s: string): ProcurementRequestStatus {
  const allowed: ProcurementRequestStatus[] = [
    "DRAFT",
    "PENDING_APPROVAL",
    "APPROVED",
    "ORDERED",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
    "CLOSED",
    "CANCELLED",
  ];
  return (allowed.includes(s as ProcurementRequestStatus) ? s : "DRAFT") as ProcurementRequestStatus;
}

function mapItemStatus(s: string | null | undefined): ProcurementItem["status"] {
  const m: Record<string, ProcurementItem["status"]> = {
    DRAFT: "DRAFT",
    APPROVED: "APPROVED",
    ORDERED: "ORDERED",
    PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED",
    RECEIVED: "RECEIVED",
    CANCELLED: "CANCELLED",
  };
  return s && m[s] ? m[s] : "DRAFT";
}

function prismaSupplierToUi(row: { id: string; name: string; category: string }): Supplier {
  return {
    id: row.id,
    name: row.name,
    type: row.category.toLowerCase().includes("лог") ? "LOGISTICS" : "MATERIAL",
    contactPerson: "—",
    phone: "—",
    email: "—",
    paymentTerms: "—",
    notes: "",
    isActive: true,
  };
}

export async function tryLoadLiveProcurementOverview(): Promise<ProcurementOverviewBundle | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;

  try {
    const [dbRequests, dbPos, dbSuppliers] = await Promise.all([
      prisma.procurementRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          deal: { select: { id: true, title: true } },
          items: true,
        },
      }),
      prisma.dealPurchaseOrder.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          supplier: { select: { id: true, name: true } },
          deal: { select: { id: true, title: true } },
        },
      }),
      prisma.supplier.findMany({ orderBy: { name: "asc" }, take: 500 }),
    ]);

    const categories: ProcurementCategory[] = mockProcurementCategories;

    const requests: ProcurementRequest[] = dbRequests.map((r) => {
      const budgetTotal = r.items.reduce(
        (acc, i) => acc + n(i.qtyPlanned) * n(i.costPlanned),
        0,
      );
      const actualTotal = r.items.reduce(
        (acc, i) => acc + n(i.qtyReceived) * (n(i.costActual) || n(i.costPlanned)),
        0,
      );
      return {
        id: r.id,
        projectId: r.dealId,
        objectId: null,
        requestedById: null,
        status: mapRequestStatus(r.status),
        neededByDate: r.neededByDate?.toISOString().slice(0, 10) ?? null,
        budgetTotal,
        actualTotal,
        comment: "",
      };
    });

    const items: ProcurementItem[] = dbRequests.flatMap((r) =>
      r.items.map((it, idx) => {
        const qty = n(it.qtyPlanned);
        const unit = n(it.costPlanned);
        const recQty = n(it.qtyReceived);
        const actUnit = n(it.costActual) || unit;
        return {
          id: it.id,
          requestId: r.id,
          projectId: r.dealId,
          objectId: null,
          categoryId: categories[idx % categories.length]!.id,
          itemType: "MATERIAL",
          name: it.name ?? `Позиція ${idx + 1}`,
          article: null,
          unit: "шт",
          qty,
          plannedUnitCost: unit,
          plannedTotalCost: Math.round(qty * unit),
          actualUnitCost: actUnit,
          actualTotalCost: Math.round(recQty * actUnit),
          supplierId: null,
          status: mapItemStatus(it.status),
          isCustom: false,
          comment: "",
        };
      }),
    );

    const purchaseOrders: PurchaseOrder[] = dbPos.map((o) => ({
      id: o.id,
      supplierId: o.supplierId,
      projectId: o.dealId,
      requestId: null,
      orderNumber: o.orderNumber,
      status: mapDealPoStatus(o.status),
      orderDate: o.createdAt.toISOString().slice(0, 10),
      expectedDate: o.expectedDate?.toISOString().slice(0, 10) ?? null,
      totalAmount: n(o.total),
      comment: "",
    }));

    const suppliers: Supplier[] = dbSuppliers.map(prismaSupplierToUi);

    const planned = sum(items.map((i) => i.plannedTotalCost));
    const actual = sum(items.map((i) => i.actualTotalCost ?? 0));
    const ordered = sum(
      purchaseOrders
        .filter((o) => ["SENT", "CONFIRMED", "PAID", "PARTIALLY_DELIVERED", "DELIVERED"].includes(o.status))
        .map((o) => o.totalAmount),
    );
    const committed = sumPurchaseOrderCommitment(purchaseOrders);
    const purchaseOrderItems: import("../types/models").PurchaseOrderItem[] = [];
    const receivedValue = sumReceivedValueFromPoItems(purchaseOrderItems, purchaseOrders.map((o) => o.id));
    const receivedFromProcurement = sum(
      items.map((i) => n(i.actualTotalCost)),
    );
    const receivedValueEff = Math.max(receivedValue, receivedFromProcurement);

    const paidSupplier = sum(purchaseOrders.filter((o) => o.status === "PAID").map((o) => o.totalAmount));
    const awaitingDelivery = sum(
      purchaseOrders
        .filter((o) => ["SENT", "CONFIRMED", "PAID", "PARTIALLY_DELIVERED"].includes(o.status))
        .map((o) => o.totalAmount),
    );
    const overrun = Math.max(actual - planned, 0);
    const openCommitmentGap = Math.max(committed - receivedValueEff, 0);

    const referenceDay = new Date();
    const overdueOpenRequests = requests.filter((r) => {
      if (!isNeededByPast(r.neededByDate ?? null, referenceDay)) return false;
      return r.status !== "RECEIVED" && r.status !== "CLOSED" && r.status !== "CANCELLED";
    });

    const supplierSpend = purchaseOrders.reduce<Record<string, number>>((acc, po) => {
      if (po.status === "CANCELLED") return acc;
      acc[po.supplierId] = (acc[po.supplierId] ?? 0) + po.totalAmount;
      return acc;
    }, {});
    const supplierOpenPos = purchaseOrders.reduce<Record<string, number>>((acc, po) => {
      if (po.status === "CANCELLED" || po.status === "DELIVERED") return acc;
      acc[po.supplierId] = (acc[po.supplierId] ?? 0) + 1;
      return acc;
    }, {});
    const totalSupplierSpend = Object.values(supplierSpend).reduce((a, b) => a + b, 0);
    const supplierScorecard = Object.entries(supplierSpend)
      .map(([supplierId, spend]) => {
        const supplier = suppliers.find((s) => s.id === supplierId);
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

    const activeOrders = purchaseOrders.filter((o) => o.status !== "CANCELLED");
    const onTimeDeliveredOrders = activeOrders.length
      ? activeOrders.filter((o) => {
          if (!o.expectedDate) return true;
          return new Date() <= new Date(o.expectedDate);
        }).length
      : 0;

    const receiptQualityRate = 100;
    const supplierRisks = supplierScorecard.map((row) => {
      const supplierOrders = purchaseOrders.filter(
        (po) => po.supplierId === row.supplierId && po.status !== "CANCELLED",
      );
      const lateOrders = supplierOrders.filter((po) => {
        if (!po.expectedDate) return false;
        return new Date() > new Date(po.expectedDate) && po.status !== "DELIVERED";
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
        (100 -
          (activeOrders.length
            ? Number(((onTimeDeliveredOrders / activeOrders.length) * 100).toFixed(1))
            : 100)) *
          0.4 +
        overdueOpenRequests.length * 4) /
        1.15,
    );

    const saasControl = {
      openRequestCount: requests.filter(
        (r) => r.status !== "RECEIVED" && r.status !== "CLOSED" && r.status !== "CANCELLED",
      ).length,
      overdueOpenRequestCount: overdueOpenRequests.length,
      onTimeDeliveryRatePct: activeOrders.length
        ? Number(((onTimeDeliveredOrders / activeOrders.length) * 100).toFixed(1))
        : 100,
      commitmentCoveragePct: committed > 0 ? Number(((receivedValueEff / committed) * 100).toFixed(1)) : 100,
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

    const projectNameById: Record<string, string> = {};
    for (const r of dbRequests) {
      projectNameById[r.dealId] = r.deal.title;
    }
    for (const o of dbPos) {
      projectNameById[o.dealId] = o.deal.title;
    }
    const supplierNameById = Object.fromEntries(suppliers.map((s) => [s.id, s.name]));
    const orderNumberById = Object.fromEntries(purchaseOrders.map((o) => [o.id, o.orderNumber]));

    const kpi = {
      planned,
      actual,
      ordered,
      committed,
      receivedValue: receivedValueEff,
      paidSupplier,
      awaitingDelivery,
      overrun,
      openCommitmentGap,
    };

    const orderedLineMonitor = buildOrderedLineMonitorFromPrismaRequests(dbRequests);

    return {
      kpi,
      requests,
      items,
      purchaseOrders,
      purchaseOrderItems,
      suppliers,
      receipts: [],
      receiptItems: [],
      categories,
      saasControl,
      projectNameById,
      supplierNameById,
      orderNumberById,
      dataSource: "live",
      riskAlerts: buildProcurementRiskAlerts(saasControl, kpi),
      orderedLineMonitor,
    };
  } catch (e) {
    console.warn("[tryLoadLiveProcurementOverview]", e);
    return null;
  }
}
