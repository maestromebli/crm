import { prisma } from "@/lib/prisma";
import { appendActivityLog } from "@/lib/deal-api/audit";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";
import type { ActivityType } from "@prisma/client";

type TimelineInput = {
  workspaceId: string;
  dealId: string;
  productionFlowId: string | null;
  actorUserId?: string | null;
  eventType: string;
  title: string;
  description?: string | null;
  metadataJson?: unknown;
};

export async function createConstructorTimelineEvent(input: TimelineInput): Promise<void> {
  await prisma.constructorTimelineEvent.create({
    data: {
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      title: input.title,
      description: input.description ?? null,
      metadataJson: (input.metadataJson as object | null) ?? null,
    },
  });

  if (input.productionFlowId) {
    await prisma.productionEvent.create({
      data: {
        flowId: input.productionFlowId,
        type: `CONSTRUCTOR_${input.eventType}`,
        title: input.title,
        description: input.description ?? null,
        actorName: input.actorUserId ?? null,
        metadataJson: (input.metadataJson as object | null) ?? null,
      },
    });
  }

  const activityTypeByEvent: Record<string, ActivityType> = {
    WORKSPACE_CREATED: "CONSTRUCTOR_WORKSPACE_CREATED",
    CONSTRUCTOR_ASSIGNED: "CONSTRUCTOR_ASSIGNED",
    TECH_SPEC_CREATED: "CONSTRUCTOR_TECHSPEC_UPDATED",
    TECH_SPEC_UPDATED: "CONSTRUCTOR_TECHSPEC_UPDATED",
    QUESTION_CREATED: "CONSTRUCTOR_QUESTION_CREATED",
    QUESTION_ANSWERED: "CONSTRUCTOR_QUESTION_ANSWERED",
    QUESTION_CLOSED: "CONSTRUCTOR_QUESTION_CLOSED",
    FILE_UPLOADED: "CONSTRUCTOR_FILE_UPLOADED",
    VERSION_CREATED: "CONSTRUCTOR_VERSION_CREATED",
    VERSION_SUBMITTED: "CONSTRUCTOR_VERSION_SUBMITTED",
    REVIEW_APPROVED: "CONSTRUCTOR_REVIEW_APPROVED",
    REVIEW_RETURNED: "CONSTRUCTOR_REVIEW_RETURNED",
    HANDOFF_TO_PRODUCTION: "CONSTRUCTOR_HANDOFF_COMPLETED",
  };

  await appendActivityLog({
    entityType: "DEAL",
    entityId: input.dealId,
    type: activityTypeByEvent[input.eventType] ?? "CONSTRUCTOR_TECHSPEC_UPDATED",
    actorUserId: input.actorUserId ?? null,
    data: {
      workspaceId: input.workspaceId,
      eventType: input.eventType,
    },
  });
}

export async function emitConstructorWorkflowEvent(input: {
  workflowType:
    | (typeof WORKFLOW_EVENT_TYPES)["FILE_UPLOADED"]
    | (typeof WORKFLOW_EVENT_TYPES)["FILE_APPROVED"]
    | (typeof WORKFLOW_EVENT_TYPES)["AI_ALERT_CREATED"]
    | (typeof WORKFLOW_EVENT_TYPES)["PRODUCTION_TRANSFERRED"];
  dealId: string;
  workspaceId: string;
  userId?: string | null;
  payload: Record<string, unknown>;
}): Promise<void> {
  await recordWorkflowEvent(
    input.workflowType,
    input.payload as never,
    {
      entityType: "DEAL",
      entityId: input.dealId,
      dealId: input.dealId,
      userId: input.userId ?? null,
      dedupeKey: `${input.workflowType}:${input.workspaceId}:${JSON.stringify(input.payload)}`,
    },
  );
}
