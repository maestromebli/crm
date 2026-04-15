import type { ConstructorWorkspace, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { constructorAssignSchema, constructorCreateWorkspaceSchema, constructorTechSpecSchema, ensureWorkspaceTransition } from "./constructor-validation";
import { createConstructorTimelineEvent, emitConstructorWorkflowEvent } from "./constructor-timeline.service";

const DEFAULT_CHECKLIST: Array<{ code: string; title: string; description: string; sortOrder: number }> = [
  { code: "REVIEW_TECH_SPEC", title: "Изучить ТЗ", description: "Проверить структуру технического задания", sortOrder: 10 },
  { code: "REVIEW_MEASUREMENTS", title: "Проверить замеры", description: "Сверить контрольные размеры", sortOrder: 20 },
  { code: "REVIEW_APPROVED_MATERIALS", title: "Проверить согласованные материалы", description: "Сверить материалы и фасады", sortOrder: 30 },
  { code: "RESOLVE_CRITICAL_QUESTIONS", title: "Закрыть критические вопросы", description: "Все CRITICAL-вопросы должны быть закрыты", sortOrder: 40 },
  { code: "UPLOAD_DRAFT", title: "Загрузить черновик", description: "Добавить файлы версии", sortOrder: 50 },
  { code: "COMPLETE_VERSION_COMMENT", title: "Заполнить комментарий версии", description: "Добавить summary изменений", sortOrder: 60 },
  { code: "SUBMIT_FOR_REVIEW", title: "Отправить на проверку", description: "Передать версию на ревью", sortOrder: 70 },
];

type WorkspaceWithScope = ConstructorWorkspace & { dealOwnerId: string };

async function buildApprovedSnapshot(dealId: string): Promise<Prisma.InputJsonObject> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true,
      title: true,
      workspaceMeta: true,
      controlMeasurementJson: true,
      commercialSnapshotJson: true,
      commercialSnapshotSourceProposalId: true,
      commercialSnapshotFrozenAt: true,
      productionFlow: {
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          constructorName: true,
        },
      },
      client: { select: { name: true } },
    },
  });
  if (!deal) throw new Error("Deal не найден");

  return {
    dealId: deal.id,
    dealTitle: deal.title,
    clientName: deal.client.name,
    approvedQuoteSourceId: deal.commercialSnapshotSourceProposalId ?? null,
    approvedQuoteSnapshotAt: deal.commercialSnapshotFrozenAt?.toISOString() ?? null,
    approvedCommercialSnapshot: deal.commercialSnapshotJson ?? null,
    approvedMeasurements: deal.controlMeasurementJson ?? null,
    approvedWorkspaceMeta: deal.workspaceMeta ?? null,
    flow: deal.productionFlow
      ? {
          id: deal.productionFlow.id,
          number: deal.productionFlow.number,
          title: deal.productionFlow.title,
          status: deal.productionFlow.status,
          constructorName: deal.productionFlow.constructorName,
        }
      : null,
  };
}

export async function createConstructorWorkspace(input: {
  actorUserId: string;
  payload: unknown;
}): Promise<ConstructorWorkspace> {
  const parsed = constructorCreateWorkspaceSchema.parse(input.payload);
  const existing = await prisma.constructorWorkspace.findUnique({
    where: { dealId: parsed.dealId },
  });
  if (existing) return existing;

  const flow = parsed.productionFlowId
    ? await prisma.productionFlow.findUnique({
        where: { id: parsed.productionFlowId },
        select: { id: true, dealId: true },
      })
    : await prisma.productionFlow.findUnique({
        where: { dealId: parsed.dealId },
        select: { id: true, dealId: true },
      });
  if (!flow || flow.dealId !== parsed.dealId) {
    throw new Error("Нельзя создать workspace без Production Flow");
  }

  const snapshot = await buildApprovedSnapshot(parsed.dealId);
  const now = new Date();
  const row = await prisma.constructorWorkspace.create({
    data: {
      dealId: parsed.dealId,
      productionFlowId: flow.id,
      assignedByUserId: input.actorUserId,
      status: "NOT_ASSIGNED",
      priority: parsed.priority ?? "NORMAL",
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
      techSpec: {
        create: {
          sourceSnapshotJson: snapshot,
          approvedDataSnapshotJson: snapshot,
          createdByUserId: input.actorUserId,
          updatedByUserId: input.actorUserId,
        },
      },
      checklistItems: {
        create: DEFAULT_CHECKLIST.map((item) => ({
          code: item.code,
          title: item.title,
          description: item.description,
          isRequired: true,
          sortOrder: item.sortOrder,
        })),
      },
    },
  });

  await createConstructorTimelineEvent({
    workspaceId: row.id,
    dealId: row.dealId,
    productionFlowId: row.productionFlowId ?? null,
    actorUserId: input.actorUserId,
    eventType: "WORKSPACE_CREATED",
    title: "Создана рабочая зона конструктора",
    metadataJson: { workspaceId: row.id },
  });

  await prisma.productionFlow.update({
    where: { id: flow.id },
    data: {
      constructorWorkspaceUrl: `/crm/production/constructor/${row.id}`,
    },
  });

  return row;
}

