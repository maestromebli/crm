import type { ActivityEntityType, ActivityType, Prisma } from "@prisma/client";
import { prisma } from "../prisma";

type LogParams = {
  entityType: ActivityEntityType;
  entityId: string;
  type: ActivityType;
  actorUserId: string | null;
  data?: Prisma.InputJsonValue;
  source?: "USER" | "SYSTEM" | "INTEGRATION";
};

export async function appendActivityLog(params: LogParams): Promise<void> {
  const { entityType, entityId, type, actorUserId, data, source = "USER" } =
    params;
  try {
    await prisma.activityLog.create({
      data: {
        entityType,
        entityId,
        type,
        actorUserId,
        source,
        data: data ?? undefined,
      },
    });
  } catch (e) {
     
    console.error("[appendActivityLog]", e);
  }
}
