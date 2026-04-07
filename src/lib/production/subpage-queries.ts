import type { Prisma, PrismaClient } from "@prisma/client";

export function ownerDealWhere(
  ownerWhere: Prisma.StringFilter | undefined,
): Prisma.DealWhereInput {
  return ownerWhere ? { ownerId: ownerWhere } : {};
}

/** Підготовка: передача прийнята, ще немає потоку або він у статусі NEW. */
export async function queryProductionDesignDeals(
  prisma: PrismaClient,
  ownerWhere: Prisma.StringFilter | undefined,
) {
  return prisma.deal.findMany({
    where: {
      ...ownerDealWhere(ownerWhere),
      handoff: { is: { status: "ACCEPTED" } },
      OR: [
        { productionFlow: null },
        { productionFlow: { status: "NEW" } },
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
      productionFlow: { select: { status: true } },
      constructorRoom: { select: { status: true, dueAt: true } },
    },
  });
}

/** У роботі: активний виробничий потік (цех / закупівлі). */
export async function queryProductionLineActiveDeals(
  prisma: PrismaClient,
  ownerWhere: Prisma.StringFilter | undefined,
) {
  const flows = await prisma.productionFlow.findMany({
    where: {
      status: {
        in: [
          "ACTIVE",
          "ON_HOLD",
          "BLOCKED",
          "READY_FOR_PROCUREMENT_AND_WORKSHOP",
          "IN_WORKSHOP",
        ],
      },
      deal: { is: ownerDealWhere(ownerWhere) },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      currentStepKey: true,
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
  return flows.map((o) => ({
    id: o.deal.id,
    title: o.deal.title,
    updatedAt: o.deal.updatedAt,
    client: o.deal.client,
    owner: o.deal.owner,
    productionFloorState: {
      stage: o.currentStepKey,
      progress: 0,
    },
  }));
}

/** Готові до монтажу. */
export async function queryProductionReadyInstallDeals(
  prisma: PrismaClient,
  ownerWhere: Prisma.StringFilter | undefined,
) {
  const flows = await prisma.productionFlow.findMany({
    where: {
      status: "READY_FOR_INSTALLATION",
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
          installationDate: true,
          client: { select: { name: true } },
          owner: { select: { name: true, email: true } },
        },
      },
    },
  });
  return flows.map((r) => r.deal);
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
      productionFlow: {
        select: {
          currentStepKey: true,
        },
      },
    },
  });
}

/** Завершені потоки. */
export async function queryProductionCompletedDeals(
  prisma: PrismaClient,
  ownerWhere: Prisma.StringFilter | undefined,
) {
  const flows = await prisma.productionFlow.findMany({
    where: {
      status: "DONE",
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
  return flows.map((o) => o.deal);
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

/** Довго без руху на активному потоці. */
export async function queryProductionStageStuckDeals(
  prisma: PrismaClient,
  ownerWhere: Prisma.StringFilter | undefined,
) {
  const stageCut = new Date(Date.now() - SLA_STAGE_HOURS * 3600000);
  const flows = await prisma.productionFlow.findMany({
    where: {
      status: { in: ["ACTIVE", "IN_WORKSHOP", "READY_FOR_PROCUREMENT_AND_WORKSHOP"] },
      updatedAt: { lt: stageCut },
      deal: { is: ownerDealWhere(ownerWhere) },
    },
    orderBy: { updatedAt: "asc" },
    take: 100,
    select: {
      currentStepKey: true,
      updatedAt: true,
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
  return flows.map((s) => ({
    ...s.deal,
    productionFloorState: {
      stage: s.currentStepKey,
      stageStartedAt: s.updatedAt,
      progress: 0,
    },
  }));
}
