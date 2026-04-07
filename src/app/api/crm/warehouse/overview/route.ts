import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canProcurementAction } from "@/features/procurement/lib/permissions";

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

async function safeOptionalList<T>(scope: string, query: () => Promise<T[]>): Promise<T[]> {
  try {
    return await query();
  } catch (error) {
    if (isOptionalSchemaError(error)) {
      console.warn(
        `[api/crm/warehouse/overview] Optional scope unavailable (${scope}): ${
          error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "unknown"
        }`,
      );
      return [];
    }
    throw error;
  }
}

type StockRow = {
  id: string;
  sku: string | null;
  quantity: string;
  reserved: string;
  available: string;
  material: { id: string; name: string; code: string | null; price: string | null } | null;
  lineValueUah: number;
  storageZone: { id: string; name: string; code: string; barcode: string } | null;
};

async function loadStockRows(): Promise<StockRow[]> {
  try {
    const stock = await prisma.stockItem.findMany({
      take: 500,
      orderBy: { updatedAt: "desc" },
      include: {
        material: { select: { id: true, name: true, code: true, price: true } },
        storageZone: { select: { id: true, name: true, code: true, barcode: true } },
      },
    });
    return mapStockToRows(stock);
  } catch (error) {
    if (!isOptionalSchemaError(error)) throw error;
    const stock = await prisma.stockItem.findMany({
      take: 500,
      orderBy: { updatedAt: "desc" },
      include: {
        material: { select: { id: true, name: true, code: true, price: true } },
      },
    });
    return mapStockToRows(
      stock.map((s) => ({
        ...s,
        storageZone: null,
      })),
    );
  }
}

function mapStockToRows(
  stock: Array<{
    id: string;
    sku: string | null;
    quantity: unknown;
    reserved: unknown;
    material: {
      id: string;
      name: string;
      code: string | null;
      price: number | null;
    } | null;
    storageZone: { id: string; name: string; code: string; barcode: string } | null;
  }>,
): StockRow[] {
  return stock.map((s) => {
    const qty = n(s.quantity);
    const reserved = n(s.reserved);
    const available = Math.max(0, qty - reserved);
    return {
      id: s.id,
      sku: s.sku,
      quantity: String(s.quantity),
      reserved: String(s.reserved),
      available: String(available),
      material: s.material
        ? {
            id: s.material.id,
            name: s.material.name,
            code: s.material.code,
            price: s.material.price != null ? s.material.price.toString() : null,
          }
        : null,
      lineValueUah: 0,
      storageZone: s.storageZone
        ? {
            id: s.storageZone.id,
            name: s.storageZone.name,
            code: s.storageZone.code,
            barcode: s.storageZone.barcode,
          }
        : null,
    };
  });
}

