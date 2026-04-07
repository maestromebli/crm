import type { Prisma, PrismaClient } from "@prisma/client";

export type WarehouseReserveLine = {
  materialId?: string;
  materialCode?: string;
  qty: number;
};

/** Очікуваний формат у `ProductionTask.metadataJson`: `warehouseReserve: [{ materialId?, materialCode?, qty }]`. */
export function parseWarehouseReserve(metadataJson: unknown): WarehouseReserveLine[] {
  if (!metadataJson || typeof metadataJson !== "object") return [];
  const m = metadataJson as Record<string, unknown>;
  const raw = m.warehouseReserve;
  if (!Array.isArray(raw)) return [];
  const out: WarehouseReserveLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const qty = Number(r.qty);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const materialId = typeof r.materialId === "string" ? r.materialId : undefined;
    const materialCode = typeof r.materialCode === "string" ? r.materialCode : undefined;
    if (!materialId && !materialCode) continue;
    out.push({ materialId, materialCode, qty });
  }
  return out;
}

async function stockItemIdForMaterial(
  tx: Prisma.TransactionClient | PrismaClient,
  materialId: string,
): Promise<string | null> {
  const item = await tx.stockItem.findFirst({
    where: { materialId },
    orderBy: { updatedAt: "desc" },
  });
  return item?.id ?? null;
}

async function stockItemIdForMaterialCode(
  tx: Prisma.TransactionClient | PrismaClient,
  code: string,
): Promise<string | null> {
  const mat = await tx.material.findFirst({
    where: { code: { equals: code, mode: "insensitive" } },
  });
  if (!mat) return null;
  return stockItemIdForMaterial(tx, mat.id);
}

export type SyncReservationsResult = {
  tasksConsidered: number;
  tasksWithLines: number;
  reservationsUpserted: number;
  stockItemsRecomputed: number;
};

/**
 * Перебудова резервів із активних цехових задач: metadataJson.warehouseReserve.
 * Знімає попередні ACTIVE-резерви, прив’язані до ProductionTask, і створює нові.
 */
export async function syncWarehouseReservationsFromProduction(
  prisma: PrismaClient,
): Promise<SyncReservationsResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.stockReservation.findMany({
      where: { productionTaskId: { not: null }, status: "ACTIVE" },
      select: { stockItemId: true },
    });
    const affected = new Set(existing.map((e) => e.stockItemId));

    await tx.stockReservation.deleteMany({
      where: { productionTaskId: { not: null }, status: "ACTIVE" },
    });

    const tasks = await tx.productionTask.findMany({
      where: {
        type: "WORKSHOP",
        status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] },
      },
      select: {
        id: true,
        metadataJson: true,
        flow: { select: { number: true, title: true } },
      },
    });

    let reservationsUpserted = 0;
    let tasksWithLines = 0;

    for (const task of tasks) {
      const lines = parseWarehouseReserve(task.metadataJson);
      if (lines.length === 0) continue;
      tasksWithLines += 1;

      for (const line of lines) {
        let stockItemId: string | null = null;
        if (line.materialId) {
          stockItemId = await stockItemIdForMaterial(tx, line.materialId);
        }
        if (!stockItemId && line.materialCode) {
          stockItemId = await stockItemIdForMaterialCode(tx, line.materialCode);
        }
        if (!stockItemId) continue;

        await tx.stockReservation.create({
          data: {
            stockItemId,
            productionTaskId: task.id,
            quantity: line.qty,
            status: "ACTIVE",
            note: `Задача цеху · ${task.flow.number}`,
          },
        });
        reservationsUpserted += 1;
        affected.add(stockItemId);
      }
    }

    for (const stockItemId of affected) {
      const sum = await tx.stockReservation.aggregate({
        where: { stockItemId, status: "ACTIVE" },
        _sum: { quantity: true },
      });
      const reserved = sum._sum.quantity ?? 0;
      await tx.stockItem.update({
        where: { id: stockItemId },
        data: { reserved },
      });
    }

    return {
      tasksConsidered: tasks.length,
      tasksWithLines,
      reservationsUpserted,
      stockItemsRecomputed: affected.size,
    };
  });
}
