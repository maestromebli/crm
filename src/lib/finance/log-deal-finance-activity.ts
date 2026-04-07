import type { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "../prisma";

const DEAL_FINANCE_TYPES = new Set<ActivityType>([
  "FINANCE_INVOICE_CREATED",
  "FINANCE_INVOICE_UPDATED",
  "CLIENT_PAYMENT_RECORDED",
  "CLIENT_PAYMENT_VOIDED",
  "DEAL_FINANCE_SNAPSHOT_SAVED",
]);

export async function logDealFinanceActivity(args: {
  dealId: string;
  actorUserId: string | null;
  type: ActivityType;
  data?: Prisma.InputJsonValue;
}): Promise<void> {
  if (!DEAL_FINANCE_TYPES.has(args.type)) {
    throw new Error(`logDealFinanceActivity: unsupported type ${args.type}`);
  }
  try {
    await prisma.activityLog.create({
      data: {
        entityType: "DEAL",
        entityId: args.dealId,
        type: args.type,
        actorUserId: args.actorUserId,
        source: args.actorUserId ? "USER" : "SYSTEM",
        data: args.data ?? {},
      },
    });
  } catch (e) {
    console.error("[logDealFinanceActivity]", e);
  }
}