const LOW_STOCK_THRESHOLD = 5;

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.view")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const [stockRows, openOrders, materialsForPrice, zones, reservations, recentMovements] =
      await Promise.all([
        loadStockRows(),
        safeOptionalList("DealPurchaseOrder", () =>
          prisma.dealPurchaseOrder.findMany({
            where: { status: { in: ["DRAFT", "ORDERED"] } },
            take: 80,
            orderBy: { expectedDate: "asc" },
            include: {
              supplier: { select: { id: true, name: true } },
              deal: { select: { id: true, title: true } },
            },
          }),
        ),
        safeOptionalList("Material", () =>
          prisma.material.findMany({
            take: 400,
            select: { id: true, price: true },
          }),
        ),
        safeOptionalList("WarehouseStorageZone", () =>
          prisma.warehouseStorageZone.findMany({
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          }),
        ),
        safeOptionalList("StockReservation", () =>
          prisma.stockReservation.findMany({
            where: { status: "ACTIVE" },
            take: 200,
            orderBy: { updatedAt: "desc" },
            include: {
              stockItem: { include: { material: { select: { name: true, code: true } } } },
              productionTask: {
                include: { flow: { select: { number: true, title: true } } },
              },
            },
          }),
        ),
        safeOptionalList("WarehouseStockMovement", () =>
          prisma.warehouseStockMovement.findMany({
            take: 60,
            orderBy: { createdAt: "desc" },
            include: {
              stockItem: { include: { material: { select: { name: true, code: true } } } },
            },
          }),
        ),
      ]);

    const priceByMaterialId = new Map(materialsForPrice.map((m) => [m.id, n(m.price)]));

    let totalQty = 0;
    let totalReserved = 0;
    let estimatedValue = 0;
    let lowStockLines = 0;

    const rows = stockRows.map((row) => {
      const qty = n(row.quantity);
      const reserved = n(row.reserved);
      const available = Math.max(0, qty - reserved);
      const unitPrice =
        n(row.material?.price) ||
        (row.material?.id ? priceByMaterialId.get(row.material.id) ?? 0 : 0);
      const lineValue = available * unitPrice;
      totalQty += qty;
      totalReserved += reserved;
      estimatedValue += lineValue;
      if (available < LOW_STOCK_THRESHOLD) lowStockLines += 1;
      return {
        ...row,
        lineValueUah: Math.round(lineValue),
      };
    });

    const totalAvailable = Math.max(0, totalQty - totalReserved);
    const coveragePct =
      totalQty > 0 ? Math.round((totalAvailable / totalQty) * 1000) / 10 : 100;

    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const inboundExpected7d = openOrders.filter((o) => {
      if (!o.expectedDate) return false;
      const t = o.expectedDate.getTime();
      return t >= now && t <= now + weekMs;
    }).length;

    const stockWithoutZone = rows.filter((r) => !r.storageZone).length;
    const topByValue = [...rows]
      .sort((a, b) => b.lineValueUah - a.lineValueUah)
      .slice(0, 6)
      .map((r) => ({
        id: r.id,
        name: r.material?.name ?? "—",
        code: r.material?.code ?? null,
        lineValueUah: r.lineValueUah,
      }));
    const reservationPressure =
      totalQty > 0 ? Math.round((totalReserved / totalQty) * 1000) / 10 : 0;
    const healthScore =
      rows.length === 0
        ? 100
        : Math.round(
            Math.max(
              0,
              Math.min(
                100,
                100 -
                  (lowStockLines / rows.length) * 38 -
                  (stockWithoutZone / rows.length) * 22 -
                  (reservationPressure > 85 ? 12 : reservationPressure > 70 ? 6 : 0),
              ),
            ),
          );

    return NextResponse.json({
      kpi: {
        skuCount: rows.length,
        totalQuantity: Math.round(totalQty * 100) / 100,
        totalReserved: Math.round(totalReserved * 100) / 100,
        totalAvailable: Math.round(totalAvailable * 100) / 100,
        estimatedValueUah: Math.round(estimatedValue),
        lowStockLines,
        coveragePct,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
      },
      insights: {
        healthScore,
        stockWithoutZone,
        activeReservationsCount: reservations.length,
        reservationPressurePct: reservationPressure,
        topByValue,
      },
      stock: rows,
      zones: zones.map((z) => ({
        id: z.id,
        name: z.name,
        code: z.code,
        barcode: z.barcode,
        sortOrder: z.sortOrder,
        isActive: z.isActive,
      })),
      reservations: reservations.map((r) => ({
        id: r.id,
        quantity: r.quantity,
        materialName: r.stockItem.material?.name ?? "—",
        materialCode: r.stockItem.material?.code ?? null,
        flowNumber: r.productionTask?.flow.number ?? null,
        flowTitle: r.productionTask?.flow.title ?? null,
        productionTaskId: r.productionTaskId,
        note: r.note,
      })),
      recentMovements: recentMovements.map((m) => ({
        id: m.id,
        kind: m.kind,
        quantityDelta: m.quantityDelta,
        refKind: m.refKind,
        refId: m.refId,
        note: m.note,
        createdAt: m.createdAt.toISOString(),
        materialName: m.stockItem.material?.name ?? "—",
      })),
      procurement: {
        openPurchaseOrders: openOrders.length,
        inboundExpected7d,
        orders: openOrders.slice(0, 15).map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          total: o.total.toString(),
          expectedDate: o.expectedDate?.toISOString() ?? null,
          supplierName: o.supplier.name,
          dealTitle: o.deal?.title ?? null,
        })),
      },
      production: {
        reservedQty: Math.round(totalReserved * 100) / 100,
      },
      finance: {
        inventoryEstimateUah: Math.round(estimatedValue),
        note: "Оцінка залишків за ціною матеріалу; для бухобліку використовуйте журнал фінансів.",
      },
      wms: {
        reserveSchema:
          "ProductionTask.metadataJson.warehouseReserve = [{ materialId?, materialCode?, qty }]",
        syncHint:
          "POST /api/crm/warehouse/sync-reservations — перераховує резерви з активних задач цеху (WORKSHOP).",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/warehouse/overview]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
