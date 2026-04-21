import { prisma } from "@/lib/prisma";

export type DealHubAggregate = {
  deal: any;
  openTasks: any[];
  latestAttachments: any[];
  timelineActivity: any[];
  stageHistory: any[];
};

export async function getDealHubAggregate(dealId: string): Promise<DealHubAggregate | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      stage: true,
      pipeline: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true } },
      client: { select: { id: true, name: true } },
      primaryContact: { select: { id: true, fullName: true } },
      contract: {
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      },
      handoff: {
        select: {
          id: true,
          status: true,
          acceptedAt: true,
          submittedAt: true,
        },
      },
      paymentMilestones: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          label: true,
          amount: true,
          currency: true,
          dueAt: true,
          confirmedAt: true,
        },
      },
      financeSnapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          revenueUah: true,
          expensesUah: true,
          profitUah: true,
          marginPct: true,
          createdAt: true,
        },
      },
      estimates: {
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: {
          id: true,
          version: true,
          status: true,
          totalPrice: true,
          grossMargin: true,
          updatedAt: true,
        },
      },
      productionFlow: {
        select: {
          id: true,
          number: true,
          status: true,
          acceptedAt: true,
        },
      },
      installationDate: true,
      expectedCloseDate: true,
      createdAt: true,
      updatedAt: true,
      status: true,
      value: true,
      currency: true,
      workspaceMeta: true,
      id: true,
      title: true,
    },
  });

  if (!deal) return null;

  const [openTasks, latestAttachments, timelineActivity, stageHistory] = await Promise.all([
    prisma.task.findMany({
      where: {
        entityType: "DEAL",
        entityId: dealId,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        status: true,
        dueAt: true,
        priority: true,
        assignee: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.attachment.findMany({
      where: {
        entityType: "DEAL",
        entityId: dealId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        fileName: true,
        category: true,
        createdAt: true,
      },
    }),
    prisma.activityLog.findMany({
      where: { entityType: "DEAL", entityId: dealId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        createdAt: true,
        actorUser: { select: { name: true, email: true } },
      },
    }),
    prisma.dealStageHistory.findMany({
      where: { dealId },
      orderBy: { changedAt: "desc" },
      take: 20,
      select: {
        id: true,
        changedAt: true,
        changedBy: { select: { name: true, email: true } },
        fromStage: { select: { name: true } },
        toStage: { select: { name: true } },
      },
    }),
  ]);

  return {
    deal,
    openTasks,
    latestAttachments,
    timelineActivity,
    stageHistory,
  };
}
