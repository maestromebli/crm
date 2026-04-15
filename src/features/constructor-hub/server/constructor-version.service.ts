import { prisma } from "@/lib/prisma";
import type { ConstructorVersion } from "@prisma/client";
import { constructorVersionSchema, ensureWorkspaceTransition } from "./constructor-validation";
import { archiveOldVersionFiles } from "./constructor-file.service";
import { createConstructorTimelineEvent } from "./constructor-timeline.service";

export async function createConstructorVersion(input: {
  workspaceId: string;
  actorUserId: string;
  payload: unknown;
}): Promise<ConstructorVersion> {
  const parsed = constructorVersionSchema.parse(input.payload);
  const workspace = await prisma.constructorWorkspace.findUnique({
    where: { id: input.workspaceId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });
  if (!workspace) throw new Error("Workspace не найден");
  const nextNumber = (workspace.versions[0]?.versionNumber ?? 0) + 1;

  await prisma.constructorVersion.updateMany({
    where: { workspaceId: workspace.id, isCurrent: true },
    data: { isCurrent: false },
  });

  const row = await prisma.constructorVersion.create({
    data: {
      workspaceId: workspace.id,
      versionNumber: nextNumber,
      versionCode: `V${nextNumber}`,
      type: parsed.type,
      status: "PREPARING",
      summary: parsed.summary,
      isCurrent: true,
      submittedByUserId: input.actorUserId,
    },
  });

  await createConstructorTimelineEvent({
    workspaceId: workspace.id,
    dealId: workspace.dealId,
    productionFlowId: workspace.productionFlowId ?? null,
    actorUserId: input.actorUserId,
    eventType: "VERSION_CREATED",
    title: "Создана версия конструктора",
    description: row.versionCode,
    metadataJson: { versionId: row.id },
  });

  return row;
}

function requiredFileCategoriesForSubmission() {
  return ["DRAWING", "SPECIFICATION", "FITTINGS_LIST"] as const;
}

export async function validateSubmissionBlockers(workspaceId: string, versionId: string): Promise<string[]> {
  const workspace = await prisma.constructorWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      techSpec: true,
      checklistItems: true,
      questions: true,
      files: true,
      versions: { where: { id: versionId } },
      assignedConstructorUser: { select: { id: true } },
    },
  });
  if (!workspace) throw new Error("Workspace не найден");

  const blockers: string[] = [];
  if (!workspace.assignedConstructorUserId) blockers.push("Не назначен конструктор");
  if (!workspace.techSpec) blockers.push("Не создан ConstructorTechSpec");
  if (!workspace.techSpec?.approvedDataSnapshotJson) blockers.push("Нет approvedDataSnapshotJson");

  const version = workspace.versions[0];
  if (!version) blockers.push("Версия не найдена");
  if (version && !version.summary.trim()) blockers.push("Summary версии пустой");

  const requiredIncomplete = workspace.checklistItems.some((item) => item.isRequired && !item.isCompleted);
  if (requiredIncomplete) blockers.push("Не выполнены обязательные checklist пункты");

  const hasOpenCritical = workspace.questions.some((q) => q.isCritical && q.status !== "CLOSED");
  if (hasOpenCritical) blockers.push("Есть незакрытые CRITICAL вопросы");

  for (const category of requiredFileCategoriesForSubmission()) {
    const found = workspace.files.some((file) => file.fileCategory === category && !file.isArchived);
    if (!found) blockers.push(`Нет обязательного файла: ${category}`);
  }

  return blockers;
}

export async function submitConstructorVersion(input: {
  versionId: string;
  actorUserId: string;
}): Promise<ConstructorVersion> {
  const version = await prisma.constructorVersion.findUnique({
    where: { id: input.versionId },
    include: {
      workspace: true,
    },
  });
  if (!version) throw new Error("Version не найдена");
  if (version.status === "SUBMITTED" || version.status === "UNDER_REVIEW") {
    throw new Error("Версия уже отправлена на проверку");
  }

  const blockers = await validateSubmissionBlockers(version.workspaceId, version.id);
  if (blockers.length > 0) {
    throw new Error(`Блокеры отправки: ${blockers.join("; ")}`);
  }

  ensureWorkspaceTransition(version.workspace.status, "UNDER_REVIEW");

  const now = new Date();
  const updated = await prisma.constructorVersion.update({
    where: { id: version.id },
    data: {
      status: "UNDER_REVIEW",
      submittedByUserId: input.actorUserId,
      submittedAt: now,
    },
  });

  await prisma.constructorWorkspace.update({
    where: { id: version.workspaceId },
    data: {
      status: "UNDER_REVIEW",
      submittedAt: now,
    },
  });

  await createConstructorTimelineEvent({
    workspaceId: version.workspaceId,
    dealId: version.workspace.dealId,
    productionFlowId: version.workspace.productionFlowId ?? null,
    actorUserId: input.actorUserId,
    eventType: "VERSION_SUBMITTED",
    title: "Версия отправлена на проверку",
    description: version.versionCode,
    metadataJson: { versionId: version.id },
  });

  await archiveOldVersionFiles({
    workspaceId: version.workspaceId,
    currentVersionId: version.id,
  });

  return updated;
}
