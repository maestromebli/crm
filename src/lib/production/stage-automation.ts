import type { PrismaClient } from "@prisma/client";
import { recomputeOrderRiskAndAi } from "./ai-monitor";

/**
 * Завершити етап: DONE → наступний IN_PROGRESS; останній етап → замовлення COMPLETED.
 */
export async function completeProductionStage(
  prisma: PrismaClient,
  orderId: string,
  stageId: string,
  actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await prisma.productionOrder.findFirst({
    where: { id: orderId },
    include: {
      stages: { orderBy: { sortOrder: "asc" } },
      deal: { select: { id: true, ownerId: true, title: true } },
    },
  });
  if (!order) return { ok: false, error: "Замовлення не знайдено." };

  const stage = order.stages.find((s) => s.id === stageId);
  if (!stage) return { ok: false, error: "Етап не знайдено." };
  if (stage.status === "DONE") return { ok: true };

  const next = order.stages.find((s) => s.sortOrder === stage.sortOrder + 1);

  await prisma.$transaction(async (tx) => {
    if (order.status === "QUEUED") {
      await tx.productionOrder.update({
        where: { id: orderId },
        data: { status: "IN_PROGRESS" },
      });
    }

    await tx.productionStage.update({
      where: { id: stageId },
      data: {
        status: "DONE",
        completedAt: new Date(),
      },
    });

    await tx.productionTask.updateMany({
      where: { stageId, orderId },
      data: { status: "DONE" },
    });

    if (next) {
      await tx.productionStage.update({
        where: { id: next.id },
        data: {
          status: "IN_PROGRESS",
          startedAt: next.startedAt ?? new Date(),
        },
      });
      await tx.productionTask.updateMany({
        where: { stageId: next.id, orderId },
        data: { status: "IN_PROGRESS" },
      });
    } else {
      await tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: "COMPLETED",
          atRisk: false,
        },
      });
      await tx.activityLog.create({
        data: {
          entityType: "DEAL",
          entityId: order.dealId,
          type: "PRODUCTION_ORDER_COMPLETED",
          source: "USER",
          actorUserId,
          data: { productionOrderId: orderId },
        },
      });
      await tx.domainEvent.create({
        data: {
          type: "PRODUCTION_ORDER_COMPLETED",
          dealId: order.dealId,
          payload: {
            productionOrderId: orderId,
            notifyRole: "SALES_OWNER",
            ownerId: order.deal.ownerId,
          },
        },
      });
    }

    await tx.activityLog.create({
      data: {
        entityType: "DEAL",
        entityId: order.dealId,
        type: "PRODUCTION_STAGE_COMPLETED",
        source: "USER",
        actorUserId,
        data: { productionOrderId: orderId, stageId },
      },
    });
  });

  await recomputeOrderRiskAndAi(prisma, orderId);
  return { ok: true };
}
