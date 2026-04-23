import { prisma } from "@/lib/prisma";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";

function metaFromUnknown(value: unknown): DealWorkspaceMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as DealWorkspaceMeta;
}

function dateOnlyKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function runFollowUpWatchdog(params?: {
  limit?: number;
  dryRun?: boolean;
  now?: Date;
}) {
  const limit = Math.max(1, Math.min(500, params?.limit ?? 200));
  const dryRun = params?.dryRun === true;
  const now = params?.now ?? new Date();

  const deals = await prisma.deal.findMany({
    where: { status: { in: ["OPEN", "ON_HOLD"] } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      ownerId: true,
      workspaceMeta: true,
    },
  });

  let checked = 0;
  let overdue = 0;
  let emitted = 0;

  for (const deal of deals) {
    checked += 1;
    const meta = metaFromUnknown(deal.workspaceMeta);
    if (meta.nextStepKind !== "follow_up") continue;
    if (!meta.nextActionAt) continue;
    const nextActionAt = new Date(meta.nextActionAt);
    if (Number.isNaN(nextActionAt.getTime())) continue;
    if (nextActionAt.getTime() > now.getTime()) continue;

    overdue += 1;
    if (dryRun) continue;

    const id = await recordWorkflowEvent(
      WORKFLOW_EVENT_TYPES.FOLLOW_UP_REQUIRED,
      { dealId: deal.id },
      {
        entityType: "DEAL",
        entityId: deal.id,
        dealId: deal.id,
        userId: deal.ownerId,
        dedupeKey: `наступний контакт:${deal.id}:${dateOnlyKey(now)}`,
      },
    );
    if (id) emitted += 1;
  }

  return {
    checked,
    overdue,
    emitted,
    dryRun,
    limit,
    at: now.toISOString(),
  };
}
