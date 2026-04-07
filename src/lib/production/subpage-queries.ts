import type { Prisma, PrismaClient } from "@prisma/client";

export function ownerDealWhere(
  ownerWhere: Prisma.StringFilter | undefined,
): Prisma.DealWhereInput {
  return ownerWhere ? { ownerId: ownerWhere } : {};
}

/** Підготовка: передача прийнята, ще немає виробничого замовлення або воно в черзі. */
export async function queryProductionDesignDeals(
  prisma: PrismaClient,
  ownerWhere: Prisma.StringFilter | undefined,
) {
  return prisma.deal.findMany({
    where: {
      ...ownerDealWhere(ownerWhere),
      handoff: { is: { status: "ACCEPTED" } },
      OR: [
        { productionOrders: { none: {} } },
        {
          productionOrders: {
            some: { status: "QUEUED" },
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      client: { select: { name: true } },
      owner: { select: { name: true, email: true } },
      productionOrders: { take: 1, select: { status: true } },
      constructorRoom: { select: { status: true, dueAt: true } },
    },
  });
}

/** У роботі: виробниче замовлення активне. */
export async function queryProductionLineActiveDeals(
  prisma: PrismaClient,
  ownerWhere: Prisma.StringFilter | undefined,
) {
  const orders = await prisma.productionOrder.findMany({
    where: {
      status: { in: ["IN_PROGRESS", "PAUSED"] },
      deal: { is: ownerDealWhere(ownerWhere) },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      deal: {
        select: {
          id: true,
          title: true,
          updatedAt: true,
          client: { select: { name: true } },
          owner: { select: { name: true, email: true } },
        },
      },
      stages: {
        where: { status: "IN_PROGRESS" },
        take: 1,
        select: { name: true },
      },
    },
  });
  return orders.map((o) => ({
    id: o.deal.id,
    title: o.deal.title,
    updatedAt: o.deal.updatedAt,
    client: o.deal.client,
    owner: o.deal.owner,
    productionFloorState: {
      stage: o.stages[0]?.name ?? "CUTTING",
      progress: 0,
    },
  }));
}

/** Готові до монтажу: етап INSTALLATION у черзі або в роботі після PACKAGING/DELIVERY. */
export async function queryProductionReadyInstallDeals(
  prisma: PrismaClient,
  ownerWhere: Prisma.StringFilter | undefined,
) {
  const orders = await prisma.productionOrder.findMany({
    where: {
      status: "IN_PROGRESS",
      deal: { is: ownerDealWhere(ownerWhere) },
      stages: {
        some: {
          name: "INSTALLATION",
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      deal: {
        select: {
          id: true,
          title: true,
          updatedAt: true,
          installationDate: true,
          client: { select: { name: true } },
          owner: { select: { name: true, email: true } },
        },
      },
    },
  });
  return orders.map((r) => r.deal);
}

/** Графік монтажів. */
export async function queryProductionInstallScheduleDeals(
  prisma: PrismaClient,
  ownerWhere: Prisma.StringFilter | undefined,
) {
  return prisma.deal.findMany({
    where: {
      ...ownerDealWhere(ownerWhere),
      installationDate: { not: null },
      status: { in: ["OPEN", "ON_HOLD"] },
    },
    orderBy: { installationDate: "asc" },
    take: 200,
    select: {
      id: true,
      title: true,
      installationDate: true,
      client: { select: { name: true } },
      owner: { select: { name: true, email: true } },
      productionOrders: {
        take: 1,
        select: {
          stages: {
            where: { status: "IN_PROGRESS" },
            take: 1,
            select: { name: true },
          },
        },
      },
    },
  });
}

/** Завершені виробничі замовлення. */
export async function queryProductionCompletedDeals(
  prisma: PrismaClient,
  ownerWhere: Prisma.StringFilter | undefined,
) {
  const orders = await prisma.productionOrder.findMany({
    where: {
      status: "COMPLETED",
      deal: { is: ownerDealWhere(ownerWhere) },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      deal: {
        select: {
          id: true,
          title: true,
          updatedAt: true,
          client: { select: { name: true } },
          owner: { select: { name: true, email: true } },
        },
      },
    },
  });
  return orders.map((o) => o.deal);
}

const SLA_HANDOFF_HOURS = 24;
const SLA_STAGE_HOURS = 48;

export async function queryProductionHandoffDelays(
  prisma: PrismaClient,
  ownerWhere: Prisma.StringFilter | undefined,
) {
  const handoffCut = new Date(Date.now() - SLA_HANDOFF_HOURS * 3600000);
  return prisma.deal.findMany({
    where: {
      ...ownerDealWhere(ownerWhere),
      handoff: {
        is: {
          status: "SUBMITTED",
          submittedAt: { lt: handoffCut },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      handoff: { select: { submittedAt: true } },
      client: { select: { name: true } },
      owner: { select: { name: true, email: true } },
    },
  });
}

/** Довго на етапі (початок етапу старіший за SLA). */
export async function queryProductionStageStuckDeals(
  prisma: PrismaClient,
  ownerWhere: Prisma.StringFilter | undefined,
) {
  const stageCut = new Date(Date.now() - SLA_STAGE_HOURS * 3600000);
  const stages = await prisma.productionStage.findMany({
    where: {
      status: "IN_PROGRESS",
      startedAt: { lt: stageCut },
      order: {
        deal: { is: ownerDealWhere(ownerWhere) },
      },
    },
    orderBy: { startedAt: "asc" },
    take: 100,
    select: {
      name: true,
      startedAt: true,
      order: {
        select: {
          deal: {
            select: {
              id: true,
              title: true,
              updatedAt: true,
              client: { select: { name: true } },
              owner: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });
  return stages.map((s) => ({
    ...s.order.deal,
    productionFloorState: {
      stage: s.name,
      stageStartedAt: s.startedAt,
      progress: 0,
    },
  }));
}