export async function assignConstructor(input: {
  workspaceId: string;
  actorUserId: string;
  payload: unknown;
}): Promise<ConstructorWorkspace> {
  const parsed = constructorAssignSchema.parse(input.payload);
  const workspace = await prisma.constructorWorkspace.findUnique({
    where: { id: input.workspaceId },
  });
  if (!workspace) throw new Error("Workspace не найден");

  ensureWorkspaceTransition(workspace.status, "ASSIGNED");
  const now = new Date();
  const updated = await prisma.constructorWorkspace.update({
    where: { id: workspace.id },
    data: {
      assignedConstructorUserId: parsed.assignedConstructorUserId,
      assignedByUserId: input.actorUserId,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : workspace.dueDate,
      priority: parsed.priority ?? workspace.priority,
      status: "ASSIGNED",
      startedAt: workspace.startedAt ?? now,
    },
  });

  if (updated.productionFlowId) {
    await prisma.productionFlow.update({
      where: { id: updated.productionFlowId },
      data: {
        constructorMode: "INTERNAL",
        currentStepKey: "CONSTRUCTOR_IN_PROGRESS",
        constructorWorkspaceUrl: `/crm/production/constructor/${updated.id}`,
      },
    });
  }

  await createConstructorTimelineEvent({
    workspaceId: updated.id,
    dealId: updated.dealId,
    productionFlowId: updated.productionFlowId ?? null,
    actorUserId: input.actorUserId,
    eventType: "CONSTRUCTOR_ASSIGNED",
    title: "Назначен конструктор",
    metadataJson: { assignedConstructorUserId: parsed.assignedConstructorUserId },
  });

  return updated;
}

export async function getConstructorWorkspaceOrThrow(workspaceId: string): Promise<WorkspaceWithScope> {
  const row = await prisma.constructorWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      deal: { select: { ownerId: true } },
    },
  });
  if (!row) throw new Error("Workspace не найден");
  return {
    ...row,
    dealOwnerId: row.deal.ownerId,
  };
}

export async function updateConstructorTechSpec(input: {
  workspaceId: string;
  actorUserId: string;
  payload: unknown;
}): Promise<void> {
  const parsed = constructorTechSpecSchema.parse(input.payload);
  const workspace = await prisma.constructorWorkspace.findUnique({
    where: { id: input.workspaceId },
  });
  if (!workspace) throw new Error("Workspace не найден");

  const jsonData: Omit<
    Prisma.ConstructorTechSpecUncheckedCreateInput,
    "workspaceId"
  > = {
    generalInfoJson: (parsed.generalInfoJson as Prisma.InputJsonValue) ?? undefined,
    zonesJson: (parsed.zonesJson as Prisma.InputJsonValue) ?? undefined,
    modulesJson: (parsed.modulesJson as Prisma.InputJsonValue) ?? undefined,
    materialsJson: (parsed.materialsJson as Prisma.InputJsonValue) ?? undefined,
    facadesJson: (parsed.facadesJson as Prisma.InputJsonValue) ?? undefined,
    fittingsJson: (parsed.fittingsJson as Prisma.InputJsonValue) ?? undefined,
    lightingAndAppliancesJson:
      (parsed.lightingAndAppliancesJson as Prisma.InputJsonValue) ?? undefined,
    installationNotesJson:
      (parsed.installationNotesJson as Prisma.InputJsonValue) ?? undefined,
    risksJson: (parsed.risksJson as Prisma.InputJsonValue) ?? undefined,
    requiredAttentionJson:
      (parsed.requiredAttentionJson as Prisma.InputJsonValue) ?? undefined,
    sourceSnapshotJson:
      (parsed.sourceSnapshotJson as Prisma.InputJsonValue) ?? undefined,
    approvedDataSnapshotJson:
      (parsed.approvedDataSnapshotJson as Prisma.InputJsonValue) ?? undefined,
  };

  await prisma.constructorTechSpec.upsert({
    where: { workspaceId: workspace.id },
    update: {
      ...jsonData,
    },
    create: {
      workspaceId: workspace.id,
      ...jsonData,
    },
  });

  await createConstructorTimelineEvent({
    workspaceId: workspace.id,
    dealId: workspace.dealId,
    productionFlowId: workspace.productionFlowId ?? null,
    actorUserId: input.actorUserId,
    eventType: "TECH_SPEC_UPDATED",
    title: "Обновлено техническое задание",
  });
}

