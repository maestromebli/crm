import { publishEntityEvent, type EventEntityType } from "@/lib/events/crm-events";
import type { WorkflowEventPayloadMap, WorkflowEventType } from "@/lib/events/types";
import type { Prisma } from "@prisma/client";

type EventEntityScope = {
  entityType: EventEntityType;
  entityId: string;
  dealId?: string | null;
  userId?: string | null;
};

export async function recordWorkflowEvent<K extends WorkflowEventType>(
  type: K,
  payload: WorkflowEventPayloadMap[K],
  scope: EventEntityScope,
): Promise<string | null> {
  const jsonPayload = JSON.parse(
    JSON.stringify(payload ?? {}),
  ) as Prisma.InputJsonObject;

  return publishEntityEvent({
    type,
    entityType: scope.entityType,
    entityId: scope.entityId,
    dealId: scope.dealId ?? null,
    userId: scope.userId ?? null,
    payload: jsonPayload,
  });
}
