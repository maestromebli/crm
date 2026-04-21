import { prisma } from "@/lib/prisma";
import type { Project } from "../../shared/types/entities";
import type {
  GoodsReceipt,
  ProcurementCategory,
  ProcurementItem,
  ProcurementRequest,
  ProcurementRequestStatus,
  PurchaseOrder,
} from "../types/models";
import { sumPurchaseOrderCommitment, sumReceivedValueFromPoItems } from "../../finance/lib/aggregation";
import { isNeededByPast, isOpenProcurementLine } from "../lib/deadlines";
import { mockProcurementCategories } from "../../shared/data/mock-crm";

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

function dealToProjectView(deal: {
  id: string;
  title: string;
  clientId: string;
  ownerId: string;
  value: unknown;
  expectedCloseDate: Date | null;
}): Project {
  return {
    id: deal.id,
    code: `UG-${deal.id.slice(0, 8)}`,
    title: deal.title,
    clientId: deal.clientId,
    managerId: deal.ownerId,
    status: "IN_WORK",
    contractAmount: n(deal.value),
    currency: "UAH",
    plannedMargin: null,
    actualMargin: null,
    startDate: null,
    dueDate: deal.expectedCloseDate?.toISOString().slice(0, 10) ?? null,
    notes: "",
  };
}

/** Зріз сторінки «закупівлі по проєкту» — live (deal) або demo (mock Project). */
export type ProcurementProjectPageData = {
  project: Project;
  summary: {
    planned: number;
    actual: number;
    delta: number;
    ordered: number;
    committed: number;
    received: number;
    notClosed: number;
    overdueLines: number;
  };
  requests: ProcurementRequest[];
  items: ProcurementItem[];
  orders: PurchaseOrder[];
  receipts: GoodsReceipt[];
  projectNameById: Record<string, string>;
  supplierNameById: Record<string, string>;
  categoryNameById: Record<string, string>;
  orderNumberById: Record<string, string>;
  dataSource: "live" | "demo";
};

/**
 * Завантажує зріз закупівель для замовлення (dealId = projectId у таблицях UI).
 */
export async function tryLoadProcurementProjectFromDeal(
  dealId: string,
): Promise<ProcurementProjectPageData | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        title: true,
        clientId: true,
        ownerId: true,
        value: true,
        expectedCloseDate: true,
      },
    });
    if (!deal) return null;

    const [dbRequests, dbPos] = await Promise.all([
      prisma.procurementRequest.findMany({
        where: { dealId },
        orderBy: { createdAt: "desc" },
        include: { items: true },
      }),
      prisma.dealPurchaseOrder.findMany({
        where: { dealId },
        orderBy: { createdAt: "desc" },
        include: { supplier: { select: { id: true, name: true } } },
      }),
    ]);

    const categories: ProcurementCategory[] = mockProcurementCategories;
    const categoryNameById = Object.fromEntries(categories.map((c) => [c.id, c.name]));

    const requests: ProcurementRequest[] = dbRequests.map((r) => {
      const budgetTotal = r.items.reduce((acc, i) => acc + n(i.qtyPlanned) * n(i.costPlanned), 0);
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

    const orders: PurchaseOrder[] = dbPos.map((o) => ({
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

    const receipts: GoodsReceipt[] = [];

    const planned = sum(items.map((i) => i.plannedTotalCost));
    const actual = sum(items.map((i) => i.actualTotalCost ?? 0));
    const ordered = sum(orders.map((o) => o.totalAmount));
    const committed = sumPurchaseOrderCommitment(orders);
    const receivedFromPoItems = sumReceivedValueFromPoItems([], orders.map((o) => o.id));
    const receivedFromItems = sum(items.map((i) => i.actualTotalCost ?? 0));
    const received = Math.max(receivedFromPoItems, receivedFromItems);
    const delta = actual - planned;
    const notClosed = items.filter((i) => isOpenProcurementLine(i.status)).length;
    const requestById = Object.fromEntries(requests.map((r) => [r.id, r]));
    const today = new Date();
    const overdueLines = items.filter((i) => {
      if (!isOpenProcurementLine(i.status)) return false;
      const req = requestById[i.requestId];
      return isNeededByPast(req?.neededByDate ?? null, today);
    }).length;

    const supplierIds = new Set<string>();
    for (const o of orders) supplierIds.add(o.supplierId);
    for (const i of items) {
      if (i.supplierId) supplierIds.add(i.supplierId);
    }
    const supplierRows =
      supplierIds.size > 0
        ? await prisma.supplier.findMany({
            where: { id: { in: [...supplierIds] } },
            select: { id: true, name: true },
          })
        : [];
    const supplierNameById = Object.fromEntries(supplierRows.map((s) => [s.id, s.name]));

    const projectNameById: Record<string, string> = { [deal.id]: deal.title };
    const orderNumberById = Object.fromEntries(orders.map((o) => [o.id, o.orderNumber]));

    return {
      project: dealToProjectView(deal),
      summary: { planned, actual, delta, ordered, committed, received, notClosed, overdueLines },
      requests,
      items,
      orders,
      receipts,
      projectNameById,
      supplierNameById,
      categoryNameById,
      orderNumberById,
      dataSource: "live" as const,
    };
  } catch (e) {
    console.warn("[tryLoadProcurementProjectFromDeal]", e);
    return null;
  }
}
