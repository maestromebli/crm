import type { TaskPriority, TaskType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canRunAiV2Action } from "../guard/rbac-guard";
import type {
  AiV2ActionPlanItem,
  AiV2ActorContext,
  AiV2ContextSnapshot,
  AiV2Decision,
} from "../core/types";

export function buildAiV2ActionPlan(
  context: AiV2ContextSnapshot,
  decision: AiV2Decision,
): AiV2ActionPlanItem[] {
  const items: AiV2ActionPlanItem[] = [];

  if (decision.followUpUrgency === "high") {
    items.push({
      type: "create_reminder",
      title: "Терміновий наступний контакт з клієнтом",
      description: `AI V2: ${decision.nextBestAction}`,
      priority: "URGENT",
      lowRisk: true,
    });
  }

  if (decision.blockers.length > 0) {
    items.push({
      type: "create_task",
      title: "Закрити AI-блокери етапу",
      description: `AI V2 виявив блокери: ${decision.blockers.join(" ")}`,
      priority: decision.riskScore >= 70 ? "HIGH" : "NORMAL",
      lowRisk: true,
    });
  }

  if (decision.riskScore >= 80) {
    items.push({
      type: "escalate_team_lead",
      title: "Ескалація ризику Team Lead",
      description: `AI V2: ризик ${decision.riskScore}/100 по ${context.title}.`,
      priority: "HIGH",
      lowRisk: false,
    });
  }

  return items;
}

function toTaskPriority(priority: AiV2ActionPlanItem["priority"]): TaskPriority {
  return priority;
}

function toTaskType(actionType: AiV2ActionPlanItem["type"]): TaskType {
  if (actionType === "create_reminder") return "FOLLOW_UP";
  return "OTHER";
}

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function hasRecentSimilarOpenTask(input: {
  actorUserId: string;
  assigneeId: string;
  entityType: "LEAD" | "DEAL";
  entityId: string;
  title: string;
  actionType: AiV2ActionPlanItem["type"];
}): Promise<boolean> {
  const recent = await prisma.task.findFirst({
    where: {
      createdById: input.actorUserId,
      assigneeId: input.assigneeId,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      taskType: toTaskType(input.actionType),
      status: { in: ["OPEN", "IN_PROGRESS"] },
      createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
    },
    select: { id: true },
  });
  return Boolean(recent);
}

export async function executeAiV2LowRiskActions(input: {
  actor: AiV2ActorContext;
  context: AiV2ContextSnapshot;
  actions: AiV2ActionPlanItem[];
}): Promise<{
  executed: AiV2ActionPlanItem[];
  skippedDuplicates: AiV2ActionPlanItem[];
}> {
  const executed: AiV2ActionPlanItem[] = [];
  const skippedDuplicates: AiV2ActionPlanItem[] = [];

  for (const action of input.actions) {
    if (!action.lowRisk) continue;
    if (!canRunAiV2Action(input.actor, action.type)) continue;
    if (input.context.entityType === "DASHBOARD") continue;

    const assigneeId = input.context.ownerId ?? input.actor.userId;
    const isDuplicate = await hasRecentSimilarOpenTask({
      actorUserId: input.actor.userId,
      assigneeId,
      entityType: input.context.entityType,
      entityId: input.context.entityId,
      title: action.title,
      actionType: action.type,
    });
    if (isDuplicate) {
      skippedDuplicates.push(action);
      continue;
    }

    await prisma.task.create({
      data: {
        title: action.title,
        description: action.description,
        entityType: input.context.entityType,
        entityId: input.context.entityId,
        taskType: toTaskType(action.type),
        status: "OPEN",
        priority: toTaskPriority(action.priority),
        assigneeId,
        createdById: input.actor.userId,
      },
    });
    executed.push(action);
  }

  return {
    executed,
    skippedDuplicates,
  };
}
