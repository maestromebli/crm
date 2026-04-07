import type { PrismaClient } from "@prisma/client";

export type ProductionAiInsights = {
  riskScore: number;
  delayPrediction?: string;
  overloadHints: string[];
  redistribution: string[];
  warnings: string[];
  updatedAt: string;
};

const emptyInsights = (): ProductionAiInsights => ({
  riskScore: 0,
  overloadHints: [],
  redistribution: [],
  warnings: [],
  updatedAt: new Date().toISOString(),
});

/** Legacy: раніше було прив’язано до `ProductionOrder`; використовуйте метрики `ProductionFlow`. */
export async function recomputeOrderRiskAndAi(
  _prisma: PrismaClient,
  _orderOrFlowId: string,
): Promise<ProductionAiInsights> {
  return emptyInsights();
}

export async function insightsForOrder(
  prisma: PrismaClient,
  orderId: string,
): Promise<ProductionAiInsights> {
  return recomputeOrderRiskAndAi(prisma, orderId);
}
