import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AiV2ActionPlanItem, AiV2ActorContext, AiV2ContextSnapshot, AiV2Decision } from "../core/types";

export async function logAiV2InsightRun(input: {
  actor: AiV2ActorContext;
  context: AiV2ContextSnapshot;
  decision: AiV2Decision;
  plannedActions: AiV2ActionPlanItem[];
  executedActions: AiV2ActionPlanItem[];
  skippedDuplicateActions?: AiV2ActionPlanItem[];
}): Promise<void> {
  await prisma.aiAssistantLog.create({
    data: {
      userId: input.actor.userId,
      action: "ai_v2.insight",
      entityType: input.context.entityType,
      entityId: input.context.entityId,
      model: process.env.AI_MODEL?.trim() || "rules-only",
      ok: true,
      metadata: {
        context: input.context.context,
        riskScore: input.decision.riskScore,
        healthScore: input.decision.healthScore,
        blockers: input.decision.blockers,
        riskReasons: input.decision.riskReasons,
        plannedActions: input.plannedActions.map((a) => a.type),
        executedActions: input.executedActions.map((a) => a.type),
        skippedDuplicateActions: (input.skippedDuplicateActions ?? []).map(
          (a) => a.type,
        ),
      } as Prisma.InputJsonValue,
    },
  });
}
