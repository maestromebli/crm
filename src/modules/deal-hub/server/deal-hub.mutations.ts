import { prisma } from "@/lib/prisma";
import { appendActivityLog } from "@/lib/deal-api/audit";

export async function executeDealHubCommandAction(params: {
  dealId: string;
  actorUserId: string | null;
  action: string;
  payload?: Record<string, unknown>;
}) {
  const { dealId, actorUserId, action, payload } = params;

  switch (action) {
    case "mark-deposit-received": {
      const firstMilestone = await prisma.dealPaymentMilestone.findFirst({
        where: { dealId },
        orderBy: { sortOrder: "asc" },
      });
      if (firstMilestone && !firstMilestone.confirmedAt) {
        await prisma.dealPaymentMilestone.update({
          where: { id: firstMilestone.id },
          data: { confirmedAt: new Date() },
        });
      }
      break;
    }
    case "schedule-measurement": {
      const current = await prisma.deal.findUnique({
        where: { id: dealId },
        select: { workspaceMeta: true },
      });
      const meta = ((current?.workspaceMeta ?? {}) as Record<string, unknown>) ?? {};
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          workspaceMeta: {
            ...meta,
            measurementComplete: false,
            measurementNotes: String(payload?.note ?? "Scheduled from Deal Hub Ultra"),
          },
        },
      });
      break;
    }
    default:
      break;
  }

  await appendActivityLog({
    entityType: "DEAL",
    entityId: dealId,
    type: "DEAL_UPDATED",
    actorUserId,
    source: "USER",
    data: {
      commandAction: action,
      payload: payload ?? null,
      at: new Date().toISOString(),
    } as any,
  });

  return { ok: true };
}
