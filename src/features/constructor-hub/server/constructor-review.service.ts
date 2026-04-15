import { prisma } from "@/lib/prisma";
import type { ConstructorReview, ConstructorVersion } from "@prisma/client";
import { constructorReviewSchema, ensureWorkspaceTransition } from "./constructor-validation";
import { markApprovedFilesAfterVersionApproval } from "./constructor-file.service";
import { createConstructorTimelineEvent } from "./constructor-timeline.service";

type ReviewResult = {
  review: ConstructorReview;
  version: ConstructorVersion;
};

export async function reviewConstructorVersion(input: {
  versionId: string;
  actorUserId: string;
  payload: unknown;
}): Promise<ReviewResult> {
  const parsed = constructorReviewSchema.parse(input.payload);
  const version = await prisma.constructorVersion.findUnique({
    where: { id: input.versionId },
    include: { workspace: true },
  });
  if (!version) throw new Error("Version не найдена");

  if (version.submittedByUserId && version.submittedByUserId === input.actorUserId) {
    throw new Error("Нельзя ревьюить собственную версию");
  }

  const now = new Date();
  const mappedSeverity = parsed.severity ?? "INFO";

  const review = await prisma.constructorReview.create({
    data: {
      workspaceId: version.workspaceId,
      versionId: version.id,
      reviewedByUserId: input.actorUserId,
      decision: parsed.decision,
      comment: parsed.comment ?? null,
      severity: mappedSeverity,
      checklistJson: (parsed.checklistJson as object | null) ?? null,
      remarksJson: (parsed.remarksJson as object | null) ?? null,
    },
  });

  if (parsed.decision === "APPROVE") {
    ensureWorkspaceTransition(version.workspace.status, "APPROVED");
    const updatedVersion = await prisma.constructorVersion.update({
      where: { id: version.id },
      data: {
        status: "APPROVED",
        reviewedByUserId: input.actorUserId,
        reviewedAt: now,
        approvedAt: now,
      },
    });
    await prisma.constructorWorkspace.update({
      where: { id: version.workspaceId },
      data: {
        status: "APPROVED",
        approvedAt: now,
      },
    });
    await markApprovedFilesAfterVersionApproval({
      workspaceId: version.workspaceId,
      versionId: version.id,
    });
    await createConstructorTimelineEvent({
      workspaceId: version.workspaceId,
      dealId: version.workspace.dealId,
      productionFlowId: version.workspace.productionFlowId ?? null,
      actorUserId: input.actorUserId,
      eventType: "REVIEW_APPROVED",
      title: "Версия утверждена",
      description: version.versionCode,
      metadataJson: { versionId: version.id, reviewId: review.id },
    });
    return { review, version: updatedVersion };
  }

  if (parsed.decision === "RETURN_FOR_REVISION") {
    ensureWorkspaceTransition(version.workspace.status, "REVISION_REQUESTED");
    const updatedVersion = await prisma.constructorVersion.update({
      where: { id: version.id },
      data: {
        status: "CHANGES_REQUESTED",
        reviewedByUserId: input.actorUserId,
        reviewedAt: now,
        returnReason: parsed.comment ?? "Возврат на доработку",
      },
    });
    await prisma.constructorWorkspace.update({
      where: { id: version.workspaceId },
      data: {
        status: "REVISION_REQUESTED",
      },
    });
    await createConstructorTimelineEvent({
      workspaceId: version.workspaceId,
      dealId: version.workspace.dealId,
      productionFlowId: version.workspace.productionFlowId ?? null,
      actorUserId: input.actorUserId,
      eventType: "REVIEW_RETURNED",
      title: "Версия возвращена на доработку",
      description: parsed.comment ?? null,
      metadataJson: { versionId: version.id, reviewId: review.id },
    });
    return { review, version: updatedVersion };
  }

  const updatedVersion = await prisma.constructorVersion.update({
    where: { id: version.id },
    data: {
      status: "UNDER_REVIEW",
      reviewedByUserId: input.actorUserId,
      reviewedAt: now,
    },
  });
  await createConstructorTimelineEvent({
    workspaceId: version.workspaceId,
    dealId: version.workspace.dealId,
    productionFlowId: version.workspace.productionFlowId ?? null,
    actorUserId: input.actorUserId,
    eventType: "REVIEW_COMMENTED",
    title: "Оставлен комментарий к версии",
    description: parsed.comment ?? null,
    metadataJson: { versionId: version.id, reviewId: review.id },
  });
  return { review, version: updatedVersion };
}
