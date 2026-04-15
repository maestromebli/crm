import { prisma } from "@/lib/prisma";
import type { ConstructorFile, ConstructorFileCategory } from "@prisma/client";
import { constructorFileSchema } from "./constructor-validation";
import { createConstructorTimelineEvent, emitConstructorWorkflowEvent } from "./constructor-timeline.service";

export async function uploadConstructorFile(input: {
  workspaceId: string;
  actorUserId: string;
  payload: unknown;
}): Promise<ConstructorFile> {
  const parsed = constructorFileSchema.parse(input.payload);

  const workspace = await prisma.constructorWorkspace.findUnique({
    where: { id: input.workspaceId },
    select: { id: true, dealId: true, productionFlowId: true },
  });
  if (!workspace) throw new Error("Workspace не найден");

  const row = await prisma.constructorFile.create({
    data: {
      workspaceId: workspace.id,
      versionId: parsed.versionId ?? null,
      uploadedByUserId: input.actorUserId,
      fileStorageKey: parsed.fileStorageKey ?? null,
      fileUrl: parsed.fileUrl ?? null,
      originalName: parsed.originalName,
      mimeType: parsed.mimeType,
      extension: parsed.extension,
      sizeBytes: parsed.sizeBytes ?? null,
      fileCategory: parsed.fileCategory,
      versionLabel: parsed.versionLabel ?? null,
      isImportant: parsed.isImportant ?? false,
      comment: parsed.comment ?? null,
    },
  });

  await createConstructorTimelineEvent({
    workspaceId: workspace.id,
    dealId: workspace.dealId,
    productionFlowId: workspace.productionFlowId,
    actorUserId: input.actorUserId,
    eventType: "FILE_UPLOADED",
    title: "Загружен файл конструктора",
    description: `${row.originalName} (${row.fileCategory})`,
    metadataJson: { fileId: row.id },
  });

  await emitConstructorWorkflowEvent({
    workflowType: "file_uploaded",
    dealId: workspace.dealId,
    workspaceId: workspace.id,
    userId: input.actorUserId,
    payload: {
      dealId: workspace.dealId,
      attachmentId: row.id,
    },
  });

  return row;
}

export async function getCurrentApprovedFilesForWorkspace(workspaceId: string): Promise<ConstructorFile[]> {
  return prisma.constructorFile.findMany({
    where: {
      workspaceId,
      isApproved: true,
      isArchived: false,
      isCurrent: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFilesByCategory(
  workspaceId: string,
  fileCategory: ConstructorFileCategory,
): Promise<ConstructorFile[]> {
  return prisma.constructorFile.findMany({
    where: { workspaceId, fileCategory },
    orderBy: { createdAt: "desc" },
  });
}

export async function archiveOldVersionFiles(input: {
  workspaceId: string;
  currentVersionId: string;
}): Promise<void> {
  await prisma.constructorFile.updateMany({
    where: {
      workspaceId: input.workspaceId,
      versionId: { not: input.currentVersionId },
      isArchived: false,
      isCurrent: true,
    },
    data: {
      isArchived: true,
      isCurrent: false,
    },
  });
}

export async function markApprovedFilesAfterVersionApproval(input: {
  workspaceId: string;
  versionId: string;
}): Promise<void> {
  await prisma.constructorFile.updateMany({
    where: { workspaceId: input.workspaceId, versionId: input.versionId },
    data: {
      isApproved: true,
      isCurrent: true,
      isArchived: false,
    },
  });
}
