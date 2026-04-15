import type { EstimateCoreMargin } from "../types";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateMargin(totalRevenue: number, totalCost: number): EstimateCoreMargin {
  const grossProfit = roundMoney(totalRevenue - totalCost);
  const marginPercent =
    totalRevenue > 0 ? roundMoney((grossProfit / totalRevenue) * 100) : 0;
  return {
    grossProfit,
    marginPercent,
    riskLevel:
      marginPercent < 10 ? "high" : marginPercent < 18 ? "medium" : "low",
  };
}
