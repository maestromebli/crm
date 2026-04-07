import type { PrismaClient } from "@prisma/client";
import { recomputeOrderRiskAndAi } from "./ai-monitor";

/** Legacy: етапи керуються через `ProductionFlow` / `ProductionFlowStep`. */
export async function completeProductionStage(
  prisma: PrismaClient,
  orderId: string,
  _stageId: string,
  _actorUserId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await recomputeOrderRiskAndAi(prisma, orderId);
  return {
    ok: false,
    error: "Етапи виробництва ведуться в потоці Production Flow (CRM → Виробництво).",
  };
}
