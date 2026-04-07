import { prisma } from "@/lib/prisma";
import type { AiV2ContextSnapshot, AiV2Decision, AiV2MemorySnapshot } from "../core/types";

export async function buildAiV2MemorySnapshot(input: {
  context: AiV2ContextSnapshot;
  decision: AiV2Decision;
}): Promise<AiV2MemorySnapshot> {
  const unresolvedQuestions = input.decision.blockers.map((b) => b.trim()).filter(Boolean);
  const keyFacts = [...input.context.timelineFacts];

  if (input.context.entityType !== "DASHBOARD") {
    const lastAiLog = await prisma.aiAssistantLog.findFirst({
      where: {
        action: "ai_v2.insight",
        entityType: input.context.entityType,
        entityId: input.context.entityId,
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (lastAiLog?.createdAt) {
      keyFacts.push(`Останній AI V2 аналіз: ${lastAiLog.createdAt.toISOString()}`);
    }
  }

  return {
    keyFacts,
    unresolvedQuestions,
    freshness: input.decision.riskScore >= 75 ? "stale" : "fresh",
  };
}
