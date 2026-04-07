import { prisma } from "@/lib/prisma";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";

function dateOnlyKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function runTaskOverdueWatchdog(params?: {
  limit?: number;
  dryRun?: boolean;
  now?: Date;
}) {
  const limit = Math.max(1, Math.min(1000, params?.limit ?? 300));
  const dryRun = params?.dryRun === true;
  const now = params?.now ?? new Date();

  const rows = await prisma.task.findMany({
    where: {
      entityType: { in: ["LEAD", "DEAL"] },
      status: { in: ["OPEN", "IN_PROGRESS"] },
      dueAt: { not: null, lt: now },
    },
    orderBy: { dueAt: "asc" },
    take: limit,
    select: {
      id: true,
      entityType: true,
      entityId: true,
      assigneeId: true,
    },
  });

  let checked = 0;
  let overdue = 0;
  let emitted = 0;

  for (const row of rows) {
    checked += 1;
    overdue += 1;
    if (dryRun) continue;

    const id = await recordWorkflowEvent(
      WORKFLOW_EVENT_TYPES.TASK_OVERDUE,
      row.entityType === "LEAD"
        ? { leadId: row.entityId, taskId: row.id }
        : { dealId: row.entityId, taskId: row.id },
      {
        entityType: row.entityType,
        entityId: row.entityId,
        dealId: row.entityType === "DEAL" ? row.entityId : null,
        userId: row.assigneeId,
        dedupeKey: `task-overdue:${row.id}:${dateOnlyKey(now)}`,
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
