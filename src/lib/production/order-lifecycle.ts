import type { PrismaClient, ProductionOrderStatus } from "@prisma/client";
import { recomputeOrderRiskAndAi } from "./ai-monitor";

/** При переході в роботу (Kanban / API): перший етап стає активним. */
export async function ensureOrderStarted(
  prisma: PrismaClient,
  orderId: string,
): Promise<void> {
  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      stages: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!order || order.status !== "QUEUED") return;
  const first = order.stages[0];
  if (!first || first.status !== "PENDING") return;

  await prisma.$transaction([
    prisma.productionOrder.update({
      where: { id: orderId },
      data: { status: "IN_PROGRESS" },
    }),
    prisma.productionStage.update({
      where: { id: first.id },
      data: {
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    }),
    prisma.productionTask.updateMany({
      where: { orderId, stageId: first.id, status: "TODO" },
      data: { status: "IN_PROGRESS" },
    }),
  ]);
}

export async function setOrderStatus(
  prisma: PrismaClient,
  orderId: string,
  status: ProductionOrderStatus,
): Promise<void> {
  if (status === "IN_PROGRESS") {
    await ensureOrderStarted(prisma, orderId);
  } else {
    await prisma.productionOrder.update({
      where: { id: orderId },
      data: { status },
    });
  }
  await recomputeOrderRiskAndAi(prisma, orderId);
}