export async function markWorkspaceStatus(input: {
  workspaceId: string;
  status: ConstructorWorkspace["status"];
  actorUserId: string;
  note?: string;
}): Promise<ConstructorWorkspace> {
  const row = await prisma.constructorWorkspace.findUnique({
    where: { id: input.workspaceId },
  });
  if (!row) throw new Error("Workspace не найден");
  ensureWorkspaceTransition(row.status, input.status);

  const updated = await prisma.constructorWorkspace.update({
    where: { id: row.id },
    data: {
      status: input.status,
      submittedAt: input.status === "UNDER_REVIEW" ? new Date() : row.submittedAt,
      approvedAt: input.status === "APPROVED" ? new Date() : row.approvedAt,
      handedOffAt: input.status === "HANDED_OFF_TO_PRODUCTION" ? new Date() : row.handedOffAt,
    },
  });

  await createConstructorTimelineEvent({
    workspaceId: updated.id,
    dealId: updated.dealId,
    productionFlowId: updated.productionFlowId ?? null,
    actorUserId: input.actorUserId,
    eventType: input.status,
    title: `Статус workspace: ${input.status}`,
    description: input.note ?? null,
  });
  return updated;
}

export async function handoffConstructorWorkspaceToProduction(input: {
  workspaceId: string;
  actorUserId: string;
}): Promise<void> {
  const workspace = await prisma.constructorWorkspace.findUnique({
    where: { id: input.workspaceId },
    include: {
      versions: { where: { status: "APPROVED" }, orderBy: { approvedAt: "desc" }, take: 1 },
      files: {
        where: { isApproved: true, isArchived: false },
      },
      techSpec: true,
    },
  });
  if (!workspace) throw new Error("Workspace не найден");
  if (workspace.status !== "APPROVED") throw new Error("Handoff возможен только после APPROVED");
  if (!workspace.versions[0]) throw new Error("Нет утвержденной версии для handoff");
  if (!workspace.techSpec) throw new Error("Нет технического задания");

  await prisma.$transaction(async (tx) => {
    await tx.constructorWorkspace.update({
      where: { id: workspace.id },
      data: {
        status: "HANDED_OFF_TO_PRODUCTION",
        handedOffAt: new Date(),
      },
    });
    if (workspace.productionFlowId) {
      await tx.productionFlow.update({
        where: { id: workspace.productionFlowId },
        data: {
          currentStepKey: "TASKS_DISTRIBUTED",
          status: "READY_FOR_PROCUREMENT_AND_WORKSHOP",
          distributedAt: new Date(),
        },
      });
      await tx.productionEvent.create({
        data: {
          flowId: workspace.productionFlowId,
          type: "CONSTRUCTOR_HANDOFF",
          title: "Пакет конструктора передан в procurement + production",
          actorName: input.actorUserId,
          metadataJson: {
            workspaceId: workspace.id,
            approvedVersionId: workspace.versions[0].id,
          },
        },
      });
    }
  });

  await createConstructorTimelineEvent({
    workspaceId: workspace.id,
    dealId: workspace.dealId,
    productionFlowId: workspace.productionFlowId ?? null,
    actorUserId: input.actorUserId,
    eventType: "HANDOFF_TO_PRODUCTION",
    title: "Пакет передан в производство",
  });

  await emitConstructorWorkflowEvent({
    workflowType: "production_transferred",
    dealId: workspace.dealId,
    workspaceId: workspace.id,
    userId: input.actorUserId,
    payload: { dealId: workspace.dealId },
  });
}

export async function markConstructorWorkspaceSnapshotOutdated(dealId: string): Promise<void> {
  await prisma.constructorWorkspace.updateMany({
    where: { dealId, status: { notIn: ["HANDED_OFF_TO_PRODUCTION", "CANCELLED"] } },
    data: { snapshotOutdated: true },
  });
}
