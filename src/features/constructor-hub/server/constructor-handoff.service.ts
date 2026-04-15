import { prisma } from "@/lib/prisma";
import { createConstructorTimelineEvent } from "./constructor-timeline.service";

export async function createProcurementIntakeFromConstructorApproval(input: {
  workspaceId: string;
  actorUserId: string;
}): Promise<void> {
  const workspace = await prisma.constructorWorkspace.findUnique({
    where: { id: input.workspaceId },
  });
  if (!workspace) throw new Error("Workspace не найден");
  if (!workspace.productionFlowId) return;

  const existing = await prisma.productionTask.count({
    where: {
      flowId: workspace.productionFlowId,
      type: "PROCUREMENT",
      status: { not: "CANCELLED" },
    },
  });
  if (existing > 0) return;

  await prisma.productionTask.create({
    data: {
      flowId: workspace.productionFlowId,
      type: "PROCUREMENT",
      title: "Constructor handoff: запустить закупки по утвержденному пакету",
      status: "TODO",
      metadataJson: {
        source: "constructor_hub",
        workspaceId: workspace.id,
      },
    },
  });
}

export async function createProductionIntakeFromConstructorApproval(input: {
  workspaceId: string;
  actorUserId: string;
}): Promise<void> {
  const workspace = await prisma.constructorWorkspace.findUnique({
    where: { id: input.workspaceId },
  });
  if (!workspace) throw new Error("Workspace не найден");
  if (!workspace.productionFlowId) return;

  const existing = await prisma.productionTask.count({
    where: {
      flowId: workspace.productionFlowId,
      type: "WORKSHOP",
      status: { not: "CANCELLED" },
    },
  });
  if (existing > 0) return;

  await prisma.productionTask.create({
    data: {
      flowId: workspace.productionFlowId,
      type: "WORKSHOP",
      title: "Constructor handoff: старт подготовки в цехе",
      status: "TODO",
      metadataJson: {
        source: "constructor_hub",
        workspaceId: workspace.id,
      },
    },
  });

  await createConstructorTimelineEvent({
    workspaceId: workspace.id,
    dealId: workspace.dealId,
    productionFlowId: workspace.productionFlowId,
    actorUserId: input.actorUserId,
    eventType: "HANDOFF_TO_PRODUCTION",
    title: "Создан intake в production/procurement",
  });
}
