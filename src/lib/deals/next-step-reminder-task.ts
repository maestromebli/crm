import type { DealStatus } from "@prisma/client";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";
import { deriveNextStepSeverity } from "@/lib/deal-core/insights";
import { prisma } from "../prisma";

/** Одна службова задача на угоду — без міграцій схеми. */
export const NEXT_STEP_REMINDER_TASK_TITLE =
  "[NEXTSTEP] Задайте наступний крок і дату контакту";

function metaFromJson(value: unknown): DealWorkspaceMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as DealWorkspaceMeta;
}

async function completeOpenReminders(dealId: string): Promise<void> {
  await prisma.task.updateMany({
    where: {
      entityType: "DEAL",
      entityId: dealId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      title: NEXT_STEP_REMINDER_TASK_TITLE,
    },
    data: {
      status: "DONE",
      completedAt: new Date(),
    },
  });
}

/**
 * Після зміни workspaceMeta: якщо «немає кроку/дати» — одна відкрита нагадувальна задача
 * власнику угоди; якщо все ок — закрити таку задачу.
 */
export async function syncNextStepReminderTask(params: {
  dealId: string;
  ownerId: string;
  dealStatus: DealStatus;
  workspaceMetaJson: unknown;
  actorUserId: string;
}): Promise<void> {
  const { dealId, ownerId, dealStatus, workspaceMetaJson, actorUserId } =
    params;

  if (dealStatus !== "OPEN" && dealStatus !== "ON_HOLD") {
    await completeOpenReminders(dealId);
    return;
  }

  const meta = metaFromJson(workspaceMetaJson);
  const severity = deriveNextStepSeverity(meta);

  if (severity === "ok") {
    await completeOpenReminders(dealId);
    return;
  }

  const existing = await prisma.task.findFirst({
    where: {
      entityType: "DEAL",
      entityId: dealId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
      title: NEXT_STEP_REMINDER_TASK_TITLE,
    },
  });
  if (existing) return;

  const dueAt = new Date();
  dueAt.setHours(23, 59, 59, 999);

  await prisma.task.create({
    data: {
      title: NEXT_STEP_REMINDER_TASK_TITLE,
      description:
        severity === "warning"
          ? "CRM: час наступної дії минув — оновіть дату або зафіксуйте контакт."
          : "CRM: у шапці угоди не заповнено наступний крок або дату контакту.",
      entityType: "DEAL",
      entityId: dealId,
      taskType: "FOLLOW_UP",
      status: "OPEN",
      priority: severity === "warning" ? "URGENT" : "HIGH",
      dueAt,
      assigneeId: ownerId,
      createdById: actorUserId,
    },
  });
}
