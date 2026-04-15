import type { ActivityEntityType, ActivityType, Prisma } from "@prisma/client";
import { appendActivityLog } from "@/lib/deal-api/audit";

type PlatformAuditInput = {
  entityType: ActivityEntityType;
  entityId: string;
  type: ActivityType;
  actorUserId?: string | null;
  source?: "USER" | "SYSTEM" | "INTEGRATION";
  data?: Prisma.InputJsonValue;
  requestId?: string;
  correlationId?: string;
};

export async function writePlatformAudit(input: PlatformAuditInput): Promise<void> {
  const envelope = {
    requestId: input.requestId ?? null,
    correlationId: input.correlationId ?? null,
    ...(typeof input.data === "object" && input.data ? (input.data as object) : {}),
  };
  await appendActivityLog({
    entityType: input.entityType,
    entityId: input.entityId,
    type: input.type,
    actorUserId: input.actorUserId ?? null,
    source: input.source ?? "SYSTEM",
    data: envelope as Prisma.InputJsonValue,
  });
}

