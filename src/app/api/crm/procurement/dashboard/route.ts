import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { ownerIdWhere, resolveAccessContext } from "@/lib/authz/data-scope";
import { canProcurementAction } from "@/features/procurement/lib/permissions";
import { buildOrderedLineMonitorFromPrismaRequests } from "@/features/procurement/lib/ordered-line-monitor";

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isOptionalSchemaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

async function safeOptionalList<T>(
  scope: string,
  query: () => Promise<T[]>,
): Promise<T[]> {
  try {
    return await query();
  } catch (error) {
    if (isOptionalSchemaError(error)) {
      console.warn(
        `[api/crm/procurement/dashboard] Optional scope unavailable (${scope}): ${
          error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "unknown"
        }`,
      );
      return [];
    }
    throw error;
  }
}

export async function GET(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.view")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }
    const access = await resolveAccessContext(prisma, {
      id: user.id,
      role: user.dbRole,
    });
    const ownerFilter = ownerIdWhere(access);
    const dealWhere = ownerFilter ? { ownerId: ownerFilter } : undefined;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";

    const [suppliers, materials, orders, stock, requests] = await Promise.all([
      safeOptionalList("Supplier", () =>
        prisma.supplier.findMany({
          orderBy: { name: "asc" },
          take: 200,
        }),
      ),
      safeOptionalList("Material", () =>
        prisma.material.findMany({
          where: q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { code: { contains: q, mode: "insensitive" } },
                ],
              }
            : undefined,
          take: 100,
          include: { supplier: { select: { id: true, name: true } } },
        }),
      ),
      safeOptionalList("DealPurchaseOrder", () =>
        prisma.dealPurchaseOrder.findMany({
          where: dealWhere ? { deal: { ownerId: ownerFilter } } : undefined,
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            supplier: { select: { id: true, name: true } },
            deal: { select: { id: true, title: true } },
          },
        }),
      ),
      safeOptionalList("StockItem", () =>
        prisma.stockItem.findMany({
          take: 100,
          include: { material: { select: { id: true, name: true, code: true } } },
        }),
      ),
      safeOptionalList("ProcurementRequest", () =>
        prisma.procurementRequest.findMany({
          where: dealWhere ? { deal: { ownerId: ownerFilter } } : undefined,
          orderBy: { createdAt: "desc" },
          take: 120,
          include: {
            deal: { select: { id: true, title: true } },
            items: {
              select: {
                id: true,
                name: true,
                qtyPlanned: true,
                qtyOrdered: true,
                qtyReceived: true,
                costPlanned: true,
                costActual: true,
                status: true,
              },
            },
          },
        }),
      ),
    ]);

  const delayed = orders.filter(
    (o) =>
      o.status === "ORDERED" &&
      o.expectedDate &&
      o.expectedDate < new Date(),
  );

  const ai = {
    cheapestSupplier:
      suppliers.length > 0
        ? `Порівняйте ціни: зараз у довіднику ${suppliers.length} постачальників — додайте рейтинг у картці.`
        : "Додайте постачальників у довідник.",
    delays:
      delayed.length > 0
        ? `${delayed.length} замовлень мають прострочену дату поставки.`
        : "Прострочених поставок не виявлено.",
    reorder:
      stock.filter((s) => Number(s.quantity) - Number(s.reserved) < 5).length >
      0
        ? "Є позиції з низьким доступним залишком — перевірте склад."
        : "Критичних залишків не виявлено.",
  };

  const pendingApprovals = requests.filter((r) => r.status === "DRAFT").length;
  const missingDeliveries = requests.filter((r) =>
    r.items.some((i) => n(i.qtyOrdered) > n(i.qtyReceived)),
  ).length;
  const criticalShortages = requests.filter((r) =>
    r.priority === "CRITICAL" && r.items.some((i) => n(i.qtyReceived) < n(i.qtyPlanned)),
  ).length;

  const priceDeviations = requests
    .flatMap((r) =>
      r.items.map((i) => {
        const planned = n(i.costPlanned);
        const actual = n(i.costActual);
        const variance = actual - planned;
        return {
          requestId: r.id,
          itemId: i.id,
          itemName: i.name,
          dealId: r.dealId,
          dealTitle: r.deal?.title ?? "—",
          planned,
          actual,
          variance,
        };
      }),
    )
    .filter((i) => i.planned > 0 || i.actual > 0)
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 12);

  const varianceControl = requests.map((r) => {
    const estimateCost = r.items.reduce((acc, i) => acc + n(i.costPlanned), 0);
    const plannedProcurement = r.items.reduce(
      (acc, i) => acc + n(i.qtyPlanned) * Math.max(n(i.costPlanned), 0),
      0,
    );
    const actualProcurement = r.items.reduce(
      (acc, i) => acc + n(i.qtyReceived) * Math.max(n(i.costActual) || n(i.costPlanned), 0),
      0,
    );
    const delta = actualProcurement - plannedProcurement;
    return {
      requestId: r.id,
      dealId: r.dealId,
      dealTitle: r.deal?.title ?? "—",
      estimateCost,
      plannedProcurement,
      actualProcurement,
      delta,
      status:
        delta > 0 ? "overrun" : delta < 0 ? "saving" : "on_track",
    };
  });

  const supplierStats = suppliers.map((supplier) => {
    const supplierOrders = orders.filter((o) => o.supplierId === supplier.id);
    const totalOrders = supplierOrders.length;
    const delayedOrders = supplierOrders.filter(
      (o) => o.status === "ORDERED" && o.expectedDate && o.expectedDate < new Date(),
    ).length;
    const slaPct =
      totalOrders > 0 ? Number((((totalOrders - delayedOrders) / totalOrders) * 100).toFixed(1)) : 100;
    const spend = supplierOrders.reduce((acc, o) => acc + n(o.total), 0);
    const paidOrders = supplierOrders.filter((o) => o.status === "PAID").length;
    const paymentDisciplinePct =
      totalOrders > 0 ? Number(((paidOrders / totalOrders) * 100).toFixed(1)) : 100;
    const riskScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (slaPct < 60 ? 35 : slaPct < 80 ? 20 : 8) +
            (paymentDisciplinePct < 40 ? 25 : paymentDisciplinePct < 70 ? 15 : 8) +
            (spend > 800000 ? 20 : spend > 350000 ? 12 : 6),
        ),
      ),
    );
    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      slaPct,
      paymentDisciplinePct,
      delayedOrders,
      spend,
      riskScore,
      riskLabel: riskScore >= 70 ? "Критичний" : riskScore >= 45 ? "Підвищений" : "Контрольований",
    };
  });
  const sortedSupplierStats = supplierStats.sort((a, b) => b.riskScore - a.riskScore);
  const systemicRiskScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (delayed.length * 7 + criticalShortages * 8 + pendingApprovals * 4 + missingDeliveries * 5) /
            1.6,
        ),
      ),
    );

    const orderedLineMonitor = buildOrderedLineMonitorFromPrismaRequests(requests).slice(0, 120).map((row) => ({
      ...row,
      plannedValue: Math.round(row.plannedValue),
      orderedValue: Math.round(row.orderedValue),
      receivedValue: Math.round(row.receivedValue),
      valueRemainingPlanned: Math.round(row.valueRemainingPlanned),
      unitPriceDelta: Math.round(row.unitPriceDelta * 100) / 100,
    }));

    return NextResponse.json({
      suppliers,
      materials: materials.map((m) => ({
        ...m,
        price: m.price.toString(),
      })),
      purchaseOrders: orders.map((o) => ({
        ...o,
        total: o.total.toString(),
      })),
      stock: stock.map((s) => ({
        ...s,
        quantity: s.quantity.toString(),
        reserved: s.reserved.toString(),
        available: (Number(s.quantity) - Number(s.reserved)).toString(),
      })),
      procurementRequests: requests.map((r) => ({
        id: r.id,
        dealId: r.dealId,
        dealTitle: r.deal?.title ?? null,
        source: r.source,
        priority: r.priority,
        neededByDate: r.neededByDate?.toISOString() ?? null,
        status: r.status,
        items: r.items.map((i) => ({
          ...i,
          qtyPlanned: i.qtyPlanned.toString(),
          qtyOrdered: i.qtyOrdered.toString(),
          qtyReceived: i.qtyReceived.toString(),
          costPlanned: i.costPlanned?.toString() ?? null,
          costActual: i.costActual?.toString() ?? null,
        })),
      })),
      goodsReceiptStats: {
        receiptsCount: 0,
        rejectedCount: 0,
        damagedCount: 0,
        shortageCount: 0,
        defectCount: 0,
      },
      dashboard: {
        pendingApprovals,
        delayedOrders: delayed.length,
        missingDeliveries,
        criticalShortages,
        priceDeviations,
        varianceControl,
        orderedLineMonitor,
      },
      enterprise: {
        supplierRiskRadar: sortedSupplierStats.slice(0, 20),
        systemicRiskScore,
      },
      ai,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/procurement/dashboard]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
